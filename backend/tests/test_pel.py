import pytest
from unittest.mock import AsyncMock

from app.services.mlim.pel import compute_pel, detect_pragmatic_inversion
from app.models.mlim import ASLOutput, SpeechActType


def _make_asl(**overrides) -> ASLOutput:
    defaults = dict(
        sentiment="neutral",
        sentiment_confidence=0.6,
        valence=0.0,
        arousal=0.4,
        uncertainty_s=0.3,
        affective_masking_detected=False,
        masking_reason=None,
        lexicon_sentiment="neutral",
        lexicon_confidence=0.5,
        lexicon_llm_disagreement=False,
    )
    defaults.update(overrides)
    return ASLOutput(**defaults)


async def test_multi_role_frustration_and_retry(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "concurrent_speech_acts": [
            {"act": "expressive", "confidence": 0.82},
            {"act": "commissive", "confidence": 0.71},
        ],
        "is_interrogative": False,
        "sarcasm_detected": False,
        "pragmatic_valence": -0.3,
        "illocutionary_force_features": {
            "is_requesting_challenge": False,
            "is_expressing_frustration": True,
            "is_signaling_confusion": False,
            "is_face_saving": False,
            "is_seeking_validation": False,
            "is_committing_to_retry": True,
        },
        "maxim_violations": {
            "quantity": False,
            "quality": False,
            "relation": False,
            "manner": False,
        },
        "gricean_implicature": "The speaker is frustrated but intends to try again.",
        "pragmatic_context_label": "frustrated recommitment",
    })
    monkeypatch.setattr("app.services.mlim.pel.call_groq_json", mock_llm)

    asl = _make_asl(sentiment="negative", valence=-0.2)
    result = await compute_pel(
        "Ugh, I messed that up, but let me try that question again.", [], asl
    )

    assert result.is_expressing_frustration is True
    assert result.is_committing_to_retry is True
    assert len(result.concurrent_speech_acts) == 2
    acts = {s.act for s in result.concurrent_speech_acts}
    assert acts == {SpeechActType.expressive, SpeechActType.commissive}
    assert result.primary_speech_act == "expressive"
    assert result.speech_act_confidence == pytest.approx(0.82)
    assert result.secondary_speech_acts == ["commissive"]
    mock_llm.assert_awaited_once()


async def test_sarcasm_produces_pragmatic_inversion(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "concurrent_speech_acts": [
            {"act": "representative", "confidence": 0.75},
        ],
        "is_interrogative": False,
        "sarcasm_detected": True,
        "pragmatic_valence": -0.7,
        "illocutionary_force_features": {
            "is_requesting_challenge": False,
            "is_expressing_frustration": True,
            "is_signaling_confusion": False,
            "is_face_saving": False,
            "is_seeking_validation": False,
            "is_committing_to_retry": False,
        },
        "maxim_violations": {
            "quantity": False,
            "quality": True,
            "relation": False,
            "manner": False,
        },
        "gricean_implicature": "The speaker means the opposite of what was said.",
        "pragmatic_context_label": "sarcastic deflection",
    })
    monkeypatch.setattr("app.services.mlim.pel.call_groq_json", mock_llm)

    asl = _make_asl(sentiment="positive", valence=0.6, lexicon_sentiment="positive")
    result = await compute_pel("Oh great, another wonderful bug in production.", [], asl)

    assert result.sarcasm_detected is True
    assert result.pragmatic_inversion is True


async def test_maxim_of_quantity_violation_overanswering(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "concurrent_speech_acts": [
            {"act": "representative", "confidence": 0.9},
        ],
        "is_interrogative": False,
        "sarcasm_detected": False,
        "pragmatic_valence": 0.1,
        "illocutionary_force_features": {
            "is_requesting_challenge": False,
            "is_expressing_frustration": False,
            "is_signaling_confusion": False,
            "is_face_saving": False,
            "is_seeking_validation": False,
            "is_committing_to_retry": False,
        },
        "maxim_violations": {
            "quantity": True,
            "quality": False,
            "relation": False,
            "manner": False,
        },
        "gricean_implicature": "The speaker over-answered beyond what was asked.",
        "pragmatic_context_label": "over-informative answer",
    })
    monkeypatch.setattr("app.services.mlim.pel.call_groq_json", mock_llm)

    asl = _make_asl()
    result = await compute_pel(
        "So to answer your simple yes/no question, here is my entire career history in detail...",
        ["Did you enjoy that project?"],
        asl,
    )

    assert result.maxim_violations["quantity"] is True
    assert result.maxim_violations["quality"] is False
    assert result.maxim_violations["relation"] is False
    assert result.maxim_violations["manner"] is False


async def test_empty_context_list(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "concurrent_speech_acts": [
            {"act": "directive", "confidence": 0.6},
        ],
        "is_interrogative": True,
        "sarcasm_detected": False,
        "pragmatic_valence": 0.0,
        "illocutionary_force_features": {
            "is_requesting_challenge": True,
            "is_expressing_frustration": False,
            "is_signaling_confusion": False,
            "is_face_saving": False,
            "is_seeking_validation": False,
            "is_committing_to_retry": False,
        },
        "maxim_violations": {
            "quantity": False,
            "quality": False,
            "relation": False,
            "manner": False,
        },
        "gricean_implicature": "The speaker wants a harder question.",
        "pragmatic_context_label": "challenge request",
    })
    monkeypatch.setattr("app.services.mlim.pel.call_groq_json", mock_llm)

    asl = _make_asl()
    result = await compute_pel("Can you give me something tougher?", [], asl)

    assert result.is_interrogative is True
    assert result.is_requesting_challenge is True
    assert result.pragmatic_inversion is False
    mock_llm.assert_awaited_once()


def test_detect_pragmatic_inversion_disagreement():
    asl = _make_asl(valence=0.6)
    assert detect_pragmatic_inversion(asl, {"pragmatic_valence": -0.4}) is True


def test_detect_pragmatic_inversion_agreement():
    asl = _make_asl(valence=0.6)
    assert detect_pragmatic_inversion(asl, {"pragmatic_valence": 0.4}) is False


def test_detect_pragmatic_inversion_zero_valence_no_inversion():
    asl = _make_asl(valence=0.0)
    assert detect_pragmatic_inversion(asl, {"pragmatic_valence": -0.4}) is False