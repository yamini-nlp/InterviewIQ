from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from app.models.mlim import (
    MLIMAnalyzeRequest, MLIMAnalysis, MLIMSessionSummary,
    GoalState, InteractionEntry, MIComparisonResult,
    EscalationRecord, EscalationUpdateRequest, FairnessProbeResult,
    ASLOutput, PELOutput, GSTLOutput, IFLOutput,
)
from app.services.mlim_service import run_asl, run_pel, run_gstl, run_ifl
from app.services.mlim.benchmark import compute_mi_comparison
from app.services.mlim.escalation import evaluate_escalation
from app.services.mlim.fairness import run_fairness_probe
from app.services.privacy_service import add_laplace_noise
from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from app.core import metrics
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import datetime
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mlim", tags=["mlim"])

MIN_MI_SAMPLE_SIZE = 5
MAX_FAIRNESS_PROBE_UTTERANCES = 20


class FairnessProbeRequest(BaseModel):
    utterances: List[str]


def _parse_mlim_analyses(raw_analyses: List[dict]) -> List[MLIMAnalysis]:
    parsed: List[MLIMAnalysis] = []
    for raw in raw_analyses:
        try:
            parsed.append(MLIMAnalysis.model_validate(raw))
        except Exception:
            continue
    return parsed


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(jsonable_encoder(payload))}\n\n"


async def _load_session_context(
    db, session_id: str, current_user: dict
) -> Tuple[Optional[dict], List[Dict[str, float]]]:
    session = None
    belief_history: List[Dict[str, float]] = []
    if db is not None:
        session = await db.sessions.find_one({"id": session_id})
        if session and session.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if session:
            belief_history = session.get("goal_belief_history", []) or []
    return session, belief_history


async def _persist_mlim_analysis(
    db,
    result: MLIMAnalysis,
    current_user: dict,
    session: Optional[dict],
    belief_history: List[Dict[str, float]],
    escalation_record: Optional[EscalationRecord],
) -> None:
    if db is None:
        return

    doc = result.model_dump()
    doc["user_id"] = current_user["id"]
    if doc.get("timestamp") and hasattr(doc["timestamp"], "isoformat"):
        doc["timestamp"] = doc["timestamp"].isoformat()
    await db.mlim_analyses.insert_one(doc)

    if session:
        updated_history = (belief_history + [result.gstl.goal_belief_distribution])[-50:]
        await db.sessions.update_one(
            {"id": result.session_id, "user_id": current_user["id"]},
            {"$set": {"goal_belief_history": updated_history}},
        )

    if escalation_record is not None:
        escalation_doc = escalation_record.model_dump()
        if escalation_doc.get("created_at") and hasattr(escalation_doc["created_at"], "isoformat"):
            escalation_doc["created_at"] = escalation_doc["created_at"].isoformat()
        if escalation_doc.get("reviewed_at") and hasattr(escalation_doc["reviewed_at"], "isoformat"):
            escalation_doc["reviewed_at"] = escalation_doc["reviewed_at"].isoformat()
        await db.mlim_escalations.insert_one(escalation_doc)


def _fallback_asl() -> ASLOutput:
    return ASLOutput(
        sentiment="neutral",
        sentiment_confidence=0.0,
        valence=0.0,
        arousal=0.0,
        uncertainty_s=1.0,
        affective_masking_detected=False,
        masking_reason=None,
        lexicon_sentiment="neutral",
        lexicon_confidence=0.0,
        lexicon_llm_disagreement=False,
    )


def _fallback_pel() -> PELOutput:
    return PELOutput(
        primary_speech_act="statement",
        speech_act_confidence=0.0,
        secondary_speech_acts=[],
        concurrent_speech_acts=[],
        is_interrogative=False,
        sarcasm_detected=False,
        pragmatic_inversion=False,
        is_requesting_challenge=False,
        is_expressing_frustration=False,
        is_signaling_confusion=False,
        is_face_saving=False,
        is_seeking_validation=False,
        is_committing_to_retry=False,
        maxim_violations={},
        gricean_implicature="",
        pragmatic_context_label="unavailable",
    )


def _fallback_gstl(prior_goal_state: Optional[GoalState]) -> GSTLOutput:
    if prior_goal_state is not None:
        return GSTLOutput(
            dominant_goal=prior_goal_state.dominant_goal,
            goal_belief_distribution=prior_goal_state.goal_belief_distribution,
            confidence_level=prior_goal_state.confidence_level,
            goal_drift_detected=False,
            session_trajectory=prior_goal_state.session_trajectory,
            engagement_level=prior_goal_state.engagement_level,
            stress_indicators=prior_goal_state.stress_indicators,
            readiness_estimate=prior_goal_state.readiness_estimate,
            recommended_system_action="encourage",
            hiring_readiness_signal=prior_goal_state.hiring_readiness_signal,
            belief_update_trace={},
            goal_drift_kl_divergence=0.0,
        )
    return GSTLOutput(
        dominant_goal="unknown",
        goal_belief_distribution={"unknown": 1.0},
        confidence_level=0.0,
        goal_drift_detected=False,
        session_trajectory="insufficient_data",
        engagement_level=0.5,
        stress_indicators=0.0,
        readiness_estimate=0.5,
        recommended_system_action="encourage",
        hiring_readiness_signal=None,
        belief_update_trace={},
        goal_drift_kl_divergence=0.0,
    )


def _fallback_ifl() -> IFLOutput:
    return IFLOutput(
        intent_label="genuine_answer",
        intent_confidence=0.0,
        intent_distribution={"genuine_answer": 1.0},
        raw_intent_distribution={},
        feature_vector={},
        entropy=0.0,
        should_solicit_clarification=False,
        clarification_prompt=None,
        intent_aware_response_modifier="",
        failure_mode_detected="none",
        failure_mode_explanation=None,
        attributions=[],
        counterfactual="",
    )


async def _run_asl_safe(answer_text: str, face_snapshot, voice_features) -> ASLOutput:
    try:
        return await run_asl(answer_text, face_snapshot, voice_features)
    except Exception as e:
        logger.warning(f"MLIM ASL layer failed, using fallback: {e}")
        return _fallback_asl()


async def _run_pel_safe(answer_text: str, context_utterances, asl: ASLOutput) -> PELOutput:
    try:
        return await run_pel(answer_text, context_utterances, asl)
    except Exception as e:
        logger.warning(f"MLIM PEL layer failed, using fallback: {e}")
        return _fallback_pel()


async def _run_gstl_safe(**kwargs) -> GSTLOutput:
    try:
        return await run_gstl(**kwargs)
    except Exception as e:
        logger.warning(f"MLIM GSTL layer failed, using fallback: {e}")
        return _fallback_gstl(kwargs.get("prior_goal_state"))


async def _run_ifl_safe(**kwargs) -> IFLOutput:
    try:
        return await run_ifl(**kwargs)
    except Exception as e:
        logger.warning(f"MLIM IFL layer failed, using fallback: {e}")
        return _fallback_ifl()


