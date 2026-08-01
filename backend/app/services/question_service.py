from app.services.groq_service import call_groq_json
from app.prompts.question_gen import build_question_gen_prompt
from app.models.session import Question, QuestionCategory, DifficultyLevel
from typing import List, Optional
import uuid

async def generate_questions(job_role: str, job_description: str, resume_text: Optional[str] = None, num_technical: int = 4, num_behavioral: int = 3, num_scenario: int = 3) -> List[Question]:
    prompt = build_question_gen_prompt(job_role, job_description, resume_text, num_technical, num_behavioral, num_scenario)
    data = await call_groq_json(prompt, max_tokens=5000)
    questions = []
    for i, q in enumerate(data.get("questions", [])):
        questions.append(Question(
            id=q.get("id", f"q{i+1}"),
            text=q["text"],
            category=QuestionCategory(q.get("category", "technical")),
            difficulty=DifficultyLevel(q.get("difficulty", "medium")),
            expected_topics=q.get("expected_topics", []),
        ))
    return questions