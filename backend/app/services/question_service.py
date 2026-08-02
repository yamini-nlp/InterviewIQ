from app.services.groq_service import call_groq_json
from app.prompts.question_gen import build_question_gen_prompt
from app.models.session import Question, QuestionCategory, DifficultyLevel
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

CATEGORY_ALIASES = {
    "coding": "technical", "algorithm": "technical", "algorithms": "technical",
    "system design": "technical", "domain": "technical",
    "situational": "scenario", "hypothetical": "scenario",
    "soft skills": "behavioral", "teamwork": "behavioral", "star": "behavioral",
}

DIFFICULTY_ALIASES = {
    "simple": "easy", "beginner": "easy",
    "intermediate": "medium", "moderate": "medium",
    "advanced": "hard", "difficult": "hard", "expert": "hard",
}


def _coerce_category(raw: str) -> QuestionCategory:
    key = (raw or "").strip().lower()
    key = CATEGORY_ALIASES.get(key, key)
    try:
        return QuestionCategory(key)
    except ValueError:
        return QuestionCategory.technical


def _coerce_difficulty(raw: str) -> DifficultyLevel:
    key = (raw or "").strip().lower()
    key = DIFFICULTY_ALIASES.get(key, key)
    try:
        return DifficultyLevel(key)
    except ValueError:
        return DifficultyLevel.medium


async def generate_questions(job_role: str, job_description: str, resume_text: Optional[str] = None, num_technical: int = 4, num_behavioral: int = 3, num_scenario: int = 3) -> List[Question]:
    prompt = build_question_gen_prompt(job_role, job_description, resume_text, num_technical, num_behavioral, num_scenario)
    data = await call_groq_json(prompt, max_tokens=5000)
    questions = []
    for i, q in enumerate(data.get("questions", [])):
        text = q.get("text")
        if not text:
            logger.warning(f"Skipping question {i} with no text: {q}")
            continue
        questions.append(Question(
            id=q.get("id", f"q{i+1}"),
            text=text,
            category=_coerce_category(q.get("category", "technical")),
            difficulty=_coerce_difficulty(q.get("difficulty", "medium")),
            expected_topics=q.get("expected_topics", []),
        ))
    if not questions:
        raise ValueError("No valid questions were generated")
    return questions