@router.post("/analyze")
async def analyze(request: MLIMAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        session, belief_history = await _load_session_context(db, request.session_id, current_user)

        asl = await _run_asl_safe(request.answer_text, request.face_snapshot, request.voice_features)
        pel = await _run_pel_safe(request.answer_text, request.context_utterances, asl)
        gstl = await _run_gstl_safe(
            utterance=request.answer_text,
            job_role=request.job_role,
            question_text=request.question_text,
            prior_goal_state=request.prior_goal_state,
            interaction_history=request.interaction_history,
            asl=asl,
            pel=pel,
            belief_history=belief_history,
        )
        ifl = await _run_ifl_safe(
            asl=asl,
            pel=pel,
            gstl=gstl,
            utterance=request.answer_text,
            question_text=request.question_text,
            job_role=request.job_role,
            longitudinal_history=request.interaction_history,
        )

        result = MLIMAnalysis(
            session_id=request.session_id,
            question_text=request.question_text,
            utterance=request.answer_text,
            asl=asl,
            pel=pel,
            gstl=gstl,
            ifl=ifl,
            face_snapshot=request.face_snapshot,
            voice_features=request.voice_features,
        )

        escalation_record: Optional[EscalationRecord] = evaluate_escalation(result)
        if escalation_record is not None:
            escalation_record.user_id = current_user["id"]

        await _persist_mlim_analysis(
            db, result, current_user, session, belief_history, escalation_record
        )

        response = result.model_dump()
        response["escalation"] = escalation_record.model_dump() if escalation_record is not None else None
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/mlim/analyze for session {request.session_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


@router.post("/analyze/stream")
async def analyze_stream(request: MLIMAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    session, belief_history = await _load_session_context(db, request.session_id, current_user)

    async def event_generator():
        try:
            asl = await _run_asl_safe(request.answer_text, request.face_snapshot, request.voice_features)
            yield _sse_event({"type": "layer", "layer": "asl", "data": asl.model_dump()})

            pel = await _run_pel_safe(request.answer_text, request.context_utterances, asl)
            yield _sse_event({"type": "layer", "layer": "pel", "data": pel.model_dump()})

            gstl = await _run_gstl_safe(
                utterance=request.answer_text,
                job_role=request.job_role,
                question_text=request.question_text,
                prior_goal_state=request.prior_goal_state,
                interaction_history=request.interaction_history,
                asl=asl,
                pel=pel,
                belief_history=belief_history,
            )
            yield _sse_event({"type": "layer", "layer": "gstl", "data": gstl.model_dump()})

            ifl = await _run_ifl_safe(
                asl=asl,
                pel=pel,
                gstl=gstl,
                utterance=request.answer_text,
                question_text=request.question_text,
                job_role=request.job_role,
                longitudinal_history=request.interaction_history,
            )
            yield _sse_event({"type": "layer", "layer": "ifl", "data": ifl.model_dump()})

            result = MLIMAnalysis(
                session_id=request.session_id,
                question_text=request.question_text,
                utterance=request.answer_text,
                asl=asl,
                pel=pel,
                gstl=gstl,
                ifl=ifl,
                face_snapshot=request.face_snapshot,
                voice_features=request.voice_features,
            )

            escalation_record: Optional[EscalationRecord] = evaluate_escalation(result)
            if escalation_record is not None:
                escalation_record.user_id = current_user["id"]

            await _persist_mlim_analysis(
                db, result, current_user, session, belief_history, escalation_record
            )

            response = result.model_dump()
            response["escalation"] = escalation_record.model_dump() if escalation_record is not None else None
            yield _sse_event({"type": "done", "analysis": response})
        except Exception as e:
            logger.error(
                f"MLIM streaming error for session {request.session_id}: {e}", exc_info=True
            )
            yield _sse_event({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


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
        logger.error(
            f"Unhandled error in GET /api/mlim/session/{session_id}/summary: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        logger.error(
            f"Unhandled error in GET /api/mlim/session/{session_id}/mi-comparison: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        logger.error(
            f"Unhandled error in GET /api/mlim/user/mi-comparison for user "
            f"{current_user['id']}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        metrics.record_mongo_error(operation="mlim_analyses_list")
        logger.error(
            f"Unhandled error in GET /api/mlim/session/{session_id}/analyses: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        logger.error(
            f"Unhandled error in GET /api/mlim/analysis/{analysis_id}/explain: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


@router.post("/fairness/probe")
async def fairness_probe(
    request: FairnessProbeRequest, current_user: dict = Depends(require_admin)
):
    try:
        if len(request.utterances) == 0:
            raise HTTPException(status_code=400, detail="At least one utterance is required")
        if len(request.utterances) > MAX_FAIRNESS_PROBE_UTTERANCES:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum of {MAX_FAIRNESS_PROBE_UTTERANCES} utterances per fairness probe call",
            )

        result: FairnessProbeResult = await run_fairness_probe(request.utterances)

        db = get_db()
        if db is not None:
            doc = result.model_dump()
            if doc.get("run_at") and hasattr(doc["run_at"], "isoformat"):
                doc["run_at"] = doc["run_at"].isoformat()
            doc["requested_by"] = current_user["id"]
            await db.mlim_fairness_probes.insert_one(doc)

        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Unhandled error in POST /api/mlim/fairness/probe: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        metrics.record_mongo_error(operation="mlim_escalations_list")
        logger.error(
            f"Unhandled error in GET /api/mlim/escalations for user "
            f"{current_user['id']}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        logger.error(
            f"Unhandled error in GET /api/mlim/escalations/{escalation_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )


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
        logger.error(
            f"Unhandled error in PATCH /api/mlim/escalations/{escalation_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again later."
        )