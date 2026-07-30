import math
import logging
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.services.groq_service import call_groq_json
from app.services.mlim.explain import feature_attribution, counterfactual_explanation
from app.core import metrics
from app.models.mlim import (
    ASLOutput,
    PELOutput,
    GSTLOutput,
    IFLOutput,
    IntentLabel,
    InteractionEntry,
    MLIMAnalysis,
)

logger = logging.getLogger(__name__)

FAST_MODEL = "llama-3.1-8b-instant"

INTENT_LABELS: Tuple[str, ...] = tuple(label.value for label in IntentLabel)

MAXIM_KEYS = ("quantity", "quality", "relation", "manner")

FEATURE_INTENT_BOOSTS: Dict[str, Tuple[str, float]] = {
    "pragmatic_inversion": ("sarcastic_response", 2.5),
    "sarcasm_detected": ("sarcastic_response", 2.5),
    "is_face_saving": ("face_saving_assertion", 2.5),
    "is_requesting_challenge": ("request_for_challenge", 2.5),
    "is_signaling_confusion": ("expressing_confusion", 2.5),
    "is_expressing_frustration": ("expressing_confusion", 1.5),
    "is_seeking_validation": ("seeking_validation", 2.5),
    "is_committing_to_retry": ("committed_retry", 2.5),
}

INTENT_PRIOR_WEIGHTS: Dict[str, Dict[str, float]] = {
    feature_key: {label: weight}
    for feature_key, (label, weight) in FEATURE_INTENT_BOOSTS.items()
}

RESPONSE_MODIFIERS: Dict[str, str] = {
    "genuine_answer": "proceed_standard",
    "face_saving_assertion": "gentle_probe",
    "request_for_challenge": "escalate_difficulty",
    "expressing_confusion": "clarify_and_simplify",
    "sarcastic_response": "acknowledge_and_redirect",
    "seeking_validation": "validate_and_reinforce",
    "committed_retry": "encourage_retry",
    "off_topic": "redirect_to_question",
}


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _uniform_intent_distribution() -> Dict[str, float]:
    return {label: 1.0 / len(INTENT_LABELS) for label in INTENT_LABELS}


def _normalize_distribution(dist: Dict[str, float]) -> Dict[str, float]:
    cleaned = {label: max(_safe_float(dist.get(label, 0.0)), 0.0) for label in INTENT_LABELS}
    total = sum(cleaned.values())
    if total <= 0:
        return _uniform_intent_distribution()
    return {k: v / total for k, v in cleaned.items()}


def build_feature_vector(
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
    longitudinal_history: List[InteractionEntry],
) -> Dict[str, float]:
    features: Dict[str, float] = {}

    features["valence"] = asl.valence
    features["arousal"] = asl.arousal
    features["sentiment_confidence"] = asl.sentiment_confidence
    features["uncertainty_s"] = asl.uncertainty_s

    for score in pel.concurrent_speech_acts:
        act_value = score.act.value if hasattr(score.act, "value") else str(score.act)
        features[f"speech_act_conf_{act_value}"] = float(score.confidence)

    features["sarcasm_detected"] = 1.0 if pel.sarcasm_detected else 0.0
    features["pragmatic_inversion"] = 1.0 if pel.pragmatic_inversion else 0.0
    features["is_requesting_challenge"] = 1.0 if pel.is_requesting_challenge else 0.0
    features["is_expressing_frustration"] = 1.0 if pel.is_expressing_frustration else 0.0
    features["is_signaling_confusion"] = 1.0 if pel.is_signaling_confusion else 0.0
    features["is_face_saving"] = 1.0 if pel.is_face_saving else 0.0
    features["is_seeking_validation"] = 1.0 if pel.is_seeking_validation else 0.0
    features["is_committing_to_retry"] = 1.0 if pel.is_committing_to_retry else 0.0

    for maxim_key in MAXIM_KEYS:
        violated = pel.maxim_violations.get(maxim_key, False)
        features[f"maxim_violation_{maxim_key}"] = 1.0 if violated else 0.0

    for goal_key, belief in gstl.goal_belief_distribution.items():
        features[f"goal_belief_{goal_key}"] = float(belief)

    features["engagement_level"] = gstl.engagement_level
    features["stress_indicators"] = gstl.stress_indicators
    features["readiness_estimate"] = gstl.readiness_estimate
    features["goal_drift_detected"] = 1.0 if gstl.goal_drift_detected else 0.0

    if longitudinal_history:
        scores = [float(entry.score) for entry in longitudinal_history]
        n = len(scores)
        mean_score = sum(scores) / n
        features["history_mean_score"] = mean_score

        if n >= 2:
            mean_x = (n - 1) / 2.0
            numerator = sum((i - mean_x) * (scores[i] - mean_score) for i in range(n))
            denominator = sum((i - mean_x) ** 2 for i in range(n))
            slope = numerator / denominator if denominator != 0 else 0.0
            features["history_trend_sign"] = 1.0 if slope > 0 else (-1.0 if slope < 0 else 0.0)
        else:
            features["history_trend_sign"] = 0.0
    else:
        features["history_mean_score"] = 0.0
        features["history_trend_sign"] = 0.0

    return features


