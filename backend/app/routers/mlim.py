from fastapi import APIRouter, HTTPException, Depends
from app.models.mlim import (
    MLIMAnalyzeRequest, MLIMAnalysis, MLIMSessionSummary,
    GoalState, InteractionEntry, MIComparisonResult,
    EscalationRecord, EscalationUpdateRequest,
)
from app.services.mlim_service import run_mlim_pipeline
from app.services.mlim.benchmark import compute_mi_comparison
from app.services.mlim.escalation import evaluate_escalation
from app.services.privacy_service import add_laplace_noise
from app.auth.dependencies import get_current_user
from app.database import get_db
from typing import Dict, List, Optional
from collections import defaultdict
import datetime

router = APIRouter(prefix="/api/mlim", tags=["mlim"])

MIN_MI_SAMPLE_SIZE = 5


def _parse_mlim_analyses(raw_analyses: List[dict]) -> List[MLIMAnalysis]:
    parsed: List[MLIMAnalysis] = []
    for raw in raw_analyses:
        try:
            parsed.append(MLIMAnalysis.model_validate(raw))
        except Exception:
            continue
    return parsed

@router.post("/analyze")
async def analyze(request: MLIMAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        belief_history: List[Dict[str, float]] = []
        if db is not None:
            session = await db.sessions.find_one({"id": request.session_id})
            if session and session.get("user_id") != current_user["id"]:
                raise HTTPException(status_code=403, detail="Access denied")
            if session:
                belief_history = session.get("goal_belief_history", []) or []

        result = await run_mlim_pipeline(
            utterance=request.answer_text,
            question_text=request.question_text,
            job_role=request.job_role,
            session_id=request.session_id,
            context_utterances=request.context_utterances,
            interaction_history=request.interaction_history,
            prior_goal_state=request.prior_goal_state,
            face_snapshot=request.face_snapshot,
            voice_features=request.voice_features,
            belief_history=belief_history,
        )

        escalation_record: Optional[EscalationRecord] = evaluate_escalation(result)
        if escalation_record is not None:
            escalation_record.user_id = current_user["id"]

        if db is not None:
            doc = result.model_dump()
            doc["user_id"] = current_user["id"]
            if doc.get("timestamp") and hasattr(doc["timestamp"], "isoformat"):
                doc["timestamp"] = doc["timestamp"].isoformat()
            await db.mlim_analyses.insert_one(doc)

            if session:
                updated_history = (belief_history + [result.gstl.goal_belief_distribution])[-50:]
                await db.sessions.update_one(
                    {"id": request.session_id},
                    {"$set": {"goal_belief_history": updated_history}},
                )

            if escalation_record is not None:
                escalation_doc = escalation_record.model_dump()
                if escalation_doc.get("created_at") and hasattr(escalation_doc["created_at"], "isoformat"):
                    escalation_doc["created_at"] = escalation_doc["created_at"].isoformat()
                if escalation_doc.get("reviewed_at") and hasattr(escalation_doc["reviewed_at"], "isoformat"):
                    escalation_doc["reviewed_at"] = escalation_doc["reviewed_at"].isoformat()
                await db.mlim_escalations.insert_one(escalation_doc)

        response = result.model_dump()
        response["escalation"] = escalation_record.model_dump() if escalation_record is not None else None
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/summary")
async def session_summary(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        analyses = []
        if db is not None:
            cursor = db.mlim_analyses.find(
                {"session_id": session_id, "user_id": current_user["id"]},
                {"_id": 0}
            ).sort("timestamp", 1)
            analyses = await cursor.to_list(length=200)
        
        if not analyses:
            raise HTTPException(status_code=404, detail="No MLIM analyses found for this session")

        intent_counts: Dict[str, float] = defaultdict(float)
        failure_modes = []
        entropies = []
        recommended_actions = []
        stress_values = []
        engagement_values = []
        goal_drift_count = 0
        masking_count = 0
        sarcasm_count = 0

        for a in analyses:
            ifl = a.get("ifl", {})
            asl = a.get("asl", {})
            pel = a.get("pel", {})
            gstl = a.get("gstl", {})
            
            intent_label = ifl.get("intent_label", "genuine_answer")
            intent_counts[intent_label] += 1
            
            failure_mode = ifl.get("failure_mode_detected", "none")
            if failure_mode != "none":
                failure_modes.append(failure_mode)
            
            entropies.append(float(ifl.get("entropy", 0)))
            
            if gstl.get("goal_drift_detected"):
                goal_drift_count += 1
            if asl.get("affective_masking_detected"):
                masking_count += 1
            if pel.get("sarcasm_detected"):
                sarcasm_count += 1
            
            recommended_actions.append(gstl.get("recommended_system_action", "encourage"))
            stress_values.append(float(gstl.get("stress_indicators", 0)))
            engagement_values.append(float(gstl.get("engagement_level", 0)))

        total = len(analyses)
        intent_dist = {k: v / total for k, v in intent_counts.items()}
        avg_entropy = sum(entropies) / len(entropies) if entropies else 0.0
        avg_stress = sum(stress_values) / len(stress_values) if stress_values else 0.0
        avg_engagement = sum(engagement_values) / len(engagement_values) if engagement_values else 0.0

        last = analyses[-1]
        last_gstl = last.get("gstl", {})

        return MLIMSessionSummary(
            session_id=session_id,
            total_analyses=total,
            dominant_intent_distribution=intent_dist,
            failure_modes_detected=list(set(failure_modes)),
            average_entropy=avg_entropy,
            session_trajectory=last_gstl.get("session_trajectory", "insufficient_data"),
            readiness_estimate=float(last_gstl.get("readiness_estimate", 0.5)),
            goal_drift_count=goal_drift_count,
            affective_masking_count=masking_count,
            sarcasm_count=sarcasm_count,
            recommended_actions=list(set(recommended_actions)),
            average_stress=avg_stress,
            average_engagement=avg_engagement,
        ).model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/mi-comparison")
async def session_mi_comparison(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        raw_analyses: List[dict] = []
        if db is not None:
            cursor = db.mlim_analyses.find(
                {"session_id": session_id, "user_id": current_user["id"]},
                {"_id": 0}
            ).sort("timestamp", 1)
            raw_analyses = await cursor.to_list(length=200)

        analyses = _parse_mlim_analyses(raw_analyses)

        if len(analyses) < MIN_MI_SAMPLE_SIZE:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Insufficient data for a meaningful MI estimate: "
                    f"{len(analyses)} analyses found, at least {MIN_MI_SAMPLE_SIZE} required."
                ),
            )

        result: MIComparisonResult = compute_mi_comparison(analyses)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/mi-comparison")
async def user_mi_comparison(current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        raw_analyses: List[dict] = []
        if db is not None:
            cursor = db.mlim_analyses.find(
                {"user_id": current_user["id"]},
                {"_id": 0}
            ).sort("timestamp", 1)
            raw_analyses = await cursor.to_list(length=2000)

        analyses = _parse_mlim_analyses(raw_analyses)

        if len(analyses) < MIN_MI_SAMPLE_SIZE:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Insufficient data for a meaningful MI estimate: "
                    f"{len(analyses)} analyses found, at least {MIN_MI_SAMPLE_SIZE} required."
                ),
            )

        result: MIComparisonResult = compute_mi_comparison(analyses)

        distinct_sessions = {a.session_id for a in analyses}
        if len(distinct_sessions) > 1:
            result.mi_sentiment_only = add_laplace_noise(result.mi_sentiment_only)
            result.mi_full_signal = add_laplace_noise(result.mi_full_signal)

        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/analyses")
