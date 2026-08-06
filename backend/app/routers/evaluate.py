from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import logging

from app.services.evaluation_service import evaluate_answer
from app.models.session import Answer
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.core import metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evaluate", tags=["evaluate"])


class EvaluateRequest(BaseModel):
    session_id: str
    question_id: str
    question_text: str
    question_category: str
    question_difficulty: str
    answer_text: str
    job_role: str


async def _upsert_answer(db, session_id: str, user_id: str, answer: dict) -> None:
    result = await db.sessions.update_one(
        {
            "id": session_id,
            "user_id": user_id,
            "answers.question_id": answer["question_id"],
        },
        {"$set": {"answers.$[el]": answer}},
        array_filters=[{"el.question_id": answer["question_id"]}],
    )
    if result.matched_count == 0:
        await db.sessions.update_one(
            {"id": session_id, "user_id": user_id},
            {"$push": {"answers": answer}},
        )


async def _upsert_feedback(db, session_id: str, user_id: str, feedback: dict) -> None:
    result = await db.sessions.update_one(
        {
            "id": session_id,
            "user_id": user_id,
            "feedbacks.question_id": feedback["question_id"],
        },
        {"$set": {"feedbacks.$[el]": feedback}},
        array_filters=[{"el.question_id": feedback["question_id"]}],
    )
    if result.matched_count == 0:
        await db.sessions.update_one(
            {"id": session_id, "user_id": user_id},
            {"$push": {"feedbacks": feedback}},
        )


@router.post("/answer")
async def evaluate(request: EvaluateRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()

    if db is not None:
        try:
            session = await db.sessions.find_one({"id": request.session_id})
        except Exception as db_error:
            metrics.record_mongo_error(operation="sessions_find_one")
            logger.error(
                f"DB read failed for session {request.session_id}: {db_error}",
                exc_info=True,
            )
            raise HTTPException(status_code=503, detail="Database error")
        if session and session.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        feedback = await evaluate_answer(
            question_id=request.question_id,
            question_text=request.question_text,
            category=request.question_category,
            difficulty=request.question_difficulty,
            answer_text=request.answer_text,
            job_role=request.job_role,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/evaluate/answer for session "
            f"{request.session_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="Couldn't generate feedback. Please try again."
        )

    answer = Answer(
        question_id=request.question_id,
        text=request.answer_text,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    if db is not None:
        try:
            await _upsert_answer(db, request.session_id, current_user["id"], answer.model_dump())
            await _upsert_feedback(
                db, request.session_id, current_user["id"], feedback.model_dump()
            )
        except Exception as db_error:
            metrics.record_mongo_error(operation="sessions_update")
            logger.warning(f"DB save skipped for session {request.session_id}: {db_error}")

    return feedback.model_dump()