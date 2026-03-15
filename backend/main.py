from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from models import ChatRequest, ChatResponse, ChartData, UploadResponse
from agent import process_user_query, DEFAULT_DB_PATH, DEFAULT_DATASET_NAME, analyze_csv_schema
import pandas as pd
import tempfile
import os
import uuid
import io
import sqlite3
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

load_dotenv()

# Set up logging for deployment visibility
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# The persistent database file that will hold our default sales table
DEFAULT_DB_PATH = "sales.db"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup event: Ensure the default SQLite database exists.
    Instead of recreating it from CSV every time, we just verify the existing sales.db.
    """
    try:
        if not os.path.exists(DEFAULT_DB_PATH):
            raise RuntimeError(f"Startup Error: Default database '{DEFAULT_DB_PATH}' not found! Stopping startup.")
            
        logger.info(f"Verifying existing database '{DEFAULT_DB_PATH}'...")
        
        conn = sqlite3.connect(DEFAULT_DB_PATH, check_same_thread=False)
        cursor = conn.cursor()
        
        # Verify the table exists and check its columns
        cursor.execute("PRAGMA table_info(sales)")
        created_cols = [row[1] for row in cursor.fetchall()]
        
        if not created_cols:
            raise RuntimeError(f"Startup Error: 'sales' table is missing or empty in '{DEFAULT_DB_PATH}'.")
            
        logger.info(f"Verified SQLite table 'sales' exists with columns: {created_cols}")
        conn.close()
            
    except Exception as e:
        logger.error(f"Failed to initialize database on startup: {str(e)}")
        raise e # Re-raise to cleanly crash the worker if DB is missing

    yield  # Yield control back to FastAPI to start accepting requests

app = FastAPI(title="Orbit AI BI Dashboard API", lifespan=lifespan)

# setup cors for local next.js client and production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orbit-ai-olive.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# hold temp db states for csv uploads (session_id -> db info)
# TODO: migrate to redis for prod
SESSION_STORE: dict[str, dict] = {}


@app.get("/health")
def health_check():
    """
    Simple health check endpoint to warm up the server on cloud platforms
    and verify the API is running correctly.
    """
    return {"status": "ok"}


@app.get("/tables")
def list_tables():
    """
    Diagnostic endpoint to list available tables and default schema.
    """
    return {
        "tables": ["sales", "data"],
        "default_db": DEFAULT_DB_PATH
    }


@app.get("/schema")
def schema_endpoint():
    """
    Diagnostic endpoint to list column names via dynamic schema extractor.
    """
    from agent import get_sqlite_schema
    try:
        return {"schema": get_sqlite_schema(DEFAULT_DB_PATH, "sales")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
        
@app.get("/debug-columns")
def debug_columns():
    """
    Diagnostic endpoint to inspect the exact column names currently active in the default database.
    """
    try:
        conn = sqlite3.connect(DEFAULT_DB_PATH, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(sales)")
        columns = [row[1] for row in cursor.fetchall()]
        conn.close()
        return {"table": "sales", "columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    try:
        # fallback to static db if no session
        db_path = DEFAULT_DB_PATH
        schema = None 
        conn = None

        # load csv session db
        if request.session_id and request.session_id in SESSION_STORE:
            session = SESSION_STORE[request.session_id]
            conn = session.get("conn")
            db_path = session.get("db_path", db_path) # Fallback to path if conn missing
            schema = session["schema"]

        # generate sql & insights
        result = process_user_query(request.message, db_path=db_path, schema=schema, conn=conn)

        if result.get("error"):
            return ChatResponse(
                charts=[], insights=result.get("insights", ""),
                sql=result.get("sql", ""), error=result["error"]
            )

        charts_data = [
            ChartData(data=c.get("data", []), layout=c.get("layout", {}))
            for c in result.get("charts", [])
        ]
        return ChatResponse(
            charts=charts_data, insights=result.get("insights", ""),
            sql=result.get("sql", ""), error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload-csv", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)) -> UploadResponse:
    """
    1. Read uploaded CSV directly into memory (zero disk IO required).
    2. Build schema string purely from pandas introspection.
    3. Load into a persistent in-memory SQLite DB.
    4. If ENVIRONMENT=development, optionally save to `uploads/` for debugging.
    """
    # ensure valid csv
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    try:
        contents = await file.read()

        # Encoding fallback chain — handles UTF-8, Excel exports (latin-1/cp1252), etc.
        df = None
        for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252", "iso-8859-1"):
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding=encoding)
                break
            except (UnicodeDecodeError, Exception):
                continue

        if df is None:
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding="utf-8", errors="replace")
            except Exception:
                raise HTTPException(status_code=400, detail="Could not parse file as CSV. Please check the file format.")

        assert df is not None

        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

        # Dev mode file physical save (for debugging raw user files)
        environment = os.getenv("ENVIRONMENT", "production")
        if environment == "development":
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            safe_filename = file.filename or "unknown.csv"
            save_path = os.path.join(upload_dir, safe_filename)
            try:
                # Need to write contents since we already read it
                with open(save_path, "wb") as f:
                    f.write(contents)
                logger.info(f"Dev mode: Saved uploaded file to {save_path}")
            except Exception as e:
                logger.warning(f"Dev mode: Failed to save file to uploads: {str(e)}")

        # Drop entirely empty unnamed columns pandas sometimes picks up from trailing commas
        df = df.loc[:, ~df.columns.str.contains('^Unnamed')]

        # clean column spaces/dashes and remove any weird hidden binary characters
        # making sure it is safe for SQLite queries
        clean_cols = []
        for c in df.columns:
            # Keep only alphanumeric chars, replace everything else with underscore
            sanitized = "".join(ch if ch.isalnum() else "_" for ch in str(c))
            # Collapse multiple underscores and trim
            import re
            sanitized = re.sub(r'_+', '_', sanitized).strip('_').lower()
            clean_cols.append(sanitized if sanitized else "column")
            
        df.columns = clean_cols

        # dump schema string via simple pandas eval (no llm roundtrip needed yet)
        table_name = "data"
        schema = analyze_csv_schema(df, table_name)

        # Connect to ephemeral in-memory sqlite instance
        # check_same_thread=False allows background FastAPI threads to share it
        conn = sqlite3.connect(":memory:", check_same_thread=False)
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        
        # We DO NOT close this connection, otherwise the :memory: db vanishes.
        # We store the connection itself in the session dict so the agent can query it later.

        # Register session
        session_id = str(uuid.uuid4())
        dataset_name = os.path.splitext(file.filename)[0]  # filename without extension
        SESSION_STORE[session_id] = {
            "conn": conn,
            "schema": schema,
            "dataset_name": dataset_name,
        }

        col_preview = ", ".join(df.columns.tolist()[:8])
        if len(df.columns) > 8:
            col_preview += f" … +{len(df.columns) - 8} more"

        return UploadResponse(
            session_id=session_id,
            filename=file.filename,
            dataset_name=dataset_name,
            rows=len(df),
            columns=df.columns.tolist(),
            message=(
                f"✅ **{file.filename}** loaded — **{len(df):,} rows**, **{len(df.columns)} columns**.\n\n"
                f"Columns: `{col_preview}`\n\nYou can now ask questions about this dataset!"
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
