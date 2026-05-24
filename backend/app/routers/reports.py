from fastapi import APIRouter, HTTPException, Depends
from app.services.report_service import generate_report
from app.services.evaluation_service import evaluate_answer
from app.database import get_db
from app.models.session import Session, Feedback, Answer
from app.auth.dependencies import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/reports", tags=["reports"])


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
                print(f"DB read failed: {db_err}")

        if not data:
            raise HTTPException(status_code=404, detail="Session not found")

        session = Session(**data)

        if len(session.feedbacks) == 0 and len(session.answers) > 0:
            feedbacks = []
            questions = session.questions
            answers = session.answers

            for i, answer in enumerate(answers):
                q = questions[i] if i < len(questions) else (questions[-1] if questions else None)
                if q:
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
                        print(f"Eval error for Q{i}: {eval_err}")
                        feedbacks.append(Feedback(
                            question_id=q.id,
                            correctness="Partially Correct",
                            score=5,
                            strengths=["Answer provided"],
                            weaknesses=["Could not evaluate"],
                            ideal_answer="",
                            suggestions=[],
                        ))

            session.feedbacks = feedbacks

        integrity_events = data.get("integrity_events", [])
        tab_switches = sum(1 for e in integrity_events if e.get("event_type") == "tab_switch")
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
                print(f"MLIM summary skipped: {e}")

        report = await generate_report(session)
        report.user_id = current_user["id"]
        report.mlim_summary = mlim_summary
        report.integrity_summary = {
            "integrity_score": integrity_score,
            "tab_switches": tab_switches,
            "copy_pastes": copy_pastes,
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
                    }},
                )
                existing = await db.reports.find_one({"session_id": session_id})
                if existing:
                    await db.reports.replace_one({"session_id": session_id}, report.model_dump())
                else:
                    await db.reports.insert_one(report.model_dump())
            except Exception as db_error:
                print(f"DB save skipped: {db_error}")

        return report.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
                print(f"DB read skipped: {db_error}")
        return {"sessions": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
                logger.error(f"DB read error: {db_error}")
                raise HTTPException(status_code=503, detail="Database error")
        raise HTTPException(status_code=404, detail="Report not found. Generate it first via POST /api/reports/generate/{session_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))