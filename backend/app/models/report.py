from pydantic import BaseModel
from typing import List, Dict, Any

class CategoryScore(BaseModel):
    technical_knowledge: float
    communication: float
    clarity: float
    confidence: float

class Report(BaseModel):
    session_id: str
    overall_score: float
    category_scores: CategoryScore
    weak_areas: List[str] = []
    recommended_topics: List[str] = []
    suggested_improvements: List[str] = []
    question_breakdown: List[Dict[str, Any]] = []
    total_questions: int = 0
    completed_questions: int = 0