from app.models.session import Session, Feedback
from app.models.report import Report, CategoryScore
from app.services.groq_service import call_groq_json
from typing import List
import logging

logger = logging.getLogger(__name__)


async def generate_report(session: Session) -> Report:
    feedbacks = session.feedbacks
    if not feedbacks:
        return _empty_report(session.id)

    scores = [f.score for f in feedbacks]
    overall = round(sum(scores) / len(scores), 1) if scores else 0

    technical_feedbacks = [
        f for f, q in zip(feedbacks, session.questions)
        if str(q.category.value) == "technical"
    ]
    behavioral_feedbacks = [
        f for f, q in zip(feedbacks, session.questions)
        if str(q.category.value) in ("behavioral", "scenario")
    ]

    tech_score = _avg([f.score for f in technical_feedbacks]) if technical_feedbacks else overall
    comm_score = _avg([f.score for f in behavioral_feedbacks]) if behavioral_feedbacks else overall

    all_weaknesses = []
    for f in feedbacks:
        all_weaknesses.extend(f.weaknesses)

    prompt = f"""Based on a completed interview session, generate a performance analysis.

Job Role: {session.job_role}
Overall Score: {overall}/10
Total Questions: {len(session.questions)}
Answered Questions: {len(session.answers)}
Weaknesses identified across all answers: {', '.join(all_weaknesses[:12]) if all_weaknesses else 'None identified'}

Return ONLY valid JSON in this exact format:
{{
  "weak_areas": ["area1", "area2", "area3"],
  "recommended_topics": ["topic1", "topic2", "topic3", "topic4"],
  "suggested_improvements": ["improvement1", "improvement2", "improvement3"],
  "hiring_recommendation": "Strong Hire|Hire|Maybe|No Hire"
}}

Scoring guide for hiring_recommendation:
- Strong Hire: overall score 8.5 or above, no major weaknesses
- Hire: overall score 7.0 to 8.4, minor gaps only
- Maybe: overall score 5.0 to 6.9, some significant gaps
- No Hire: overall score below 5.0 or critical knowledge gaps for the role"""

    ai_data = await call_groq_json(prompt, max_tokens=1000)

    hiring_rec = ai_data.get("hiring_recommendation", "Maybe")
    valid_recs = {"Strong Hire", "Hire", "Maybe", "No Hire"}
    if hiring_rec not in valid_recs:
        hiring_rec = "Maybe"

    question_breakdown = []
    for q, a, f in zip(session.questions, session.answers, feedbacks):
        question_breakdown.append({
            "question": q.text,
            "category": q.category,
            "difficulty": q.difficulty,
            "answer": a.text,
            "score": f.score,
            "correctness": f.correctness,
        })

    return Report(
        session_id=session.id,
        overall_score=overall,
        category_scores=CategoryScore(
            technical_knowledge=min(tech_score, 10),
            communication=min(comm_score * 0.9 + overall * 0.1, 10),
            clarity=min(overall * 0.85 + 1.5, 10),
            confidence=min(overall * 0.8 + 2, 10),
        ),
        weak_areas=ai_data.get("weak_areas", []),
        recommended_topics=ai_data.get("recommended_topics", []),
        suggested_improvements=ai_data.get("suggested_improvements", []),
        question_breakdown=question_breakdown,
        total_questions=len(session.questions),
        completed_questions=len(session.answers),
        hiring_recommendation=hiring_rec,
    )


def _avg(nums):
    return round(sum(nums) / len(nums), 1) if nums else 0


def _empty_report(session_id):
    return Report(
        session_id=session_id,
        overall_score=0,
        category_scores=CategoryScore(
            technical_knowledge=0,
            communication=0,
            clarity=0,
            confidence=0,
        ),
        weak_areas=[],
        recommended_topics=[],
        suggested_improvements=[],
        question_breakdown=[],
        total_questions=0,
        completed_questions=0,
        hiring_recommendation=None,
    )