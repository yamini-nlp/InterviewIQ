import math
from typing import List, Optional, Dict
from app.services.groq_service import call_groq_json
from app.services.mlim.asl import compute_asl
from app.services.mlim.pel import compute_pel
from app.services.mlim.gstl import compute_gstl
from app.models.mlim import (
    ASLOutput, PELOutput, GSTLOutput, IFLOutput, MLIMAnalysis,
    GoalState, InteractionEntry,
)

FAST_MODEL = "llama-3.1-8b-instant"
REASONING_MODEL = "llama-3.3-70b-versatile"


async def run_asl(
    utterance: str,
    face_snapshot: Optional[dict] = None,
    voice_features: Optional[dict] = None,
) -> ASLOutput:
    return await compute_asl(utterance, face_snapshot, voice_features)


async def run_pel(utterance: str, context: List[str], asl: ASLOutput) -> PELOutput:
    return await compute_pel(utterance, context, asl)


async def run_gstl(
    utterance: str,
    job_role: str,
    question_text: str,
    prior_goal_state: Optional[GoalState],
    interaction_history: List[InteractionEntry],
    asl: ASLOutput,
    pel: PELOutput,
    belief_history: Optional[List[Dict[str, float]]] = None,
) -> GSTLOutput:
    return await compute_gstl(
        utterance=utterance,
        job_role=job_role,
        question_text=question_text,
        prior_goal_state=prior_goal_state,
        interaction_history=interaction_history,
        asl=asl,
        pel=pel,
        belief_history=belief_history,
    )


async def run_ifl(
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
    utterance: str,
    question_text: str,
    job_role: str,
    longitudinal_history: List[InteractionEntry],
) -> IFLOutput:
    history_summary = ""
    if longitudinal_history:
        recent = longitudinal_history[-3:]
        history_summary = f"\nLongitudinal history (last {len(recent)} turns):"
        for entry in recent:
            history_summary += f"\n  - Intent: {entry.intent_label or 'unknown'}, Score: {entry.score}/10"

    prompt = f"""You are the Intent Fusion Layer (IFL) of the MLIM framework. Integrate signals from all analysis layers.

Job Role: {job_role}
Question: "{question_text}"
Utterance: "{utterance}"{history_summary}

Layer 1 - Affective Signal (ASL):
- Sentiment: {asl.sentiment} (confidence: {asl.sentiment_confidence:.2f})
- Valence: {asl.valence:.2f}, Arousal: {asl.arousal:.2f}
- Affective masking: {asl.affective_masking_detected}
- Masking reason: {asl.masking_reason or "none"}

Layer 2 - Pragmatic Encoding (PEL):
- Primary speech act: {pel.primary_speech_act}
- Sarcasm detected: {pel.sarcasm_detected}
- Pragmatic inversion: {pel.pragmatic_inversion}
- Face-saving behavior: {pel.is_face_saving}
- Expressing frustration: {pel.is_expressing_frustration}
- Signaling confusion: {pel.is_signaling_confusion}
- Implicature: {pel.gricean_implicature}

Layer 3 - Goal State (GSTL):
- Dominant goal: {gstl.dominant_goal}
- Goal drift: {gstl.goal_drift_detected}
- Session trajectory: {gstl.session_trajectory}
- Engagement: {gstl.engagement_level:.2f}
- Stress: {gstl.stress_indicators:.2f}
- Recommended action: {gstl.recommended_system_action}
- Hiring readiness signal: {gstl.hiring_readiness_signal or "neutral"}

Produce the final intent prediction. Respond ONLY in this exact JSON format:
{{
  "intent_label": "genuine_answer|face_saving_assertion|request_for_challenge|expressing_confusion|sarcastic_response|seeking_validation|committed_retry|off_topic",
  "intent_confidence": <float 0.0-1.0>,
  "intent_distribution": {{
    "genuine_answer": <float>,
    "face_saving_assertion": <float>,
    "request_for_challenge": <float>,
    "expressing_confusion": <float>,
    "sarcastic_response": <float>,
    "seeking_validation": <float>,
    "committed_retry": <float>,
    "off_topic": <float>
  }},
  "should_solicit_clarification": <boolean, true if uncertainty warrants follow-up>,
  "clarification_prompt": "<suggested clarification question if needed, else null>",
  "intent_aware_response_modifier": "<how the system should adjust its response given this intent>",
  "failure_mode_detected": "none|affective_masking|pragmatic_inversion|temporal_goal_drift|role_ambiguity",
  "failure_mode_explanation": "<brief explanation if failure mode detected>"
}}

Note: intent_distribution values must sum to 1.0"""

    data = await call_groq_json(prompt, model=REASONING_MODEL)

    dist = data.get("intent_distribution", {})
    if not dist:
        dist = {"genuine_answer": 1.0}

    total = sum(dist.values())
    if total > 0:
        dist = {k: v / total for k, v in dist.items()}

    entropy = -sum(p * math.log(max(p, 1e-10)) for p in dist.values())
    should_clarify = bool(data.get("should_solicit_clarification", False)) or entropy > 1.5

    return IFLOutput(
        intent_label=data.get("intent_label", "genuine_answer"),
        intent_confidence=float(data.get("intent_confidence", 0.5)),
        intent_distribution=dist,
        entropy=entropy,
        should_solicit_clarification=should_clarify,
        clarification_prompt=data.get("clarification_prompt"),
        intent_aware_response_modifier=data.get("intent_aware_response_modifier", ""),
        failure_mode_detected=data.get("failure_mode_detected", "none"),
        failure_mode_explanation=data.get("failure_mode_explanation"),
    )


async def run_mlim_pipeline(
    utterance: str,
    question_text: str,
    job_role: str,
    session_id: str,
    context_utterances: List[str],
    interaction_history: List[InteractionEntry],
    prior_goal_state: Optional[GoalState],
    face_snapshot: Optional[dict] = None,
    voice_features: Optional[dict] = None,
    belief_history: Optional[List[Dict[str, float]]] = None,
) -> MLIMAnalysis:
    asl = await run_asl(utterance, face_snapshot, voice_features)
    pel = await run_pel(utterance, context_utterances, asl)

    gstl = await run_gstl(
        utterance=utterance,
        job_role=job_role,
        question_text=question_text,
        prior_goal_state=prior_goal_state,
        interaction_history=interaction_history,
        asl=asl,
        pel=pel,
        belief_history=belief_history,
    )

    ifl = await run_ifl(
        asl=asl,
        pel=pel,
        gstl=gstl,
        utterance=utterance,
        question_text=question_text,
        job_role=job_role,
        longitudinal_history=interaction_history,
    )

    return MLIMAnalysis(
        session_id=session_id,
        question_text=question_text,
        utterance=utterance,
        asl=asl,
        pel=pel,
        gstl=gstl,
        ifl=ifl,
        face_snapshot=face_snapshot,
        voice_features=voice_features,
    )