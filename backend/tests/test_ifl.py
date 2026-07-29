import math
import pytest

from app.models.mlim import ASLOutput, PELOutput, GSTLOutput, InteractionEntry, SpeechActRoleScore, SpeechActType
from app.services.mlim.ifl import (
    build_feature_vector,
    apply_feature_weighted_prior,
    compute_confidence,
    compute_uncertainty,
    INTENT_LABELS,
)


def _make_asl() -> ASLOutput:
    return ASLOutput(
        sentiment="positive",
        sentiment_confidence=0.8,
        valence=0.6,
        arousal=0.5,
        uncertainty_s=0.2,
        affective_masking_detected=False,
        masking_reason=None,
        lexicon_sentiment="positive",
        lexicon_confidence=0.7,
        lexicon_llm_disagreement=False,
    )


def _make_pel(pragmatic_inversion: bool = False, is_face_saving: bool = False) -> PELOutput:
    return PELOutput(
        primary_speech_act="representative",
        speech_act_confidence=0.7,
        secondary_speech_acts=[],
        concurrent_speech_acts=[
            SpeechActRoleScore(act=SpeechActType.representative, confidence=0.7),
            SpeechActRoleScore(act=SpeechActType.expressive, confidence=0.3),
        ],
        is_interrogative=False,
        sarcasm_detected=False,
        pragmatic_inversion=pragmatic_inversion,
        is_requesting_challenge=False,
        is_expressing_frustration=False,
        is_signaling_confusion=False,
        is_face_saving=is_face_saving,
        is_seeking_validation=False,
        is_committing_to_retry=False,
        maxim_violations={"quantity": False, "quality": False, "relation": False, "manner": False},
        gricean_implicature="",
        pragmatic_context_label="",
    )


def _make_gstl() -> GSTLOutput:
    return GSTLOutput(
        dominant_goal="demonstrate_competence",
        goal_belief_distribution={
            "demonstrate_competence": 0.5,
            "seek_feedback": 0.15,
            "pass_screening": 0.15,
            "build_confidence": 0.1,
            "explore_role": 0.1,
        },
        confidence_level=0.5,
        goal_drift_detected=False,
        session_trajectory="stable",
        engagement_level=0.6,
        stress_indicators=0.3,
        readiness_estimate=0.5,
        recommended_system_action="encourage",
        hiring_readiness_signal="neutral",
        belief_update_trace={},
        goal_drift_kl_divergence=0.0,
    )


def _make_history():
    return [
        InteractionEntry(question="Q1", answer="A1", score=5, intent_label="genuine_answer"),
        InteractionEntry(question="Q2", answer="A2", score=7, intent_label="genuine_answer"),
        InteractionEntry(question="Q3", answer="A3", score=8, intent_label="genuine_answer"),
    ]


def test_build_feature_vector_contains_expected_keys():
    asl = _make_asl()
    pel = _make_pel()
    gstl = _make_gstl()
    history = _make_history()

    features = build_feature_vector(asl, pel, gstl, history)

    assert features["valence"] == asl.valence
    assert features["arousal"] == asl.arousal
    assert features["sentiment_confidence"] == asl.sentiment_confidence
    assert features["uncertainty_s"] == asl.uncertainty_s

    assert features["speech_act_conf_representative"] == 0.7
    assert features["speech_act_conf_expressive"] == 0.3
    assert features["sarcasm_detected"] == 0.0
    assert features["pragmatic_inversion"] == 0.0
    assert features["maxim_violation_quantity"] == 0.0

    assert features["goal_belief_demonstrate_competence"] == 0.5
    assert features["engagement_level"] == gstl.engagement_level
    assert features["stress_indicators"] == gstl.stress_indicators
    assert features["readiness_estimate"] == gstl.readiness_estimate
    assert features["goal_drift_detected"] == 0.0

    assert features["history_mean_score"] == pytest.approx((5 + 7 + 8) / 3)
    assert features["history_trend_sign"] == 1.0


def test_build_feature_vector_empty_history():
    asl = _make_asl()
    pel = _make_pel()
    gstl = _make_gstl()

    features = build_feature_vector(asl, pel, gstl, [])

    assert features["history_mean_score"] == 0.0
    assert features["history_trend_sign"] == 0.0


def test_apply_feature_weighted_prior_boosts_expected_label_and_sums_to_one():
    base_distribution = {label: 1.0 / len(INTENT_LABELS) for label in INTENT_LABELS}
    feature_vector = {"pragmatic_inversion": 1.0}

    adjusted = apply_feature_weighted_prior(base_distribution, feature_vector)

    assert adjusted["sarcastic_response"] > base_distribution["sarcastic_response"]
    assert sum(adjusted.values()) == pytest.approx(1.0)
    assert all(v >= 0.0 for v in adjusted.values())


def test_apply_feature_weighted_prior_no_signal_preserves_normalized_distribution():
    base_distribution = {label: 1.0 / len(INTENT_LABELS) for label in INTENT_LABELS}
    feature_vector = {"pragmatic_inversion": 0.0, "is_face_saving": 0.0}

    adjusted = apply_feature_weighted_prior(base_distribution, feature_vector)

    for label in INTENT_LABELS:
        assert adjusted[label] == pytest.approx(base_distribution[label])
    assert sum(adjusted.values()) == pytest.approx(1.0)


def test_apply_feature_weighted_prior_handles_zero_input_distribution():
    zero_distribution = {label: 0.0 for label in INTENT_LABELS}
    feature_vector = {}

    adjusted = apply_feature_weighted_prior(zero_distribution, feature_vector)

    assert sum(adjusted.values()) == pytest.approx(1.0)
    for label in INTENT_LABELS:
        assert adjusted[label] == pytest.approx(1.0 / len(INTENT_LABELS))


def test_compute_confidence_and_uncertainty_hand_computed():
    distribution = {
        "genuine_answer": 0.5,
        "face_saving_assertion": 0.25,
        "request_for_challenge": 0.1,
        "expressing_confusion": 0.05,
        "sarcastic_response": 0.05,
        "seeking_validation": 0.025,
        "committed_retry": 0.015,
        "off_topic": 0.01,
    }

    label, confidence = compute_confidence(distribution)
    assert label == "genuine_answer"
    assert confidence == pytest.approx(0.5)

    expected_entropy = -sum(p * math.log(p) for p in distribution.values() if p > 0.0)
    assert compute_uncertainty(distribution) == pytest.approx(expected_entropy)


def test_compute_uncertainty_zero_for_certain_distribution():
    distribution = {label: 0.0 for label in INTENT_LABELS}
    distribution["genuine_answer"] = 1.0

    assert compute_uncertainty(distribution) == pytest.approx(0.0)