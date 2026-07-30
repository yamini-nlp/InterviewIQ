from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.services.groq_service import stream_groq
from app.prompts.simulator import build_simulator_prompt
from app.core import metrics
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["stream"])


async def _event_generator(
    session_id: str,
    question_index: int,
    user_id: str,
    interviewer_style: str,
    mlim_modifier: str,
    clarification_prompt: str,
):
    try:
        db = get_db()

        if db is None:
            logger.warning(f"Stream request for session {session_id}: database unavailable")
            yield f"data: {json.dumps({'type': 'error', 'message': 'Database unavailable'})}\n\n"
            return

        try:
            session = await db.sessions.find_one(
                {"id": session_id, "user_id": user_id}, {"_id": 0}
            )
        except Exception as db_error:
            metrics.record_mongo_error(operation="sessions_find_one")
            logger.error(
                f"DB read failed for session {session_id} in stream endpoint: {db_error}",
                exc_info=True,
            )
            yield f"data: {json.dumps({'type': 'error', 'message': 'Database error'})}\n\n"
            return

        if not session:
            logger.warning(f"Stream request for missing session {session_id}")
            yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
            return

        questions = session.get("questions", [])
        if question_index >= len(questions):
            logger.warning(
                f"Stream request for session {session_id}: question index "
                f"{question_index} out of range ({len(questions)} questions)"
            )
            yield f"data: {json.dumps({'type': 'error', 'message': 'Question index out of range'})}\n\n"
            return

        question = questions[question_index]
        question_text = question.get("text", "")

        answers = session.get("answers", [])
        last_answer = ""
        if answers:
            last_answer = answers[-1].get("text", "") if answers else ""

        if clarification_prompt:
            prompt = (
                f'You are a professional interviewer. The candidate answered "{last_answer}" '
                f'to the question "{question_text}".\n\n'
                f'Ask this specific clarification: "{clarification_prompt}"\n\n'
                f"Rephrase it naturally as a real interviewer would ask it. "
                f"Return ONLY the rephrased question, nothing else."
            )
        else:
            prompt = build_simulator_prompt(
                question_text,
                last_answer,
                interviewer_style,
                mlim_modifier=mlim_modifier,
            )

        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        full_text = ""
        try:
            async for chunk in stream_groq(prompt, max_tokens=160, temperature=0.5):
                full_text += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
                await asyncio.sleep(0)
        except Exception as e:
            logger.error(f"Streaming error for session {session_id}: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'An unexpected error occurred while generating the response.'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'done', 'full_text': full_text})}\n\n"
    except Exception as e:
        logger.error(f"Unhandled error in event generator for session {session_id}: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n"


@router.get("/{session_id}/stream")
async def stream_session(
    session_id: str,
    question_index: int = Query(default=0, ge=0),
    interviewer_style: str = Query(default="professional"),
    mlim_modifier: str = Query(default=""),
    clarification_prompt: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
):
    return StreamingResponse(
        _event_generator(
            session_id=session_id,
            question_index=question_index,
            user_id=current_user["id"],
            interviewer_style=interviewer_style,
            mlim_modifier=mlim_modifier,
            clarification_prompt=clarification_prompt,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )