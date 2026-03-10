from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import ChatRequest, ChatResponse, ChartData
from agent import process_user_query

app = FastAPI(title="Orbit-Ai BI Dashboard API")

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    try:
        result = process_user_query(request.message)
        
        if result.get("error"):
            # We can still return what we have along with the error
            return ChatResponse(
                charts=[],
                insights=result.get("insights", ""),
                sql=result.get("sql", ""),
                error=result["error"]
            )
        
        charts_data = []
        for chart in result.get("charts", []):
            charts_data.append(ChartData(
                data=chart.get("data", []),
                layout=chart.get("layout", {})
            ))
            
        return ChatResponse(
            charts=charts_data,
            insights=result.get("insights", ""),
            sql=result.get("sql", ""),
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