def apply_feature_weighted_prior(
    base_distribution: Dict[str, float],
    feature_vector: Dict[str, float],
) -> Dict[str, float]:
    normalized = _normalize_distribution(base_distribution)
    weighted = dict(normalized)

    for feature_key, (label, boost_weight) in FEATURE_INTENT_BOOSTS.items():
        signal = max(0.0, min(1.0, _safe_float(feature_vector.get(feature_key, 0.0))))
        if signal > 0.0 and label in weighted:
            weighted[label] = weighted[label] * (1.0 + boost_weight * signal)

    total = sum(weighted.values())
    if total <= 0:
        return _uniform_intent_distribution()
    return {k: v / total for k, v in weighted.items()}


def compute_confidence(distribution: Dict[str, float]) -> Tuple[str, float]:
    if not distribution:
        uniform = _uniform_intent_distribution()
        label = max(uniform, key=uniform.get)
        return label, uniform[label]
    label = max(distribution, key=distribution.get)
    return label, distribution[label]


def compute_uncertainty(distribution: Dict[str, float]) -> float:
    return -sum(p * math.log(p) for p in distribution.values() if p > 0.0)


def _build_prompt(
    utterance: str,
    question_text: str,
    job_role: str,
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
) -> str:
    return f"""You are the Intent Fusion Layer of an AI interview coaching system, integrating
affective (Layer 1), pragmatic (Layer 2), and goal-state (Layer 3) signals into a distribution
over the speaker's underlying communicative intent for this turn.

Job Role: {job_role}
Current Question: "{question_text}"
Current Utterance: "{utterance}"

Affective signals (Layer 1): sentiment={asl.sentiment}, valence={asl.valence:.2f}, arousal={asl.arousal:.2f}, affective_masking_detected={asl.affective_masking_detected}
Pragmatic signals (Layer 2): primary_speech_act={pel.primary_speech_act}, sarcasm_detected={pel.sarcasm_detected}, pragmatic_inversion={pel.pragmatic_inversion}, is_face_saving={pel.is_face_saving}, is_requesting_challenge={pel.is_requesting_challenge}, is_signaling_confusion={pel.is_signaling_confusion}, is_seeking_validation={pel.is_seeking_validation}, is_committing_to_retry={pel.is_committing_to_retry}
Goal-state signals (Layer 3): dominant_goal={gstl.dominant_goal}, session_trajectory={gstl.session_trajectory}, goal_drift_detected={gstl.goal_drift_detected}, engagement_level={gstl.engagement_level:.2f}, stress_indicators={gstl.stress_indicators:.2f}

Estimate a probability distribution over the following candidate intent labels, reflecting what
the speaker most plausibly meant by this utterance:
{", ".join(INTENT_LABELS)}

Respond ONLY in this exact JSON format:
{{
  "intent_distribution": {{
    "genuine_answer": <float 0.0-1.0>,
    "face_saving_assertion": <float 0.0-1.0>,
    "request_for_challenge": <float 0.0-1.0>,
    "expressing_confusion": <float 0.0-1.0>,
    "sarcastic_response": <float 0.0-1.0>,
    "seeking_validation": <float 0.0-1.0>,
    "committed_retry": <float 0.0-1.0>,
    "off_topic": <float 0.0-1.0>
  }}
}}"""


def _build_clarification_prompt(intent_label: str, question_text: str) -> str:
    if intent_label == "expressing_confusion":
        return f"It sounds like the question may not have been fully clear — would it help to rephrase \"{question_text}\"?"
    return "Could you clarify what you meant by that last response?"


