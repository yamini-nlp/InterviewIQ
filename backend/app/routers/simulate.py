from fastapi import APIRouter, HTTPException, Depends
from app.services.groq_service import call_groq
from app.prompts.simulator import build_simulator_prompt
from app.models.session import Answer
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.core import metrics
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


class SimulateRequest(BaseModel):
    session_id: str
    question_id: Optional[str] = None
    question_text: str
    answer_text: str
    interviewer_style: str = "professional"
    mlim_modifier: Optional[str] = None
    clarification_prompt: Optional[str] = None


async def _upsert_answer(db, session_id: str, user_id: str, answer: dict):
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


@router.post("/respond")
async def respond(request: SimulateRequest, current_user: dict = Depends(get_current_user)):
    try:
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

        if request.clarification_prompt:
            prompt = f"""You are a professional interviewer. The candidate answered "{request.answer_text}" to the question "{request.question_text}".

Ask this specific clarification: "{request.clarification_prompt}"

Rephrase it naturally as a real interviewer would ask it. Return ONLY the rephrased question, nothing else."""
        else:
            prompt = build_simulator_prompt(
                request.question_text,
                request.answer_text,
                request.interviewer_style,
                mlim_modifier=request.mlim_modifier or "",
            )

        response = await call_groq(prompt, max_tokens=120, temperature=0.5)

        answer = Answer(question_id=request.question_id or "sim", text=request.answer_text)
        if db is not None:
            try:
                await _upsert_answer(db, request.session_id, current_user["id"], answer.model_dump())
            except Exception as db_error:
                metrics.record_mongo_error(operation="sessions_update")
                logger.warning(f"DB save skipped for session {request.session_id}: {db_error}")

        return {"response": response.strip()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/simulate/respond for session "
            f"{request.session_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )