from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChartData(BaseModel):
    data: List[Dict[str, Any]]
    layout: Dict[str, Any]

class ChatResponse(BaseModel):
    charts: List[ChartData]
    insights: str
    sql: str
    error: Optional[str] = None

class UploadResponse(BaseModel):
    session_id: str
    filename: str
    dataset_name: str
    rows: int
    columns: List[str]
    message: str
