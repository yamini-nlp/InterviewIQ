import pytest

from app.models.mlim import MLIMAnalysis
from app.services.mlim.benchmark import (
    compute_mi_comparison,
    entropy,
    mutual_information,
    reduce_to_sentiment_only,
)


def _make_analysis(
    session_id: str,
    intent_label: str,
    sentiment: str,
    dominant_goal: str,
    primary_speech_act: str,
) -> MLIMAnalysis:
    return MLIMAnalysis.model_validate(
        {
            "session_id": session_id,
            "question_text": "Tell me about a challenge you faced.",
            "utterance": "Sure, let me walk you through it.",
            "asl": {
                "sentiment": sentiment,
                "sentiment_confidence": 0.8,
                "valence": 0.5 if sentiment == "positive" else (-0.5 if sentiment == "negative" else 0.0),
                "arousal": 0.5,
                "uncertainty_s": 0.2,
                "affective_masking_detected": False,
                "masking_reason": None,
                "lexicon_sentiment": sentiment,
                "lexicon_confidence": 0.7,
                "lexicon_llm_disagreement": False,
            },
            "pel": {
                "primary_speech_act": primary_speech_act,
                "speech_act_confidence": 0.7,
                "secondary_speech_acts": [],
                "concurrent_speech_acts": [],
                "is_interrogative": False,
                "sarcasm_detected": False,
                "pragmatic_inversion": False,
                "is_requesting_challenge": False,
                "is_expressing_frustration": False,
                "is_signaling_confusion": False,
                "is_face_saving": False,
                "is_seeking_validation": False,
                "is_committing_to_retry": False,
                "maxim_violations": {},
                "gricean_implicature": "",
                "pragmatic_context_label": "",
            },
            "gstl": {
                "dominant_goal": dominant_goal,
                "goal_belief_distribution": {dominant_goal: 1.0},
                "confidence_level": 0.8,
                "goal_drift_detected": False,
                "session_trajectory": "stable",
                "engagement_level": 0.6,
                "stress_indicators": 0.3,
                "readiness_estimate": 0.5,
                "recommended_system_action": "encourage",
                "hiring_readiness_signal": "neutral",
                "belief_update_trace": {},
                "goal_drift_kl_divergence": 0.0,
            },
            "ifl": {
                "intent_label": intent_label,
                "intent_confidence": 0.9,
                "intent_distribution": {intent_label: 0.9},
                "raw_intent_distribution": {},
                "feature_vector": {},
                "entropy": 0.1,
                "should_solicit_clarification": False,
                "clarification_prompt": None,
                "intent_aware_response_modifier": "proceed_standard",
                "failure_mode_detected": "none",
                "failure_mode_explanation": None,
            },
        }
    )


def test_mlim_strictly_more_informative_when_intent_independent_of_sentiment():
    analyses = [
        _make_analysis(
            "s1", "genuine_answer", "positive", "demonstrate_competence", "representative"
        ),
        _make_analysis(
            "s1", "sarcastic_response", "positive", "build_confidence", "expressive"
        ),
        _make_analysis(
            "s1", "genuine_answer", "negative", "demonstrate_competence", "representative"
        ),
        _make_analysis(
            "s1", "sarcastic_response", "negative", "build_confidence", "expressive"
        ),
    ]

    result = compute_mi_comparison(analyses)

    assert result.sample_size == 4
    assert result.mi_sentiment_only == pytest.approx(0.0, abs=1e-9)
    assert result.mi_full_signal > result.mi_sentiment_only
    assert result.mlim_strictly_more_informative is True


def test_degenerate_single_intent_label_yields_zero_mi_without_error():
    analyses = [
        _make_analysis(
            "s2", "genuine_answer", "positive", "demonstrate_competence", "representative"
        ),
        _make_analysis(
            "s2", "genuine_answer", "negative", "build_confidence", "expressive"
        ),
        _make_analysis(
            "s2", "genuine_answer", "neutral", "seek_feedback", "directive"
        ),
    ]

    result = compute_mi_comparison(analyses)

    assert result.sample_size == 3
    assert result.mi_sentiment_only == pytest.approx(0.0, abs=1e-9)
    assert result.mi_full_signal == pytest.approx(0.0, abs=1e-9)
    assert result.mlim_strictly_more_informative is False


def test_reduce_to_sentiment_only_maps_known_sentiments():
    positive = _make_analysis(
        "s3", "genuine_answer", "positive", "demonstrate_competence", "representative"
    )
    negative = _make_analysis(
        "s3", "genuine_answer", "negative", "demonstrate_competence", "representative"
    )
    neutral = _make_analysis(
        "s3", "genuine_answer", "neutral", "demonstrate_competence", "representative"
    )

    assert reduce_to_sentiment_only(positive) == "affirm"
    assert reduce_to_sentiment_only(negative) == "comfort"
    assert reduce_to_sentiment_only(neutral) == "neutral_ack"


def test_entropy_zero_for_certain_distribution():
    assert entropy({"a": 1.0, "b": 0.0}) == pytest.approx(0.0)


def test_entropy_handles_empty_distribution_without_error():
    assert entropy({}) == 0.0


def test_mutual_information_zero_for_empty_counts():
    assert mutual_information({}) == 0.0