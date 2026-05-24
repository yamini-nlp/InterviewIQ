from fastapi import APIRouter, HTTPException, Depends
from app.models.mlim import (
    MLIMAnalyzeRequest, MLIMAnalysis, MLIMSessionSummary,
    GoalState, InteractionEntry,
)
from app.services.mlim_service import run_mlim_pipeline
from app.auth.dependencies import get_current_user
from app.database import get_db
from typing import Dict, List
from collections import defaultdict
import datetime

router = APIRouter(prefix="/api/mlim", tags=["mlim"])

@router.post("/analyze")
async def analyze(request: MLIMAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        if db is not None:
            session = await db.sessions.find_one({"id": request.session_id})
            if session and session.get("user_id") != current_user["id"]:
                raise HTTPException(status_code=403, detail="Access denied")

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
        )

        if db is not None:
            doc = result.model_dump()
            doc["user_id"] = current_user["id"]
            if doc.get("timestamp") and hasattr(doc["timestamp"], "isoformat"):
                doc["timestamp"] = doc["timestamp"].isoformat()
            await db.mlim_analyses.insert_one(doc)

        return result.model_dump()
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