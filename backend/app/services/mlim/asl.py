import math
import re
import logging
from typing import Optional, Tuple, Dict

from app.services.groq_service import call_groq_json
from app.models.mlim import ASLOutput

logger = logging.getLogger(__name__)

FAST_MODEL = "llama-3.1-8b-instant"

NEGATIONS = {
    "not", "no", "never", "none", "nobody", "nothing", "neither", "nowhere",
    "cannot", "cant",
}

INTENSIFIERS: Dict[str, float] = {
    "very": 1.5, "extremely": 1.8, "incredibly": 1.8, "really": 1.3,
    "so": 1.3, "totally": 1.4, "absolutely": 1.6, "completely": 1.5,
    "utterly": 1.6, "highly": 1.4,
}

DAMPENERS: Dict[str, float] = {
    "slightly": 0.5, "somewhat": 0.6, "barely": 0.4, "hardly": 0.4,
    "kinda": 0.6, "rather": 0.7, "fairly": 0.7,
}

POLARITY_LEXICON: Dict[str, float] = {
    "good": 2.0, "great": 3.1, "excellent": 3.6, "amazing": 3.4, "awesome": 3.2,
    "fantastic": 3.3, "wonderful": 3.0, "love": 3.2, "loved": 3.0, "happy": 2.7,
    "pleased": 2.3, "confident": 2.2, "strong": 1.8, "nice": 1.8, "perfect": 3.5,
    "best": 2.9, "positive": 1.7, "success": 2.0, "successful": 2.1,
    "impressive": 2.4, "efficient": 1.6, "clear": 1.4, "clean": 1.2,
    "helpful": 1.8, "easy": 1.4, "smooth": 1.5, "well": 1.3, "solid": 1.6,
    "brilliant": 3.0, "outstanding": 3.1, "proud": 2.1, "comfortable": 1.6,
    "bad": -2.5, "terrible": -3.4, "awful": -3.1, "horrible": -3.4,
    "poor": -2.2, "weak": -1.8, "difficult": -1.5, "hard": -1.2,
    "confused": -1.8, "confusing": -1.8, "frustrated": -2.4,
    "frustrating": -2.4, "fail": -2.6, "failure": -2.7, "wrong": -2.0,
    "nervous": -1.6, "anxious": -1.8, "worried": -1.7, "stressed": -2.0,
    "struggle": -1.8, "struggling": -1.8, "unclear": -1.5, "messy": -1.6,
    "broken": -1.9, "worst": -3.2, "hate": -3.0, "hated": -2.8,
    "disappointing": -2.3, "disappointed": -2.3, "sad": -2.0, "angry": -2.5,
    "annoyed": -1.9, "uncomfortable": -1.6, "regret": -1.9,
}

_TOKEN_RE = re.compile(r"[a-z']+")


def _tokenize(text: str):
    return _TOKEN_RE.findall(text.lower())


def _is_negation(token: str) -> bool:
    return token in NEGATIONS or token.endswith("n't")


