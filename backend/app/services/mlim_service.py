import json
import math
from typing import List, Optional
from app.services.groq_service import call_groq_json
from app.models.mlim import (
    ASLOutput,
    PELOutput,
    GSTLOutput,
    IFLOutput,
    MLIMAnalysis,
    GoalState,
    InteractionEntry,
    SpeechActType,
    IntentLabel,
)


async def run_asl(utterance: str) -> ASLOutput:
    prompt = f"""You are an affective computing system. Analyze this utterance for sentiment and dimensional affect.

Utterance: "{utterance}"

Respond ONLY in this exact JSON format:
{{
  "sentiment": "positive|negative|neutral",
  "sentiment_confidence": <float 0.0-1.0>,
  "valence": <float -1.0 to 1.0, where -1=very negative, 1=very positive>,
  "arousal": <float 0.0-1.0, where 0=calm, 1=highly activated>,
  "uncertainty_s": <float 0.0-1.0, how uncertain is the sentiment classification>,
  "affective_masking_detected": <boolean, true if surface affect likely misrepresents underlying state>,
  "masking_reason": "<brief explanation if masking detected, else null>"
}}"""
    data = await call_groq_json(prompt)
    return ASLOutput(
        sentiment=data.get("sentiment", "neutral"),
        sentiment_confidence=float(data.get("sentiment_confidence", 0.5)),
        valence=float(data.get("valence", 0.0)),
        arousal=float(data.get("arousal", 0.5)),
        uncertainty_s=float(data.get("uncertainty_s", 0.5)),
        affective_masking_detected=bool(data.get("affective_masking_detected", False)),
        masking_reason=data.get("masking_reason"),
    )


async def run_pel(utterance: str, context: List[str]) -> PELOutput:
    context_str = "\n".join([f"Turn {i+1}: {u}" for i, u in enumerate(context[-5:])]) if context else "No prior context."
    prompt = f"""You are a computational pragmatics system implementing speech act theory (Austin/Searle).

Recent conversation context:
{context_str}

Current utterance: "{utterance}"

Analyze the illocutionary force and pragmatic features. Respond ONLY in this exact JSON format:
{{
  "primary_speech_act": "directive|expressive|commissive|representative|declarative",
  "speech_act_confidence": <float 0.0-1.0>,
  "secondary_speech_acts": ["act1", "act2"],
  "sarcasm_detected": <boolean>,
  "pragmatic_inversion": <boolean, true if literal sentiment inverted by context>,
  "illocutionary_force_features": {{
    "is_requesting_challenge": <boolean>,
    "is_expressing_frustration": <boolean>,
    "is_signaling_confusion": <boolean>,
    "is_face_saving": <boolean>,
    "is_seeking_validation": <boolean>,
    "is_committing_to_retry": <boolean>
  }},
  "gricean_implicature": "<what the utterance implies beyond its literal content>",
  "pragmatic_context_label": "<one phrase describing the pragmatic situation>"
}}"""
    data = await call_groq_json(prompt)
    ilf = data.get("illocutionary_force_features", {})
    return PELOutput(
        primary_speech_act=data.get("primary_speech_act", "representative"),
        speech_act_confidence=float(data.get("speech_act_confidence", 0.5)),
        secondary_speech_acts=data.get("secondary_speech_acts", []),
        sarcasm_detected=bool(data.get("sarcasm_detected", False)),
        pragmatic_inversion=bool(data.get("pragmatic_inversion", False)),
        is_requesting_challenge=bool(ilf.get("is_requesting_challenge", False)),
        is_expressing_frustration=bool(ilf.get("is_expressing_frustration", False)),
        is_signaling_confusion=bool(ilf.get("is_signaling_confusion", False)),
        is_face_saving=bool(ilf.get("is_face_saving", False)),
        is_seeking_validation=bool(ilf.get("is_seeking_validation", False)),
        is_committing_to_retry=bool(ilf.get("is_committing_to_retry", False)),
        gricean_implicature=data.get("gricean_implicature", ""),
        pragmatic_context_label=data.get("pragmatic_context_label", ""),
    )


