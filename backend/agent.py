import os
import sqlite3
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

# Configure Ollama
OLLAMA_API_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5-coder:7b"

def query_ollama(prompt: str) -> str:
    """Helper function to run inference against local Ollama instance."""
    try:
        response = requests.post(
            OLLAMA_API_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=120 # Add a timeout in case the server hangs
        )
        response.raise_for_status()
        return response.json().get("response", "")
    except requests.exceptions.ConnectionError:
        raise Exception("Failed to connect to Ollama. Is the server running locally at http://localhost:11434?")
    except Exception as e:
        raise Exception(f"Ollama API error: {str(e)}")

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
    
def process_user_query(message: str) -> dict:
    """
    Core AI logic:
    1. Translate message to SQL.
    2. Run SQL and get DataFrame.
    3. Generate Plotly JSON from data.
    4. Generate insights.
    """
    schema = get_schema()
    
    # 1. Generate SQL
    prompt_sql = f"""
    You are a data analyst. Convert the following user question into a SQL query for the `sales` table.
    Respond ONLY with the raw SQL code, nothing else, no markdown block.
    
    {schema}
    
    Question: {message}
    """
    
    try:
        sql = query_ollama(prompt_sql)
        sql = sql.strip().removeprefix("```sql").removesuffix("```").strip()
    except Exception as e:
        return {"error": f"Failed to generate SQL: {str(e)}", "charts": [], "insights": "", "sql": ""}

    # 2. Run SQL
    try:
        df = _run_query(sql)
    except Exception as e:
        return {"error": f"SQL Error: {str(e)}", "charts": [], "insights": "", "sql": sql}
        
    if df.empty:
        return {
            "error": None,
            "charts": [],
            "insights": "I couldn't find any data matching your request.",
            "sql": sql
        }

    # 3 & 4. Generate Plotly config and Insights
    # We serialize a preview of the dataframe to pass to Gemini
    data_preview = df.head(10).to_csv(index=False)
    
    prompt_viz_insights = f"""
    You are an expert business intelligence advisor.
    The user asked: "{message}"
    The resulting SQL query was:
    {sql}
    
    Here is a sample of the resulting data:
    {data_preview}
    
    Perform two tasks and return the result strictly as a valid JSON object.
    Do NOT wrap it in ```json. Just raw parsable JSON.
    
    Task 1: Generate a 'charts' array. Each item should have 'data' and 'layout' suitable for Plotly.js. 
    Usually a single chart is enough. Choose the best chart type (bar, line, pie) based on the data.
    
    Task 2: Generate an 'insights' string (markdown format). Provide brief, impactful business insights summarizing the data.
    Highlight top performers or key trends.
    
    JSON Format:
    {{
      "charts": [
        {{ "data": [ ...plotly data array... ], "layout": {{ ...plotly layout object... }} }}
      ],
      "insights": "Your markdown business summary here."
    }}
    """
    
    try:
        json_str = query_ollama(prompt_viz_insights)
        json_str = json_str.strip().removeprefix("```json").removesuffix("```").strip()
        import json
        result = json.loads(json_str)
        return {
            "error": None,
            "charts": result.get("charts", []),
            "insights": result.get("insights", "No insights generated."),
            "sql": sql
        }
    except Exception as e:
        return {
            "error": f"Failed to process chart and insights: {str(e)}",
            "charts": [],
            "insights": "The data was retrieved successfully, but there was an error generating the visualization.",
            "sql": sql
        }