def _detect_failure_mode(
    intent_label: str,
    intent_confidence: float,
    pel: PELOutput,
    gstl: GSTLOutput,
    entropy_value: float,
    max_entropy: float,
) -> Tuple[str, Optional[str]]:
    if intent_label == "off_topic" and intent_confidence > 0.4:
        return (
            "topic_drift",
            "The response was classified as off-topic relative to the question asked.",
        )

    if pel.pragmatic_inversion and intent_label != "sarcastic_response":
        return (
            "unresolved_sarcasm_ambiguity",
            "Literal and pragmatic valence diverge but the intent classifier did not converge on sarcasm.",
        )

    if gstl.goal_drift_detected and intent_label == "genuine_answer" and intent_confidence < 0.4:
        return (
            "goal_intent_mismatch",
            "Session-level goal drift was detected while the turn-level intent remains ambiguous.",
        )

    if max_entropy > 0 and entropy_value > max_entropy * 0.9:
        return (
            "high_ambiguity",
            "The intent distribution is close to uniform across all candidate labels.",
        )

    return "none", None


async def compute_ifl(
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
    utterance: str,
    question_text: str,
    job_role: str,
    longitudinal_history: List[InteractionEntry],
) -> IFLOutput:
    with metrics.time_mlim_stage("ifl"):
        return await _compute_ifl_impl(
            asl=asl,
            pel=pel,
            gstl=gstl,
            utterance=utterance,
            question_text=question_text,
            job_role=job_role,
            longitudinal_history=longitudinal_history,
        )


async def _compute_ifl_impl(
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
    utterance: str,
    question_text: str,
    job_role: str,
    longitudinal_history: List[InteractionEntry],
) -> IFLOutput:
    feature_vector = build_feature_vector(asl, pel, gstl, longitudinal_history)

    try:
        prompt = _build_prompt(utterance, question_text, job_role, asl, pel, gstl)
        data = await call_groq_json(prompt, model=FAST_MODEL)
        raw_distribution = _normalize_distribution(data.get("intent_distribution", {}))
    except Exception as e:
        logger.warning(f"IFL LLM pass failed, falling back to uniform prior: {e}")
        raw_distribution = _uniform_intent_distribution()

    adjusted_distribution = apply_feature_weighted_prior(raw_distribution, feature_vector)
    intent_label, intent_confidence = compute_confidence(adjusted_distribution)
    entropy_value = compute_uncertainty(adjusted_distribution)
    max_entropy = math.log(len(INTENT_LABELS))

    should_solicit_clarification = (
        entropy_value > settings.mlim_clarification_entropy_threshold
        or intent_label == "expressing_confusion"
    )
    clarification_prompt = (
        _build_clarification_prompt(intent_label, question_text)
        if should_solicit_clarification
        else None
    )

    failure_mode_detected, failure_mode_explanation = _detect_failure_mode(
        intent_label, intent_confidence, pel, gstl, entropy_value, max_entropy
    )

    attributions = feature_attribution(
        feature_vector, adjusted_distribution, intent_label, INTENT_PRIOR_WEIGHTS
    )

    temp_ifl = IFLOutput(
        intent_label=intent_label,
        intent_confidence=intent_confidence,
        intent_distribution=adjusted_distribution,
        raw_intent_distribution=raw_distribution,
        feature_vector=feature_vector,
        entropy=entropy_value,
        should_solicit_clarification=should_solicit_clarification,
        clarification_prompt=clarification_prompt,
        intent_aware_response_modifier=RESPONSE_MODIFIERS.get(intent_label, "proceed_standard"),
        failure_mode_detected=failure_mode_detected,
        failure_mode_explanation=failure_mode_explanation,
        attributions=attributions,
        counterfactual="",
    )

    temp_analysis = MLIMAnalysis(
        session_id="",
        question_text=question_text,
        utterance=utterance,
        asl=asl,
        pel=pel,
        gstl=gstl,
        ifl=temp_ifl,
    )

    counterfactual = await counterfactual_explanation(temp_analysis)

    return IFLOutput(
        intent_label=intent_label,
        intent_confidence=intent_confidence,
        intent_distribution=adjusted_distribution,
        raw_intent_distribution=raw_distribution,
        feature_vector=feature_vector,
        entropy=entropy_value,
        should_solicit_clarification=should_solicit_clarification,
        clarification_prompt=clarification_prompt,
        intent_aware_response_modifier=RESPONSE_MODIFIERS.get(intent_label, "proceed_standard"),
        failure_mode_detected=failure_mode_detected,
        failure_mode_explanation=failure_mode_explanation,
        attributions=attributions,
        counterfactual=counterfactual,
    )