def lexicon_pass(text: str) -> Tuple[str, float, float]:
    tokens = _tokenize(text)
    if not tokens:
        return "neutral", 0.2, 0.0

    raw_score = 0.0
    matched = 0

    for idx, token in enumerate(tokens):
        base = POLARITY_LEXICON.get(token)
        if base is None:
            continue

        window = tokens[max(0, idx - 3):idx]
        negate = any(_is_negation(w) for w in window)

        intensity = 1.0
        for w in window:
            if w in INTENSIFIERS:
                intensity *= INTENSIFIERS[w]
            elif w in DAMPENERS:
                intensity *= DAMPENERS[w]

        word_score = base * intensity
        if negate:
            word_score = -word_score * 0.74

        raw_score += word_score
        matched += 1

    if matched == 0:
        return "neutral", 0.25, 0.0

    normalized = raw_score / math.sqrt(matched)
    clipped = max(-1.0, min(1.0, normalized / 4.0))

    if clipped > 0.05:
        sentiment = "positive"
    elif clipped < -0.05:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    confidence = min(1.0, 0.35 + abs(clipped) * 0.55 + min(matched, 5) * 0.04)
    return sentiment, round(confidence, 3), round(clipped, 3)


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_llm_prompt(
    utterance: str,
    face_snapshot: Optional[dict],
    voice_features: Optional[dict],
    lexicon_sentiment: str,
    lexicon_score: float,
) -> str:
    face_str = ""
    if face_snapshot:
        dominant = face_snapshot.get("dominantExpression", "neutral")
        confidence = _safe_float(face_snapshot.get("confidence", 0))
        face_str = f"\nFacial expression data: dominant={dominant} (confidence={confidence:.2f})"

    voice_str = ""
    if voice_features:
        pace = voice_features.get("pace", "unknown")
        energy = _safe_float(voice_features.get("energy", 0))
        voice_str = f"\nVoice features: pace={pace}, energy={energy:.2f}"

    return f"""You are an affective computing system. Analyze this utterance for sentiment and dimensional affect.

Utterance: "{utterance}"{face_str}{voice_str}

A deterministic lexicon pass independently estimated sentiment="{lexicon_sentiment}" with a normalized polarity score of {lexicon_score:.2f} (range -1.0 to 1.0). Use this as a weak prior, not ground truth; override it if the pragmatic or contextual meaning differs (e.g. sarcasm, negation, mixed affect).

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


def _reconcile(
    lexicon_sentiment: str,
    llm_sentiment: str,
    lexicon_confidence: float,
    llm_uncertainty: float,
) -> Tuple[bool, float]:
    disagreement = (
        lexicon_sentiment != "neutral"
        and llm_sentiment != "neutral"
        and lexicon_sentiment != llm_sentiment
    )
    adjusted_uncertainty = llm_uncertainty
    if disagreement:
        adjusted_uncertainty = min(1.0, llm_uncertainty + 0.3 + lexicon_confidence * 0.2)
    return disagreement, round(adjusted_uncertainty, 3)


async def compute_asl(
    utterance: str,
    face_snapshot: Optional[dict] = None,
    voice_features: Optional[dict] = None,
) -> ASLOutput:
    lexicon_sentiment, lexicon_confidence, lexicon_score = lexicon_pass(utterance)

    try:
        prompt = _build_llm_prompt(
            utterance, face_snapshot, voice_features, lexicon_sentiment, lexicon_score
        )
        data = await call_groq_json(prompt, model=FAST_MODEL)

        llm_sentiment = data.get("sentiment", "neutral")
        sentiment_confidence = max(0.0, min(1.0, _safe_float(data.get("sentiment_confidence", 0.5), 0.5)))
        valence = max(-1.0, min(1.0, _safe_float(data.get("valence", 0.0), 0.0)))
        arousal = max(0.0, min(1.0, _safe_float(data.get("arousal", 0.5), 0.5)))
        uncertainty_s = max(0.0, min(1.0, _safe_float(data.get("uncertainty_s", 0.5), 0.5)))
        affective_masking_detected = bool(data.get("affective_masking_detected", False))
        masking_reason = data.get("masking_reason")

        disagreement, uncertainty_s = _reconcile(
            lexicon_sentiment, llm_sentiment, lexicon_confidence, uncertainty_s
        )

        return ASLOutput(
            sentiment=llm_sentiment,
            sentiment_confidence=sentiment_confidence,
            valence=valence,
            arousal=arousal,
            uncertainty_s=uncertainty_s,
            affective_masking_detected=affective_masking_detected,
            masking_reason=masking_reason,
            lexicon_sentiment=lexicon_sentiment,
            lexicon_confidence=lexicon_confidence,
            lexicon_llm_disagreement=disagreement,
        )
    except Exception as e:
        logger.warning(f"ASL LLM pass failed, falling back to lexicon-only result: {e}")
        fallback_valence = max(-1.0, min(1.0, lexicon_score))
        return ASLOutput(
            sentiment=lexicon_sentiment,
            sentiment_confidence=lexicon_confidence,
            valence=fallback_valence,
            arousal=0.5,
            uncertainty_s=min(1.0, 0.6 + (1.0 - lexicon_confidence) * 0.4),
            affective_masking_detected=False,
            masking_reason=None,
            lexicon_sentiment=lexicon_sentiment,
            lexicon_confidence=lexicon_confidence,
            lexicon_llm_disagreement=False,
        )