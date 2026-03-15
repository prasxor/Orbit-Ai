import os
import io
import sqlite3
import hashlib
import json
import pandas as pd
from dotenv import load_dotenv
from services.gemini_service import query_gemini

load_dotenv()

DEFAULT_DB_PATH = "sales.db"
DEFAULT_DATASET_NAME = "Amazon Sales"

# ---------------------------------------------------------------------------
# Query result cache: {cache_key: result_dict}
# caching identical prompts to save on api calls
# ---------------------------------------------------------------------------
_QUERY_CACHE: dict[str, dict] = {}


def _cache_key(message: str, db_path: str) -> str:
    # md5 hash for prompt + db path to prevent collisions
    return hashlib.md5(f"{db_path}||{message.strip().lower()}".encode()).hexdigest()


# ---------------------------------------------------------------------------
# Static schema for the default Amazon Sales dataset
# ---------------------------------------------------------------------------

AMAZON_SALES_SCHEMA = """Table: sales  (Amazon e-commerce transactions, ~50,000 rows, 2022-2023)
Columns — use EXACT names below in SQL:
  order_id         INTEGER  Unique transaction ID. Never GROUP BY or aggregate on this.
  order_date       TEXT     Transaction date YYYY-MM-DD. For trends use strftime('%Y-%m', order_date).
  product_id       INTEGER  Unique product ID. Never GROUP BY or aggregate on this.
  product_category TEXT     Category: Books | Fashion | Electronics | Home & Kitchen | Sports | Beauty | Toys
  price            REAL     Base price per unit before discount.
  discount_percent INTEGER  Discount applied (e.g. 10, 20). Never recompute discounted_price manually.
  quantity_sold    INTEGER  Units in this order. Use SUM() when aggregating.
  customer_region  TEXT     Region: North America | Asia | Europe | South America | Africa | Australia
  payment_method   TEXT     Method: UPI | Credit Card | Debit Card | Net Banking | Cash on Delivery
  rating           REAL     Product rating 0-5. Use AVG() when aggregating.
  review_count     INTEGER  Total reviews for product. Use SUM() when aggregating.
  discounted_price REAL     Already computed: price*(1-discount_percent/100.0). Use directly — do NOT recompute.
  total_revenue    REAL     PRIMARY KPI: discounted_price * quantity_sold per order. Always prefer this for revenue analysis.
Key rules: never SELECT *, never GROUP BY order_id/product_id, use strftime (not DATE_TRUNC)."""


def get_table_name(db_path: str, conn: sqlite3.Connection = None) -> str:
    # fast path for static db
    if db_path == DEFAULT_DB_PATH and conn is None:
        return "sales"
    
    # fetch first table for custom uploaded csvs
    try:
        active_conn = conn if conn else sqlite3.connect(db_path, check_same_thread=False)
        cursor = active_conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        if conn is None:
            active_conn.close()
            
        return tables[0][0] if tables else "data"
    except Exception:
        return "data"


# ---------------------------------------------------------------------------
# Schema analysis for uploaded CSVs — called ONCE on upload, result cached in session
# ---------------------------------------------------------------------------

