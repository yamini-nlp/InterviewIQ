import pytest
from unittest.mock import AsyncMock

from app.services.mlim.asl import compute_asl, lexicon_pass


async def test_pure_negative_text(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "sentiment": "negative",
        "sentiment_confidence": 0.9,
        "valence": -0.8,
        "arousal": 0.6,
        "uncertainty_s": 0.1,
        "affective_masking_detected": False,
        "masking_reason": None,
    })
    monkeypatch.setattr("app.services.mlim.asl.call_groq_json", mock_llm)

    result = await compute_asl("This was a terrible and awful failure.")

    assert result.sentiment == "negative"
    assert result.lexicon_sentiment == "negative"
    assert result.lexicon_llm_disagreement is False
    assert result.valence < 0
    mock_llm.assert_awaited_once()


async def test_pure_positive_text(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "sentiment": "positive",
        "sentiment_confidence": 0.92,
        "valence": 0.85,
        "arousal": 0.55,
        "uncertainty_s": 0.08,
        "affective_masking_detected": False,
        "masking_reason": None,
    })
    monkeypatch.setattr("app.services.mlim.asl.call_groq_json", mock_llm)

    result = await compute_asl("This was an excellent and amazing success.")

    assert result.sentiment == "positive"
    assert result.lexicon_sentiment == "positive"
    assert result.lexicon_llm_disagreement is False
    assert result.valence > 0


async def test_sarcasm_shaped_text(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "sentiment": "negative",
        "sentiment_confidence": 0.7,
        "valence": -0.5,
        "arousal": 0.7,
        "uncertainty_s": 0.3,
        "affective_masking_detected": True,
        "masking_reason": "Sarcastic tone inverts surface positivity",
    })
    monkeypatch.setattr("app.services.mlim.asl.call_groq_json", mock_llm)

    text = "Oh great, wonderful, another amazing failure. Just perfect."
    lex_sentiment, _, _ = lexicon_pass(text)
    assert lex_sentiment == "positive"

    result = await compute_asl(text)

    assert result.sentiment == "negative"
    assert result.affective_masking_detected is True
    assert result.lexicon_llm_disagreement is True
    assert result.uncertainty_s > 0.3
    mock_llm.assert_awaited_once()


async def test_negation_handling():
    sentiment, confidence, score = lexicon_pass("not bad at all")
    assert sentiment == "positive"
    assert score > 0


async def test_empty_string_edge_case(monkeypatch):
    mock_llm = AsyncMock(return_value={
        "sentiment": "neutral",
        "sentiment_confidence": 0.4,
        "valence": 0.0,
        "arousal": 0.3,
        "uncertainty_s": 0.6,
        "affective_masking_detected": False,
        "masking_reason": None,
    })
    monkeypatch.setattr("app.services.mlim.asl.call_groq_json", mock_llm)

    result = await compute_asl("")

    assert result.lexicon_sentiment == "neutral"
    assert result.lexicon_confidence == pytest.approx(0.2)
    assert result.sentiment == "neutral"