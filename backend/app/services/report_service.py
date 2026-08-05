from app.models.session import Session, Feedback
from app.models.report import Report, CategoryScore
from app.services.groq_service import call_groq_json
from collections import Counter
import logging

logger = logging.getLogger(__name__)


async def generate_report(session: Session) -> Report:
    feedback_by_qid = {f.question_id: f for f in session.feedbacks}
    answer_by_qid = {a.question_id: a for a in session.answers}
    answered_questions = [q for q in session.questions if q.id in feedback_by_qid]

    if not answered_questions:
        return _empty_report(session)

    feedbacks = [feedback_by_qid[q.id] for q in answered_questions]

    scores = [f.score for f in feedbacks]
    overall = round(sum(scores) / len(scores), 1) if scores else 0

    technical_feedbacks = [
        feedback_by_qid[q.id] for q in answered_questions
        if str(q.category.value) == "technical"
    ]
    behavioral_feedbacks = [
        feedback_by_qid[q.id] for q in answered_questions
        if str(q.category.value) in ("behavioral", "scenario")
    ]

    tech_score = _avg([f.score for f in technical_feedbacks]) if technical_feedbacks else overall
    comm_score = _avg([f.score for f in behavioral_feedbacks]) if behavioral_feedbacks else overall

    sentiment_counts = Counter(f.sentiment for f in feedbacks if f.sentiment)
    intent_counts = Counter(f.intent for f in feedbacks if f.intent)
    dominant_sentiment = sentiment_counts.most_common(1)[0][0] if sentiment_counts else "neutral"
    dominant_intent = intent_counts.most_common(1)[0][0] if intent_counts else "not detected"

    topic_lines = []
    for q in answered_questions:
        f = feedback_by_qid[q.id]
        if f.weaknesses:
            topic_lines.append(f"- [{q.category.value}] {q.text[:80]}: {', '.join(f.weaknesses[:2])}")

    prompt = f"""Based on a completed interview session, generate a brutally honest, highly specific performance analysis.

Job Role: {session.job_role}
Overall Score: {overall}/10
Total Questions: {len(session.questions)}
Answered Questions: {len(answered_questions)}
Dominant emotional sentiment detected across answers: {dominant_sentiment} (distribution: {dict(sentiment_counts)})
Dominant intent detected across answers: {dominant_intent} (distribution: {dict(intent_counts)})
Per-question weaknesses:
{chr(10).join(topic_lines) if topic_lines else 'None identified'}

Return ONLY valid JSON in this exact format:
{{
  "weak_areas": ["Topic Name: specific gap observed", "Another Topic: specific gap observed"],
  "recommended_topics": ["topic1", "topic2", "topic3", "topic4"],
  "suggested_improvements": ["improvement1", "improvement2", "improvement3"],
  "communication_improvement": ["specific tip on verbal/written communication 1", "tip 2", "tip 3"],
  "body_language_improvement": ["specific tip on posture, eye contact, pacing, tone 1", "tip 2", "tip 3"],
  "brutal_assessment": "A short, blunt, no-fluff paragraph (4-6 sentences) telling the candidate exactly where they stand and what will actually happen in a real interview loop if nothing changes. Do not soften this unnecessarily, but stay factual and constructive.",
  "overall_sentiment": "one or two sentences describing the emotional tone of the candidate across the ENTIRE session (e.g. confidence trajectory, visible stress points, moments that looked rehearsed or evasive)",
  "overall_intent": "one or two sentences describing what the candidate's answers, taken together, suggest about their actual intent in this interview (genuinely engaging, coasting, overcompensating, testing the system, etc.)",
  "hiring_recommendation": "Strong Hire|Hire|Maybe|No Hire"
}}

The "weak_areas" list MUST be organized topic by topic (e.g. "System Design: ...", "SQL: ...", "Communication: ..."), not generic statements.

Scoring guide for hiring_recommendation:
- Strong Hire: overall score 8.5 or above, no major weaknesses
- Hire: overall score 7.0 to 8.4, minor gaps only
- Maybe: overall score 5.0 to 6.9, some significant gaps
- No Hire: overall score below 5.0 or critical knowledge gaps for the role"""

    ai_data = await call_groq_json(prompt, max_tokens=1600)

    hiring_rec = ai_data.get("hiring_recommendation", "Maybe")
    valid_recs = {"Strong Hire", "Hire", "Maybe", "No Hire"}
    if hiring_rec not in valid_recs:
        hiring_rec = "Maybe"

    question_breakdown = []
    for q in answered_questions:
        f = feedback_by_qid[q.id]
        a = answer_by_qid.get(q.id)
        question_breakdown.append({
            "question": q.text,
            "category": q.category.value,
            "difficulty": q.difficulty.value,
            "answer": a.text if a else "",
            "score": f.score,
            "correctness": f.correctness,
            "sentiment": f.sentiment,
            "intent": f.intent,
            "answer_tips": f.answer_tips,
            "ideal_answer": f.ideal_answer,
        })

    return Report(
        session_id=session.id,
        job_role=session.job_role,
        mode=str(session.mode.value) if hasattr(session.mode, "value") else str(session.mode),
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
        communication_improvement=ai_data.get("communication_improvement", []),
        body_language_improvement=ai_data.get("body_language_improvement", []),
        brutal_assessment=ai_data.get("brutal_assessment", ""),
        overall_sentiment=ai_data.get("overall_sentiment", dominant_sentiment),
        overall_intent=ai_data.get("overall_intent", dominant_intent),
        question_breakdown=question_breakdown,
        total_questions=len(session.questions),
        completed_questions=len(answered_questions),
        hiring_recommendation=hiring_rec,
    )


def _avg(nums):
    return round(sum(nums) / len(nums), 1) if nums else 0


def _empty_report(session):
    return Report(
        session_id=session.id,
        job_role=session.job_role,
        mode=str(session.mode.value) if hasattr(session.mode, "value") else str(session.mode),
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
        communication_improvement=[],
        body_language_improvement=[],
        brutal_assessment="",
        overall_sentiment="",
        overall_intent="",
        question_breakdown=[],
        total_questions=len(session.questions),
        completed_questions=0,
        hiring_recommendation=None,
    )