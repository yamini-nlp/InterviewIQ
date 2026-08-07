from pydantic import BaseModel, Field
from typing import Optional

class GenerateQuestionsRequest(BaseModel):
    job_role: str = Field(..., max_length=200)
    job_description: str = Field(..., max_length=10000)
    resume_text: Optional[str] = Field(None, max_length=5000)
    mode: str = Field("practice", max_length=20)
    num_technical: int = 4
    num_behavioral: int = 3
    num_scenario: int = 3

class EvaluateAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    question_text: str = Field(..., max_length=2000)
    question_category: str
    question_difficulty: str
    answer_text: str = Field(..., max_length=5000)
    job_role: str = Field(..., max_length=200)