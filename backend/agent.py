import os
import sqlite3
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

# Import Gemini Service
from services.gemini_service import query_gemini

DB_PATH = "sales.db"

def _run_query(sql: str) -> pd.DataFrame:
    """Executes a SQL query on the SQLite DB and returns a DataFrame."""
    conn = sqlite3.connect(DB_PATH)
    try:
        df = pd.read_sql_query(sql, conn)
        return df
    finally:
        conn.close()

def get_schema() -> str:
    """Returns the schema of the database to provide context to the LLM."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info('sales');")
    columns = cursor.fetchall()
    conn.close()
    
    schema = "Table 'sales' columns:\n"
    for col in columns:
        schema += f"- {col[1]} ({col[2]})\n"
    return schema
    
import json

def build_chart_config(df: pd.DataFrame, chart_type: str) -> dict:
    if df.empty or len(df.columns) < 2:
        return {}
    
    x_col = df.columns[0]
    
    # Try to find a numeric column for Y. If none, just use the second column.
    y_col = df.columns[1]
    for col in df.columns[1:]:
        if pd.api.types.is_numeric_dtype(df[col]):
            y_col = col
            break

    x_data = df[x_col].tolist()
    y_data = df[y_col].tolist()
    
    chart_title = f"{y_col.replace('_', ' ').title()} by {x_col.replace('_', ' ').title()}"
    
    if chart_type == "line_chart":
        data_dict = {"x": x_data, "y": y_data, "type": "scatter", "mode": "lines+markers"}
    elif chart_type == "pie_chart":
        data_dict = {"labels": x_data, "values": y_data, "type": "pie"}
    elif chart_type == "scatter_plot":
        # For scatter, ideally both are numeric
        data_dict = {"x": x_data, "y": y_data, "type": "scatter", "mode": "markers"}
    else: # bar_chart fallback
        data_dict = {"x": x_data, "y": y_data, "type": "bar"}
        
    layout = {
        "title": chart_title,
        "xaxis": {"title": x_col.replace('_', ' ').title()} if chart_type != "pie_chart" else {},
        "yaxis": {"title": y_col.replace('_', ' ').title()} if chart_type != "pie_chart" else {}
    }
    
    return {"data": [data_dict], "layout": layout}

def process_user_query(message: str) -> dict:
    """
    Core AI logic:
    1. Translate message into valid JSON (SQL, chart_type, explanation).
    2. Run SQL and get DataFrame.
    3. Generate Plotly config contextually.
    """
    
    schema = get_schema()
    
    base_prompt = f"""You are an expert SQL analyst and business intelligence data analyst.

Your job is to convert a user's natural language request into a SQL query, recommend the best chart type, and provide business insights.

Database schema:
{schema}

Rules:
1. Use ONLY the columns listed in the schema. Do not invent tables or columns.
2. Use valid SQLite SQL syntax.
3. If aggregation is used, ensure GROUP BY is correct.
4. Do not use LIMIT unless explicitly asked.
5. Always return SQL that can generate data for visualization.
6. Prefer aggregated results for charts.

Chart Selection Rules:
- Use "line_chart" for time trends.
- Use "bar_chart" for comparisons across categories.
- Use "pie_chart" for proportions.
- Use "scatter_plot" for correlations.

Return the result strictly in this JSON format. Do not return any additional explanations or markdown text outside of this JSON.
{{
  "sql_query": "<valid SQL query>",
  "chart_type": "<line_chart | bar_chart | pie_chart | scatter_plot>",
  "business_insights": "<short business insight based on expected result>"
}}

User Request: {message}"""
    
    max_retries = 2
    attempts = 0
    last_error_msg = ""
    current_prompt = base_prompt
    
    sql = ""
    chart_type = "bar_chart"
    insights = ""

    while attempts <= max_retries:
        if attempts > 0:
            current_prompt = base_prompt + f"\n\nWait, your previous SQL query failed to run on SQLite.\nERROR: {last_error_msg}\n\nPlease correct the SQL query to fix this error and strictly return the JSON again."

        try:
            json_str = query_gemini(current_prompt)
            json_str = json_str.strip()
            # Clean up possible markdown code blocks around json
            if json_str.startswith("```"):
                lines = json_str.split("\n")
                if lines[-1].strip() == "```":
                    json_str = "\n".join(lines[1:-1])  # removes ```json ... ```
                else:
                    json_str = "\n".join(lines[1:])
                
            llm_resp = json.loads(json_str)
            sql = llm_resp.get("sql_query", "")
            chart_type = llm_resp.get("chart_type", "bar_chart")
            insights = llm_resp.get("business_insights", llm_resp.get("explanation", ""))
        except Exception as e:
            if attempts == max_retries:
                return {"error": f"Failed to generate valid JSON from LLM response after {attempts} retries: {str(e)}\n\nResponse was: {json_str}", "charts": [], "insights": "", "sql": ""}
            last_error_msg = f"Failed to parse JSON: {str(e)}"
            attempts += 1
            continue

        # 2. Run SQL
        try:
            df = _run_query(sql)
            break # Success, break out of retry loop
        except Exception as e:
            last_error_msg = f"SQL Execution Failed: {str(e)}\nPrevious SQL: {sql}"
            attempts += 1
            if attempts > max_retries:
                return {"error": f"SQL Error after {max_retries} retries: {str(e)}", "charts": [], "insights": insights, "sql": sql}
        
    if df.empty:
        return {
            "error": None,
            "charts": [],
            "insights": insights + "\n\nHowever, I couldn't find any data matching your request in the database.",
            "sql": sql
        }

    # 3. Generate Chart Definition
    try:
        chart_config = build_chart_config(df, chart_type)
        return {
            "error": None,
            "charts": [chart_config] if chart_config else [],
            "insights": insights,
            "sql": sql
        }
    except Exception as e:
        return {
            "error": f"Failed to process chart visualization: {str(e)}",
            "charts": [],
            "insights": insights + "\n\nData retrieved successfully, but a visualization could not be generated.",
            "sql": sql
        }
