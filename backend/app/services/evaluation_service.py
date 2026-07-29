from app.services.groq_service import call_groq_json
from app.prompts.evaluator import build_evaluation_prompt
from app.models.session import Feedback

async def evaluate_answer(question_id: str, question_text: str, category: str, difficulty: str, answer_text: str, job_role: str) -> Feedback:
    prompt = build_evaluation_prompt(question_text, category, difficulty, answer_text, job_role)
    data = await call_groq_json(prompt)
    return Feedback(
        question_id=question_id,
        correctness=data.get("correctness", "Partially Correct"),
        score=int(data.get("score", 5)),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        ideal_answer=data.get("ideal_answer", ""),
        suggestions=data.get("suggestions", []),
    )