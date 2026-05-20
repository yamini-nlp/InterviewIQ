from fastapi import APIRouter, HTTPException
from app.models.mlim import (
    MLIMAnalyzeRequest,
    MLIMAnalysis,
    MLIMSessionSummary,
    GoalState,
    InteractionEntry,
)
from app.services.mlim_service import run_mlim_pipeline
from typing import Dict, List
from collections import defaultdict

router = APIRouter(prefix="/api/mlim", tags=["mlim"])

mlim_session_store: Dict[str, List[MLIMAnalysis]] = {}


@router.post("/analyze")
async def analyze(request: MLIMAnalyzeRequest):
    try:
        result = await run_mlim_pipeline(
            utterance=request.answer_text,
            question_text=request.question_text,
            job_role=request.job_role,
            session_id=request.session_id,
            context_utterances=request.context_utterances,
            interaction_history=request.interaction_history,
            prior_goal_state=request.prior_goal_state,
        )
        if request.session_id not in mlim_session_store:
            mlim_session_store[request.session_id] = []
        mlim_session_store[request.session_id].append(result)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/summary")
async def session_summary(session_id: str):
    try:
        analyses = mlim_session_store.get(session_id, [])
        if not analyses:
            raise HTTPException(status_code=404, detail="No MLIM analyses found for this session")

        intent_counts: Dict[str, float] = defaultdict(float)
        failure_modes = []
        entropies = []
        recommended_actions = []
        goal_drift_count = 0
        masking_count = 0
        sarcasm_count = 0

        for a in analyses:
            intent_counts[a.ifl.intent_label] += 1
            if a.ifl.failure_mode_detected != "none":
                failure_modes.append(a.ifl.failure_mode_detected)
            entropies.append(a.ifl.entropy)
            if a.gstl.goal_drift_detected:
                goal_drift_count += 1
            if a.asl.affective_masking_detected:
                masking_count += 1
            if a.pel.sarcasm_detected:
                sarcasm_count += 1
            recommended_actions.append(a.gstl.recommended_system_action)

        total = len(analyses)
        intent_dist = {k: v / total for k, v in intent_counts.items()}
        avg_entropy = sum(entropies) / len(entropies) if entropies else 0.0

        last = analyses[-1]

        return MLIMSessionSummary(
            session_id=session_id,
            total_analyses=total,
            dominant_intent_distribution=intent_dist,
            failure_modes_detected=list(set(failure_modes)),
            average_entropy=avg_entropy,
            session_trajectory=last.gstl.session_trajectory,
            readiness_estimate=last.gstl.readiness_estimate,
            goal_drift_count=goal_drift_count,
            affective_masking_count=masking_count,
            sarcasm_count=sarcasm_count,
            recommended_actions=list(set(recommended_actions)),
        ).model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/analyses")
async def get_analyses(session_id: str):
    try:
        analyses = mlim_session_store.get(session_id, [])
        return {"analyses": [a.model_dump() for a in analyses]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    mlim_session_store.pop(session_id, None)
    return {"cleared": True}