async def run_gstl(
    utterance: str,
    job_role: str,
    question_text: str,
    prior_goal_state: Optional[GoalState],
    interaction_history: List[InteractionEntry],
) -> GSTLOutput:
    history_str = ""
    for entry in interaction_history[-4:]:
        history_str += f"Q: {entry.question}\nA: {entry.answer}\nScore: {entry.score}/10\n\n"

    prior_belief_str = ""
    if prior_goal_state:
        prior_belief_str = f"""Prior goal beliefs:
- Confidence level: {prior_goal_state.confidence_level:.2f}
- Goal drift detected: {prior_goal_state.goal_drift_detected}
- Dominant goal: {prior_goal_state.dominant_goal}
- Session trajectory: {prior_goal_state.session_trajectory}"""

    prompt = f"""You are a POMDP belief-state estimator tracking user goals in an AI interview coaching system.

Job Role: {job_role}
Current Question: "{question_text}"
Current Utterance: "{utterance}"

Interaction History (last 4 turns):
{history_str if history_str else "No prior interactions."}

{prior_belief_str}

Estimate the user's current goal state. Respond ONLY in this exact JSON format:
{{
  "dominant_goal": "demonstrate_competence|seek_feedback|pass_screening|build_confidence|explore_role|unclear",
  "goal_belief_distribution": {{
    "demonstrate_competence": <float 0.0-1.0>,
    "seek_feedback": <float 0.0-1.0>,
    "pass_screening": <float 0.0-1.0>,
    "build_confidence": <float 0.0-1.0>,
    "explore_role": <float 0.0-1.0>
  }},
  "confidence_level": <float 0.0-1.0, confidence in goal estimate>,
  "goal_drift_detected": <boolean, true if goal seems to have shifted from prior>,
  "session_trajectory": "improving|declining|stable|volatile|insufficient_data",
  "engagement_level": <float 0.0-1.0>,
  "stress_indicators": <float 0.0-1.0, inferred stress from answer patterns>,
  "readiness_estimate": <float 0.0-1.0, estimated interview readiness>,
  "recommended_system_action": "encourage|challenge|clarify|simplify|validate|escalate_difficulty"
}}

Note: goal_belief_distribution values must sum to 1.0"""
    data = await call_groq_json(prompt)
    belief_dist = data.get("goal_belief_distribution", {})
    return GSTLOutput(
        dominant_goal=data.get("dominant_goal", "unclear"),
        goal_belief_distribution=belief_dist,
        confidence_level=float(data.get("confidence_level", 0.5)),
        goal_drift_detected=bool(data.get("goal_drift_detected", False)),
        session_trajectory=data.get("session_trajectory", "insufficient_data"),
        engagement_level=float(data.get("engagement_level", 0.5)),
        stress_indicators=float(data.get("stress_indicators", 0.3)),
        readiness_estimate=float(data.get("readiness_estimate", 0.5)),
        recommended_system_action=data.get("recommended_system_action", "encourage"),
    )


async def run_ifl(
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
    utterance: str,
    question_text: str,
    job_role: str,
) -> IFLOutput:
    prompt = f"""You are the Intent Fusion Layer of the MLIM framework. Integrate signals from all analysis layers.

Job Role: {job_role}
Question: "{question_text}"
Utterance: "{utterance}"

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
  "entropy": <float 0.0-3.0, uncertainty of prediction - compute from distribution>,
  "should_solicit_clarification": <boolean, true if entropy > 1.5>,
  "clarification_prompt": "<suggested clarification question if needed, else null>",
  "intent_aware_response_modifier": "<how the system should adjust its response given this intent>",
  "failure_mode_detected": "none|affective_masking|pragmatic_inversion|temporal_goal_drift|role_ambiguity",
  "failure_mode_explanation": "<brief explanation if failure mode detected>"
}}

Note: intent_distribution values must sum to 1.0. Compute entropy as -sum(p*log(p)) over distribution."""
    data = await call_groq_json(prompt)

    dist = data.get("intent_distribution", {})
    if not dist:
        dist = {"genuine_answer": 1.0}

    total = sum(dist.values())
    if total > 0:
        dist = {k: v / total for k, v in dist.items()}

    entropy = -sum(p * math.log(p + 1e-10) for p in dist.values())

    return IFLOutput(
        intent_label=data.get("intent_label", "genuine_answer"),
        intent_confidence=float(data.get("intent_confidence", 0.5)),
        intent_distribution=dist,
        entropy=float(data.get("entropy", entropy)),
        should_solicit_clarification=bool(data.get("should_solicit_clarification", False)),
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
) -> MLIMAnalysis:
    asl = await run_asl(utterance)

    pel = await run_pel(utterance, context_utterances)

    prior_gs = None
    if prior_goal_state:
        prior_gs = prior_goal_state

    gstl = await run_gstl(
        utterance=utterance,
        job_role=job_role,
        question_text=question_text,
        prior_goal_state=prior_gs,
        interaction_history=interaction_history,
    )

    ifl = await run_ifl(
        asl=asl,
        pel=pel,
        gstl=gstl,
        utterance=utterance,
        question_text=question_text,
        job_role=job_role,
    )

    return MLIMAnalysis(
        session_id=session_id,
        question_text=question_text,
        utterance=utterance,
        asl=asl,
        pel=pel,
        gstl=gstl,
        ifl=ifl,
    )