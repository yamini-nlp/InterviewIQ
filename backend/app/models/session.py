from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
import uuid

class QuestionCategory(str, Enum):
    technical = "technical"
    behavioral = "behavioral"
    scenario = "scenario"

class DifficultyLevel(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"

class SessionMode(str, Enum):
    practice = "practice"
    simulation = "simulation"

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    category: QuestionCategory
    difficulty: DifficultyLevel
    expected_topics: List[str] = []

class Answer(BaseModel):
    question_id: str
    text: str
    timestamp: Optional[str] = None

class Feedback(BaseModel):
    question_id: str
    correctness: str
    score: int
    strengths: List[str] = []
    weaknesses: List[str] = []
    ideal_answer: str = ""
    suggestions: List[str] = []

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_role: str
    job_description: str = ""
    mode: SessionMode = SessionMode.practice
    questions: List[Question] = []
    answers: List[Answer] = []
    feedbacks: List[Feedback] = []
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())