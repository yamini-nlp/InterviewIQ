from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from app.models.question import GenerateQuestionsRequest
from app.services.question_service import generate_questions
from app.services.groq_service import transcribe_audio
from app.database import get_db
from app.models.session import SessionMode
from app.auth.dependencies import get_current_user
from app.core import metrics
from datetime import datetime
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.post("/generate")
async def generate(request: GenerateQuestionsRequest, current_user: dict = Depends(get_current_user)):
    try:
        questions = await generate_questions(
            request.job_role,
            request.job_description,
            request.resume_text,
            request.num_technical,
            request.num_behavioral,
            request.num_scenario,
        )
        session_id = str(uuid.uuid4())
        session_data = {
            "id": session_id,
            "user_id": current_user["id"],
            "job_role": request.job_role,
            "job_description": request.job_description,
            "resume_text": request.resume_text or "",
            "mode": SessionMode.practice.value,
            "questions": [q.model_dump() for q in questions],
            "answers": [],
            "feedbacks": [],
            "integrity_events": [],
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "overall_score": None,
        }
        try:
            db = get_db()
            if db is not None:
                await db.sessions.insert_one(session_data.copy())
        except Exception as db_error:
            metrics.record_mongo_error(operation="sessions_insert")
            logger.warning(f"DB save skipped for session {session_id}: {db_error}")

        return {"session_id": session_id, "questions": [q.model_dump() for q in questions]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/questions/generate: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        audio_bytes = await audio.read()
        text = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
        return {"transcript": text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/questions/transcribe: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )