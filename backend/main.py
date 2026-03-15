from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from models import ChatRequest, ChatResponse, ChartData, UploadResponse
from agent import process_user_query, DEFAULT_DB_PATH, DEFAULT_DATASET_NAME, analyze_csv_schema
import io
import sqlite3
import pandas as pd
import tempfile
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Orbit AI BI Dashboard API")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# setup cors for local next.js client and production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
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


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    try:
        # fallback to static db if no session
        db_path = DEFAULT_DB_PATH
        schema = None 

        # load csv session db
        if request.session_id and request.session_id in SESSION_STORE:
            session = SESSION_STORE[request.session_id]
            db_path = session["db_path"]
            schema = session["schema"]

        # generate sql & insights
        result = process_user_query(request.message, db_path=db_path, schema=schema)

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
    1. Read uploaded CSV with encoding auto-detection
    2. Build schema string using pure Python (no LLM call — fast and free)
    3. Load into temporary SQLite DB
    4. Return session_id + metadata for the frontend dataset selector
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

        # Reject binary files masked as .csv (bplist/webloc etc.)
        def _is_readable(name: str) -> bool:
            return all(c.isprintable() or c in (" ", "\t") for c in str(name))

        if not all(_is_readable(c) for c in df.columns):
            raise HTTPException(
                status_code=400,
                detail="This doesn't look like a valid CSV — column headers contain binary/non-printable data. Please export a plain-text CSV from Excel, Google Sheets, or pandas."
            )

        # clean column spaces/dashes before sql load
        df.columns = [c.strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns]

        # dump schema string via simple pandas eval (no llm roundtrip needed yet)
        table_name = "data"
        schema = analyze_csv_schema(df, table_name)

        # setup isolated sqlite instance for this session
        db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        db_path = db_file.name
        db_file.close()

        conn = sqlite3.connect(db_path)
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        conn.close()

        # Register session
        session_id = str(uuid.uuid4())
        dataset_name = os.path.splitext(file.filename)[0]  # filename without extension
        SESSION_STORE[session_id] = {
            "db_path": db_path,
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
