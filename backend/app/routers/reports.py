from fastapi import APIRouter, HTTPException, Depends, Response
from app.services.report_service import generate_report
from app.services.evaluation_service import evaluate_answer
from app.services.pdf_service import build_report_pdf
from app.database import get_db
from app.models.session import Session, Feedback, Answer
from app.auth.dependencies import get_current_user
from app.core import metrics
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])

CHEATING_EVENT_TYPES = {
    "copy_paste", "window_blur", "right_click", "devtools_open",
    "multiple_faces", "no_face", "mic_muted", "inactivity",
}


@router.post("/generate/{session_id}")
async def generate(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        data = None

        if db is not None:
            try:
                data = await db.sessions.find_one({"id": session_id, "user_id": current_user["id"]})
                if data:
                    data.pop("_id", None)
            except Exception as db_err:
                metrics.record_mongo_error(operation="sessions_find_one")
                logger.warning(f"DB read failed for session {session_id}: {db_err}")

        if not data:
            raise HTTPException(status_code=404, detail="Session not found")

        session = Session(**data)

        if len(session.feedbacks) == 0 and len(session.answers) > 0:
            feedbacks = []
            corrected_answers = []
            questions = session.questions
            answers = session.answers

            for i, answer in enumerate(answers):
                q = questions[i] if i < len(questions) else (questions[-1] if questions else None)
                if q:
                    corrected_answers.append(Answer(
                        question_id=q.id, text=answer.text, timestamp=answer.timestamp
                    ))
                    try:
                        fb = await evaluate_answer(
                            question_id=q.id,
                            question_text=q.text,
                            category=str(q.category.value),
                            difficulty=str(q.difficulty.value),
                            answer_text=answer.text,
                            job_role=session.job_role,
                        )
                        feedbacks.append(fb)
                    except Exception as eval_err:
                        logger.warning(f"Eval error for Q{i} in session {session_id}: {eval_err}")
                        feedbacks.append(Feedback(
                            question_id=q.id,
                            correctness="Partially Correct",
                            score=5,
                            strengths=["Answer provided"],
                            weaknesses=["Could not evaluate"],
                            ideal_answer="",
                            suggestions=[],
                            sentiment="neutral",
                            intent="",
                            answer_tips=[],
                        ))

            session.feedbacks = feedbacks
            session.answers = corrected_answers

        integrity_events = data.get("integrity_events", [])
        tab_switches = sum(1 for e in integrity_events if e.get("event_type") == "tab_switch")
        cheating_detection_count = sum(
            1 for e in integrity_events if e.get("event_type") in CHEATING_EVENT_TYPES
        )
        copy_pastes = sum(1 for e in integrity_events if e.get("event_type") == "copy_paste")
        total_events = len(integrity_events)
        integrity_score = max(0, 100 - (total_events * 7))

        mlim_summary = {}
        if db is not None:
            try:
                mlim_cursor = db.mlim_analyses.find(
                    {"session_id": session_id, "user_id": current_user["id"]},
                    {"_id": 0}
                ).sort("timestamp", 1)
                mlim_docs = await mlim_cursor.to_list(length=200)
                if mlim_docs:
                    entropies = [d.get("ifl", {}).get("entropy", 0) for d in mlim_docs]
                    stress_vals = [d.get("gstl", {}).get("stress_indicators", 0) for d in mlim_docs]
                    engage_vals = [d.get("gstl", {}).get("engagement_level", 0) for d in mlim_docs]
                    last_gstl = mlim_docs[-1].get("gstl", {})
                    mlim_summary = {
                        "total_analyses": len(mlim_docs),
                        "average_entropy": round(sum(entropies) / len(entropies), 3),
                        "average_stress": round(sum(stress_vals) / len(stress_vals), 3),
                        "average_engagement": round(sum(engage_vals) / len(engage_vals), 3),
                        "session_trajectory": last_gstl.get("session_trajectory", "insufficient_data"),
                        "readiness_estimate": last_gstl.get("readiness_estimate", 0.5),
                        "goal_drift_count": sum(1 for d in mlim_docs if d.get("gstl", {}).get("goal_drift_detected")),
                        "affective_masking_count": sum(1 for d in mlim_docs if d.get("asl", {}).get("affective_masking_detected")),
                        "sarcasm_count": sum(1 for d in mlim_docs if d.get("pel", {}).get("sarcasm_detected")),
                    }
            except Exception as e:
                metrics.record_mongo_error(operation="mlim_analyses_find")
                logger.warning(f"MLIM summary skipped for session {session_id}: {e}")

        report = await generate_report(session)
        report.user_id = current_user["id"]
        report.mlim_summary = mlim_summary
        report.integrity_summary = {
            "integrity_score": integrity_score,
            "tab_switches": tab_switches,
            "copy_pastes": copy_pastes,
            "cheating_detection_count": cheating_detection_count,
            "total_violations": total_events,
        }

        if db is not None:
            try:
                await db.sessions.update_one(
                    {"id": session_id, "user_id": current_user["id"]},
                    {"$set": {
                        "overall_score": report.overall_score,
                        "completed_at": datetime.utcnow().isoformat(),
                        "feedbacks": [f.model_dump() for f in session.feedbacks],
                        "answers": [a.model_dump() for a in session.answers],
                    }},
                )
                existing = await db.reports.find_one({"session_id": session_id, "user_id": current_user["id"]})
                if existing:
                    await db.reports.replace_one(
                        {"session_id": session_id, "user_id": current_user["id"]},
                        report.model_dump(),
                    )
                else:
                    await db.reports.insert_one(report.model_dump())
            except Exception as db_error:
                metrics.record_mongo_error(operation="reports_save")
                logger.warning(f"DB save skipped for report {session_id}: {db_error}")

        return report.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/reports/generate/{session_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


@router.get("/sessions/all")
async def get_sessions(current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is not None:
            try:
                cursor = db.sessions.find(
                    {"user_id": current_user["id"]},
                    {"_id": 0, "questions": 0, "answers": 0, "feedbacks": 0, "integrity_events": 0}
                ).sort("created_at", -1).limit(50)
                sessions = await cursor.to_list(length=50)
                return {"sessions": sessions}
            except Exception as db_error:
                metrics.record_mongo_error(operation="sessions_list")
                logger.warning(f"DB read skipped for sessions list: {db_error}")
        return {"sessions": []}
    except Exception as e:
        logger.error(
            f"Unhandled error in GET /api/reports/sessions/all for user "
            f"{current_user['id']}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


@router.get("/{session_id}/pdf")
async def get_report_pdf(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        data = None
        try:
            data = await db.reports.find_one(
                {"session_id": session_id, "user_id": current_user["id"]},
                {"_id": 0}
            )
        except Exception as db_error:
            metrics.record_mongo_error(operation="reports_find_one")
            logger.error(f"DB read error for report pdf {session_id}: {db_error}", exc_info=True)
            raise HTTPException(status_code=503, detail="Database error")

        if not data:
            raise HTTPException(
                status_code=404,
                detail="Report not found. Generate it first via POST /api/reports/generate/{session_id}",
            )

        try:
            pdf_bytes = build_report_pdf(data)
        except Exception as pdf_error:
            logger.error(f"PDF generation failed for report {session_id}: {pdf_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Could not generate the PDF report.")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="InterviewIQ_Report_{session_id}.pdf"'
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in GET /api/reports/{session_id}/pdf: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


@router.get("/{session_id}")
async def get_report(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is not None:
            try:
                data = await db.reports.find_one(
                    {"session_id": session_id, "user_id": current_user["id"]},
                    {"_id": 0}
                )
                if data:
                    return data
            except Exception as db_error:
                metrics.record_mongo_error(operation="reports_find_one")
                logger.error(f"DB read error for report {session_id}: {db_error}", exc_info=True)
                raise HTTPException(status_code=503, detail="Database error")
        raise HTTPException(status_code=404, detail="Report not found. Generate it first via POST /api/reports/generate/{session_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in GET /api/reports/{session_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )