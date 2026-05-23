from pydantic import BaseModel
from typing import Optional

class GenerateQuestionsRequest(BaseModel):
    job_role: str
    job_description: str
    resume_text: Optional[str] = None
    num_technical: int = 4
    num_behavioral: int = 3
    num_scenario: int = 3

class EvaluateAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    question_text: str
    question_category: str
    question_difficulty: str
    answer_text: str
    job_role: str

class SimulateRequest(BaseModel):
    session_id: str
    question_text: str
    answer_text: str
    interviewer_style: str = "professional"