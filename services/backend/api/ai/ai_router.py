"""
AI Router for EnergyLink
API endpoints for AI-powered features
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from .simple_ai_service import simple_ai_service

# Force using SimpleAI instead of Ollama
# from .hybrid_ai_service import hybrid_ai_service

router = APIRouter(prefix="/api/ai", tags=["AI"])

class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None
    context: Optional[str] = ""
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    timestamp: str
    model: str
    session_id: str

class AnalysisRequest(BaseModel):
    project_id: str
    days: int = 7

class PredictionRequest(BaseModel):
    project_id: str
    hours_ahead: int = 24

class AnomalyRequest(BaseModel):
    project_id: str
    hours: int = 24

class FeedbackRequest(BaseModel):
    interaction_id: int
    feedback: int  # 1: good, 0: neutral, -1: bad

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(request: ChatRequest):
    """Chat with AI assistant - Free Local AI"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    # Generate session ID if not provided
    session_id = request.session_id or str(uuid.uuid4())
    
    # Get project context if project_id provided
    context = request.context
    if request.project_id:
        data = simple_ai_service._get_energy_data(request.project_id, days=1)
        if data:
            context += "\n\nCurrent System Status:\n"
            context += simple_ai_service._create_data_summary(data)
    
    response = simple_ai_service.generate_response(
        request.message, 
        context, 
        request.project_id,
        session_id
    )
    
    return ChatResponse(
        response=response,
        timestamp=datetime.now().isoformat(),
        model=simple_ai_service.model_name,
        session_id=session_id
    )

@router.post("/analyze")
async def analyze_energy(request: AnalysisRequest):
    """Analyze energy usage patterns"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    analysis = simple_ai_service.analyze_energy_pattern(request.project_id, request.days)
    return analysis

@router.post("/predict")
async def predict_usage(request: PredictionRequest):
    """Predict energy usage"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    predictions = simple_ai_service.predict_energy_usage(request.project_id, request.hours_ahead)
    return predictions

@router.post("/anomalies")
async def detect_anomalies(request: AnomalyRequest):
    """Detect energy usage anomalies"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    anomalies = simple_ai_service.detect_anomalies(request.project_id, request.hours)
    return {"anomalies": anomalies, "count": len(anomalies)}

@router.get("/recommendations/{project_id}")
async def get_recommendations(project_id: str):
    """Get energy saving recommendations"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    recommendations = simple_ai_service.get_recommendations(project_id)
    return {"recommendations": recommendations}

@router.get("/status")
async def ai_status():
    """Check AI service status"""
    return {
        "available": simple_ai_service.is_available(),
        "model": simple_ai_service.model_name,
        "service": "SimpleAI-Free",
        "learning_enabled": False,
        "cost": "Free"
    }

@router.get("/models")
async def list_models():
    """List available AI models"""
    return {
        "models": [
            {
                "name": "SimpleAI-Free",
                "size": "0MB",
                "description": "Free rule-based AI for EnergyLink",
                "status": "available"
            }
        ]
    }

@router.post("/feedback")
async def record_feedback(request: FeedbackRequest):
    """Record user feedback for AI learning"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    simple_ai_service.record_feedback("", request.interaction_id, request.feedback)
    return {"status": "feedback recorded"}

@router.get("/learning/{project_id}")
async def get_learning_insights(project_id: str):
    """Get insights about what AI has learned"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    insights = simple_ai_service.get_learning_insights(project_id)
    return insights

@router.post("/learn/{project_id}")
async def trigger_learning(project_id: str):
    """Trigger learning cycle for a project"""
    if not simple_ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")
    
    simple_ai_service.trigger_learning_cycle(project_id)
    return {"status": "learning cycle triggered"}

