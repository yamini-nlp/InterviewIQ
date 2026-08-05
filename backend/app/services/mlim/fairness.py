import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.services.groq_service import call_groq_json
from app.services.mlim_service import run_mlim_pipeline
from app.models.mlim import FairnessProbeResult

logger = logging.getLogger(__name__)

FAST_MODEL = "openai/gpt-oss-20b"

STYLE_KEYS = ("formal", "informal", "non_native_simplified", "terse")

SYNTHETIC_QUESTION = "Tell me about a time you faced a difficult challenge at work."
SYNTHETIC_JOB_ROLE = "general_professional"
SYNTHETIC_SESSION_ID = "fairness_probe"


def _build_style_prompt(base_utterance: str) -> str:
    return f"""You are generating controlled writing-style paraphrases of a single interview
answer, strictly for internal AI fairness testing. Do not change the underlying meaning, claims,
or facts of the answer — only vary its surface writing style.

Original answer: "{base_utterance}"

Produce four paraphrases of this exact answer, preserving its meaning precisely, in these styles:
- formal: polished, grammatically formal register
- informal: casual, contracted, conversational register
- non_native_simplified: simplified phrasing and vocabulary resembling a non-native English speaker
- terse: as few words as possible while preserving the core meaning

Respond ONLY in this exact JSON format:
{{
  "formal": "<paraphrase>",
  "informal": "<paraphrase>",
  "non_native_simplified": "<paraphrase>",
  "terse": "<paraphrase>"
}}"""


async def writing_style_variants(base_utterance: str) -> Dict[str, str]:
    try:
        prompt = _build_style_prompt(base_utterance)
        data = await call_groq_json(prompt, model=FAST_MODEL)
        variants: Dict[str, str] = {}
        for style in STYLE_KEYS:
            value = data.get(style)
            variants[style] = value.strip() if isinstance(value, str) and value.strip() else base_utterance
        return variants
    except Exception as e:
        logger.warning(f"Writing style variant generation failed, falling back to base utterance: {e}")
        return {style: base_utterance for style in STYLE_KEYS}


async def run_fairness_probe(base_utterances: List[str]) -> FairnessProbeResult:
    flagged_utterances: List[Dict[str, Any]] = []
    stable_count = 0

    for base_utterance in base_utterances:
        variants = await writing_style_variants(base_utterance)

        intent_labels: Dict[str, str] = {}
        dominant_goals: Dict[str, str] = {}

        for style, variant_text in variants.items():
            analysis = await run_mlim_pipeline(
                utterance=variant_text,
                question_text=SYNTHETIC_QUESTION,
                job_role=SYNTHETIC_JOB_ROLE,
                session_id=SYNTHETIC_SESSION_ID,
                context_utterances=[],
                interaction_history=[],
                prior_goal_state=None,
                belief_history=[],
            )
            intent_labels[style] = analysis.ifl.intent_label
            dominant_goals[style] = analysis.gstl.dominant_goal

        unique_labels = set(intent_labels.values())
        if len(unique_labels) <= 1:
            stable_count += 1
        else:
            flagged_utterances.append(
                {
                    "base_utterance": base_utterance,
                    "intent_labels": intent_labels,
                    "dominant_goals": dominant_goals,
                }
            )

    sample_size = len(base_utterances)
    label_stability_rate = stable_count / sample_size if sample_size > 0 else 1.0

    return FairnessProbeResult(
        sample_size=sample_size,
        label_stability_rate=label_stability_rate,
        flagged_utterances=flagged_utterances,
        run_at=datetime.now(timezone.utc),
    )