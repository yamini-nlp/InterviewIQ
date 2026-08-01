import logging
from typing import Dict, List

from app.models.mlim import FeatureAttribution, MLIMAnalysis
from app.services.groq_service import call_groq_json

logger = logging.getLogger(__name__)

MAX_ATTRIBUTIONS = 6


def feature_attribution(
    feature_vector: Dict[str, float],
    distribution: Dict[str, float],
    predicted_label: str,
    prior_weights: Dict[str, Dict[str, float]],
) -> List[FeatureAttribution]:
    attributions: List[FeatureAttribution] = []

    for feature_name, value in feature_vector.items():
        label_weights = prior_weights.get(feature_name)
        if not label_weights:
            continue
        weight = label_weights.get(predicted_label)
        if weight is None:
            continue
        contribution = weight * value
        attributions.append(
            FeatureAttribution(
                feature=feature_name,
                value=value,
                weight=weight,
                contribution=contribution,
            )
        )

    attributions.sort(key=lambda a: abs(a.contribution), reverse=True)
    return attributions[:MAX_ATTRIBUTIONS]


def _alternative_label(analysis: MLIMAnalysis) -> str:
    intent_label = analysis.ifl.intent_label
    sorted_labels = sorted(
        analysis.ifl.intent_distribution.items(), key=lambda kv: kv[1], reverse=True
    )
    alternatives = [label for label, _ in sorted_labels if label != intent_label]
    return alternatives[0] if alternatives else intent_label


def _build_counterfactual_prompt(analysis: MLIMAnalysis) -> str:
    ifl = analysis.ifl
    asl = analysis.asl
    pel = analysis.pel
    gstl = analysis.gstl
    alternative_label = _alternative_label(analysis)

    return f"""You are the Explainability Layer of an AI interview coaching system. Given the
following already-computed structured signals for a single conversational turn, produce a single
natural-language counterfactual sentence of exactly this form:

"If <specific observed signal> had instead been <plausible alternative>, the predicted intent
would likely have been <alternative label>."

Reason only over the structured signals below. Do not reinterpret or reference any raw utterance
text.

Predicted intent: {ifl.intent_label} (confidence={ifl.intent_confidence:.2f}, entropy={ifl.entropy:.2f})
Most plausible alternative intent: {alternative_label}
Affective signals: sentiment={asl.sentiment}, valence={asl.valence:.2f}, arousal={asl.arousal:.2f}, affective_masking_detected={asl.affective_masking_detected}
Pragmatic signals: primary_speech_act={pel.primary_speech_act}, sarcasm_detected={pel.sarcasm_detected}, pragmatic_inversion={pel.pragmatic_inversion}, is_face_saving={pel.is_face_saving}, is_signaling_confusion={pel.is_signaling_confusion}, is_seeking_validation={pel.is_seeking_validation}
Goal-state signals: dominant_goal={gstl.dominant_goal}, stress_indicators={gstl.stress_indicators:.2f}, engagement_level={gstl.engagement_level:.2f}, goal_drift_detected={gstl.goal_drift_detected}

Respond ONLY in this exact JSON format:
{{
  "counterfactual": "<single sentence following the required form>"
}}"""


def _fallback_counterfactual(analysis: MLIMAnalysis) -> str:
    alternative_label = _alternative_label(analysis)
    return (
        "If the stress indicators had instead been lower, "
        f"the predicted intent would likely have been {alternative_label}."
    )


async def counterfactual_explanation(analysis: MLIMAnalysis) -> str:
    try:
        prompt = _build_counterfactual_prompt(analysis)
        data = await call_groq_json(prompt, model="openai/gpt-oss-20b")
        sentence = data.get("counterfactual")
        if not sentence or not isinstance(sentence, str):
            return _fallback_counterfactual(analysis)
        return sentence.strip()
    except Exception as e:
        logger.warning(f"Counterfactual explanation LLM pass failed, falling back: {e}")
        return _fallback_counterfactual(analysis)