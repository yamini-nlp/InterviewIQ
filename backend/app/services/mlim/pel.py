import logging
from typing import List, Optional

from app.services.groq_service import call_groq_json
from app.models.mlim import ASLOutput, PELOutput, SpeechActType, SpeechActRoleScore

logger = logging.getLogger(__name__)

FAST_MODEL = "llama-3.1-8b-instant"

MAXIM_KEYS = ("quantity", "quality", "relation", "manner")

_VALID_ACTS = {act.value for act in SpeechActType}


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_context_str(context: List[str]) -> str:
    if not context:
        return "No prior context."
    return "\n".join([f"Turn {i + 1}: {u}" for i, u in enumerate(context[-5:])])


def _build_prompt(utterance: str, context: List[str], asl: ASLOutput) -> str:
    context_str = _build_context_str(context)

    return f"""You are a computational pragmatics system implementing speech act theory (Austin/Searle) and Gricean pragmatics.

Recent conversation context:
{context_str}

Current utterance: "{utterance}"

Upstream affective analysis (Layer 1 - ASL) has already been computed for this utterance:
- Surface sentiment: {asl.sentiment} (confidence: {asl.sentiment_confidence:.2f})
- Valence: {asl.valence:.2f}, Arousal: {asl.arousal:.2f}
- Lexicon sentiment: {asl.lexicon_sentiment}
- Affective masking detected: {asl.affective_masking_detected}

Analyze the illocutionary force and pragmatic features of the utterance. Per Searle's taxonomy, every
illocutionary act belongs to exactly one of five categories: directive, commissive, expressive,
declarative, representative. "Interrogative" is a surface grammatical form, not an illocutionary
category, so classify it separately as a boolean flag.

An utterance may simultaneously perform more than one speech act (e.g. an utterance can be
simultaneously expressive and commissive). List every concurrent speech act you detect with an
independent confidence score, rather than forcing a single label.

Also assess whether the utterance's pragmatically-inferred valence (the emotional stance implied by
context, tone, and implicature) diverges from its literal/lexical valence, and evaluate the utterance
against Grice's four conversational maxims (quantity, quality, relation, manner).

Respond ONLY in this exact JSON format:
{{
  "concurrent_speech_acts": [
    {{"act": "directive|commissive|expressive|declarative|representative", "confidence": <float 0.0-1.0>}}
  ],
  "is_interrogative": <boolean, true if the utterance is grammatically a question>,
  "sarcasm_detected": <boolean>,
  "pragmatic_valence": <float -1.0 to 1.0, the pragmatically-inferred valence, independent of literal sentiment>,
  "illocutionary_force_features": {{
    "is_requesting_challenge": <boolean>,
    "is_expressing_frustration": <boolean>,
    "is_signaling_confusion": <boolean>,
    "is_face_saving": <boolean>,
    "is_seeking_validation": <boolean>,
    "is_committing_to_retry": <boolean>
  }},
  "maxim_violations": {{
    "quantity": <boolean, true if the utterance says too much or too little relative to what is required>,
    "quality": <boolean, true if the utterance asserts something the speaker lacks evidence for or believes false>,
    "relation": <boolean, true if the utterance is not relevant to the current question/context>,
    "manner": <boolean, true if the utterance is obscure, ambiguous, or disorderly>
  }},
  "gricean_implicature": "<what the utterance implies beyond its literal content>",
  "pragmatic_context_label": "<one phrase describing the pragmatic situation>"
}}"""


def _parse_concurrent_speech_acts(raw: List[dict]) -> List[SpeechActRoleScore]:
    parsed: List[SpeechActRoleScore] = []
    if not raw:
        return parsed

    for entry in raw:
        if not isinstance(entry, dict):
            continue
        act = entry.get("act")
        if act not in _VALID_ACTS:
            continue
        confidence = max(0.0, min(1.0, _safe_float(entry.get("confidence", 0.5), 0.5)))
        parsed.append(SpeechActRoleScore(act=SpeechActType(act), confidence=confidence))

    return parsed


def _normalize_maxim_violations(raw: Optional[dict]) -> dict:
    raw = raw or {}
    return {key: bool(raw.get(key, False)) for key in MAXIM_KEYS}


def detect_pragmatic_inversion(asl: ASLOutput, pel_raw: dict) -> bool:
    lexical_valence = asl.valence
    pragmatic_valence = _safe_float(pel_raw.get("pragmatic_valence", 0.0))

    if lexical_valence == 0.0 or pragmatic_valence == 0.0:
        return False

    return (lexical_valence > 0.0) != (pragmatic_valence > 0.0)


async def compute_pel(utterance: str, context: List[str], asl: ASLOutput) -> PELOutput:
    try:
        prompt = _build_prompt(utterance, context, asl)
        data = await call_groq_json(prompt, model=FAST_MODEL)

        concurrent_speech_acts = _parse_concurrent_speech_acts(
            data.get("concurrent_speech_acts", [])
        )
        if not concurrent_speech_acts:
            concurrent_speech_acts = [
                SpeechActRoleScore(act=SpeechActType.representative, confidence=0.5)
            ]

        ranked = sorted(concurrent_speech_acts, key=lambda s: s.confidence, reverse=True)
        primary = ranked[0]
        secondary = [s.act.value for s in ranked[1:]]

        ilf = data.get("illocutionary_force_features", {})
        maxim_violations = _normalize_maxim_violations(data.get("maxim_violations"))
        pragmatic_inversion = detect_pragmatic_inversion(asl, data)

        return PELOutput(
            primary_speech_act=primary.act.value,
            speech_act_confidence=primary.confidence,
            secondary_speech_acts=secondary,
            concurrent_speech_acts=concurrent_speech_acts,
            is_interrogative=bool(data.get("is_interrogative", False)),
            sarcasm_detected=bool(data.get("sarcasm_detected", False)),
            pragmatic_inversion=pragmatic_inversion,
            is_requesting_challenge=bool(ilf.get("is_requesting_challenge", False)),
            is_expressing_frustration=bool(ilf.get("is_expressing_frustration", False)),
            is_signaling_confusion=bool(ilf.get("is_signaling_confusion", False)),
            is_face_saving=bool(ilf.get("is_face_saving", False)),
            is_seeking_validation=bool(ilf.get("is_seeking_validation", False)),
            is_committing_to_retry=bool(ilf.get("is_committing_to_retry", False)),
            maxim_violations=maxim_violations,
            gricean_implicature=data.get("gricean_implicature", ""),
            pragmatic_context_label=data.get("pragmatic_context_label", ""),
        )
    except Exception as e:
        logger.warning(f"PEL LLM pass failed, falling back to default result: {e}")
        fallback_act = SpeechActRoleScore(act=SpeechActType.representative, confidence=0.3)
        return PELOutput(
            primary_speech_act=fallback_act.act.value,
            speech_act_confidence=fallback_act.confidence,
            secondary_speech_acts=[],
            concurrent_speech_acts=[fallback_act],
            is_interrogative=False,
            sarcasm_detected=False,
            pragmatic_inversion=False,
            is_requesting_challenge=False,
            is_expressing_frustration=False,
            is_signaling_confusion=False,
            is_face_saving=False,
            is_seeking_validation=False,
            is_committing_to_retry=False,
            maxim_violations=_normalize_maxim_violations(None),
            gricean_implicature="",
            pragmatic_context_label="",
        )