def analyze_csv_schema(df: pd.DataFrame, table_name: str = "data") -> str:
    """
    Build a rich schema string from a DataFrame for use in LLM prompts.
    Includes column types, value ranges, and sample values.
    No Gemini call needed — pure Python introspection is faster and free.
    """
    lines = [f"Table: {table_name}  ({len(df):,} rows)"]
    lines.append("Columns — use EXACT names below in SQL:")

    for col in df.columns:
        dtype = df[col].dtype
        non_null = df[col].dropna()

        if pd.api.types.is_numeric_dtype(dtype):
            col_type = "REAL" if pd.api.types.is_float_dtype(dtype) else "INTEGER"
            if len(non_null) > 0:
                meta = f"range {non_null.min():.2g}–{non_null.max():.2g}, avg {non_null.mean():.2g}"
            else:
                meta = "all null"
        else:
            col_type = "TEXT"
            unique_vals = non_null.unique()
            if len(unique_vals) <= 12:
                samples = " | ".join(str(v) for v in unique_vals[:12])
            else:
                samples = ", ".join(str(v) for v in unique_vals[:6]) + f" … ({len(unique_vals)} unique)"
            meta = f"values: {samples}"

        lines.append(f"  {col:<30} {col_type:<8}  {meta}")

    lines.append("\nSQL Rules: only use exact column names above. SQLite syntax. Never SELECT *.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Chart config builder
# formats df into plotly spec json
# ---------------------------------------------------------------------------

def build_chart_config(df: pd.DataFrame, chart_type: str) -> dict:
    if df.empty or len(df.columns) < 2:
        return {}

    x_col = df.columns[0]
    y_col = df.columns[1]
    for col in df.columns[1:]:
        if pd.api.types.is_numeric_dtype(df[col]):
            y_col = col
            break

    x_data = df[x_col].tolist()
    y_data = df[y_col].tolist()

    # Detect monthly date strings (YYYY-MM)
    is_monthly = (
        x_data and isinstance(x_data[0], str)
        and len(x_data[0]) == 7 and x_data[0][4] == '-'
    )
    x_label = "Month" if is_monthly else x_col.replace('_', ' ').title()
    y_label = y_col.replace('_', ' ').title()
    chart_title = f"{y_label} by {x_label}"

    if chart_type == "line_chart":
        trace = {"x": x_data, "y": y_data, "type": "scatter", "mode": "lines+markers"}
    elif chart_type == "pie_chart":
        trace = {"labels": x_data, "values": y_data, "type": "pie"}
    elif chart_type == "scatter_plot":
        trace = {"x": x_data, "y": y_data, "type": "scatter", "mode": "markers"}
    else:
        trace = {"x": x_data, "y": y_data, "type": "bar"}

    layout: dict = {"title": chart_title}
    if chart_type != "pie_chart":
        layout["xaxis"] = {"title": x_label}
        layout["yaxis"] = {"title": y_label}

    return {"data": [trace], "layout": layout}


# ---------------------------------------------------------------------------
# Core query runner
# ---------------------------------------------------------------------------

def _run_query(sql: str, db_path: str, conn: sqlite3.Connection = None) -> pd.DataFrame:
    # use provided persistent connection if available, else connect
    active_conn = conn if conn else sqlite3.connect(db_path, check_same_thread=False)
    try:
        return pd.read_sql_query(sql, active_conn)
    finally:
        if conn is None:
            active_conn.close()


# ---------------------------------------------------------------------------
# Main agent entry point
# ---------------------------------------------------------------------------

def process_user_query(
    message: str,
    db_path: str = DEFAULT_DB_PATH,
    schema: str | None = None,
    conn: sqlite3.Connection = None,
) -> dict:
    """
    Pipeline:
      1. Check cache — return instantly if same query was asked before.
      2. Build schema-aware prompt (use pre-computed schema if provided, else static).
      3. Single Gemini call → JSON with SQL queries + chart_type + insights.
      4. Run SQL, build Plotly configs.
      5. Cache and return result.
    """
    # 1. cache hit check
    ck = _cache_key(message, db_path)
    if ck in _QUERY_CACHE:
        return _QUERY_CACHE[ck]

    # 2. inject dynamically resolved schema + table details
    table_name = get_table_name(db_path, conn=conn)
    if schema is None:
        schema = AMAZON_SALES_SCHEMA

    # 3. format llm prompt
    prompt = _build_prompt(message, schema, table_name)

    # 4. Call Gemini (single call)
    max_retries = 2
    attempts = 0
    last_error = ""
    current_prompt = prompt
    queries: list = []
    insights: str = ""
    json_str: str = ""

    while attempts <= max_retries:
        if attempts > 0:
            current_prompt = (
                prompt
                + f"\n\nPREVIOUS SQL FAILED — Error: {last_error}\n"
                  "Fix the SQL using only the exact column names from the schema above. Return corrected JSON only."
            )

        try:
            json_str = query_gemini(current_prompt).strip()
            if json_str.startswith("```"):
                lines = json_str.split("\n")
                end = -1 if lines[-1].strip() == "```" else len(lines)
                json_str = "\n".join(lines[1:end])

            llm_resp = json.loads(json_str)
            intent = llm_resp.get("intent", "analysis")
            insights = str(llm_resp.get("business_insights", llm_resp.get("explanation", "")) or "")

            if intent == "chat" or not llm_resp.get("queries"):
                result = {"error": None, "charts": [], "insights": insights, "sql": ""}
                _QUERY_CACHE[ck] = result
                return result

            queries = llm_resp.get("queries", [])
            if not queries and "sql_query" in llm_resp:
                queries = [{"sql_query": llm_resp["sql_query"], "chart_type": llm_resp.get("chart_type", "bar_chart")}]

        except Exception as e:
            if attempts == max_retries:
                return {"error": f"Failed to get valid response from LLM: {e}", "charts": [], "insights": "", "sql": ""}
            last_error = f"JSON parse error: {e}"
            attempts += 1
            continue

        # 5. Execute SQL
        charts_data = []
        combined_sql = ""
        has_error = False

        for q in queries:
            sql = q.get("sql_query", "")
            chart_type = q.get("chart_type", "bar_chart")
            combined_sql += sql + "\n\n"
            try:
                df = _run_query(sql, db_path, conn=conn)
                if not df.empty:
                    cfg = build_chart_config(df, chart_type)
                    if cfg:
                        charts_data.append(cfg)
            except Exception as e:
                last_error = f"SQL error: {e}\nSQL: {sql}"
                has_error = True
                break

        if has_error:
            attempts += 1
            if attempts > max_retries:
                return {"error": f"SQL error after {max_retries} retries: {last_error}", "charts": [], "insights": insights, "sql": combined_sql}
            continue

        break

    if not charts_data:
        result = {
            "error": None,
            "charts": [],
            "insights": str(insights) + "\n\nHowever, I couldn't find any data matching your request or generate a valid chart.",
            "sql": combined_sql if 'combined_sql' in locals() else ""
        }
    else:
        result = {"error": None, "charts": charts_data, "insights": insights, "sql": combined_sql.strip()}

    _QUERY_CACHE[ck] = result
    return result


def _build_prompt(message: str, schema: str, table_name: str) -> str:
    return f"""You are an expert SQL analyst and business intelligence advisor.

DATASET SCHEMA:
{schema}

CRITICAL SQL RULES:
1. Only use exact column names from the schema above — never invent columns.
2. SQLite syntax only (strftime not DATE_TRUNC, no window functions unless simple).
3. Always use GROUP BY when using aggregate functions.
4. For time trends: strftime('%Y-%m', <date_col>) AS month, GROUP BY month, ORDER BY month.
5. Never SELECT * — select only needed columns.
6. Never GROUP BY unique ID columns.
7. No LIMIT unless the user explicitly asks for "top N".

CHART TYPE RULES:
- Time series / trends → "line_chart"
- Category comparisons (region, category, type) → "bar_chart"
- Proportions / market share → "pie_chart"
- Correlations (two numeric columns) → "scatter_plot"

Return ONLY valid JSON, no markdown, no explanations outside JSON:

If casual conversation (greeting, no data needed):
{{"intent":"chat","business_insights":"<helpful conversational reply>"}}

If data analysis needed:
{{"intent":"analysis","queries":[{{"sql_query":"<valid SQL referencing table {table_name}>","chart_type":"<type>"}}],"business_insights":"<7-10 sentence insight using markdown headings/bullets>"}}

User: {message}"""