async def get_analyses(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is None:
            return {"analyses": []}
        cursor = db.mlim_analyses.find(
            {"session_id": session_id, "user_id": current_user["id"]},
            {"_id": 0}
        ).sort("timestamp", 1)
        analyses = await cursor.to_list(length=200)
        return {"analyses": analyses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{analysis_id}/explain")
async def explain_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is None:
            raise HTTPException(status_code=404, detail="Analysis not found")
        analysis = await db.mlim_analyses.find_one(
            {"id": analysis_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        ifl = analysis.get("ifl", {})
        return {
            "analysis_id": analysis_id,
            "attributions": ifl.get("attributions", []),
            "counterfactual": ifl.get("counterfactual", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/escalations")
async def list_escalations(current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is None:
            return {"escalations": []}
        cursor = db.mlim_escalations.find(
            {"user_id": current_user["id"], "status": "open"},
            {"_id": 0}
        ).sort("created_at", -1)
        escalations = await cursor.to_list(length=500)
        return {"escalations": escalations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/escalations/{escalation_id}")
async def get_escalation(escalation_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is None:
            raise HTTPException(status_code=404, detail="Escalation not found")
        escalation = await db.mlim_escalations.find_one(
            {"id": escalation_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        if not escalation:
            raise HTTPException(status_code=404, detail="Escalation not found")
        return escalation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/escalations/{escalation_id}")
async def update_escalation(
    escalation_id: str,
    request: EscalationUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        db = get_db()
        if db is None:
            raise HTTPException(status_code=404, detail="Escalation not found")
        existing = await db.mlim_escalations.find_one(
            {"id": escalation_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Escalation not found")

        update_fields = {
            "status": request.status,
            "reviewer_notes": request.reviewer_notes,
            "reviewed_at": datetime.datetime.utcnow().isoformat(),
        }
        await db.mlim_escalations.update_one(
            {"id": escalation_id, "user_id": current_user["id"]},
            {"$set": update_fields},
        )
        updated = await db.mlim_escalations.find_one(
            {"id": escalation_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))