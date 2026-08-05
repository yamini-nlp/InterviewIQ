from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.models.mlim import FairnessProbeResult
from app.services.mlim import fairness as fairness_module


def test_fairness_probe_result_serialization():
    result = FairnessProbeResult(
        sample_size=2,
        label_stability_rate=0.5,
        flagged_utterances=[
            {
                "base_utterance": "x",
                "intent_labels": {
                    "formal": "genuine_answer",
                    "informal": "expressing_confusion",
                },
            }
        ],
        run_at=datetime.now(timezone.utc),
    )

    dumped = result.model_dump()

    assert dumped["sample_size"] == 2
    assert dumped["label_stability_rate"] == 0.5
    assert isinstance(dumped["flagged_utterances"], list)
    assert dumped["flagged_utterances"][0]["base_utterance"] == "x"
    assert "run_at" in dumped


@pytest.mark.asyncio
async def test_run_fairness_probe_computes_stability_rate(monkeypatch):
    async def fake_variants(base_utterance):
        return {
            "formal": f"{base_utterance}::formal",
            "informal": f"{base_utterance}::informal",
            "non_native_simplified": f"{base_utterance}::non_native_simplified",
            "terse": f"{base_utterance}::terse",
        }

    async def fake_run_mlim_pipeline(utterance, **kwargs):
        if "inconsistent" in utterance and "::formal" in utterance:
            label = "expressing_confusion"
        else:
            label = "genuine_answer"
        return SimpleNamespace(
            ifl=SimpleNamespace(intent_label=label),
            gstl=SimpleNamespace(dominant_goal="pass_interview"),
        )

    monkeypatch.setattr(fairness_module, "writing_style_variants", fake_variants)
    monkeypatch.setattr(fairness_module, "run_mlim_pipeline", fake_run_mlim_pipeline)

    result = await fairness_module.run_fairness_probe(
        ["consistent utterance", "inconsistent utterance"]
    )

    assert result.sample_size == 2
    assert result.label_stability_rate == 0.5
    assert len(result.flagged_utterances) == 1
    assert result.flagged_utterances[0]["base_utterance"] == "inconsistent utterance"
    assert result.flagged_utterances[0]["intent_labels"]["formal"] == "expressing_confusion"
    assert result.flagged_utterances[0]["intent_labels"]["informal"] == "genuine_answer"


@pytest.mark.asyncio
async def test_run_fairness_probe_all_consistent(monkeypatch):
    async def fake_variants(base_utterance):
        return {
            "formal": f"{base_utterance}::formal",
            "informal": f"{base_utterance}::informal",
        }

    async def fake_run_mlim_pipeline(utterance, **kwargs):
        return SimpleNamespace(
            ifl=SimpleNamespace(intent_label="genuine_answer"),
            gstl=SimpleNamespace(dominant_goal="pass_interview"),
        )

    monkeypatch.setattr(fairness_module, "writing_style_variants", fake_variants)
    monkeypatch.setattr(fairness_module, "run_mlim_pipeline", fake_run_mlim_pipeline)

    result = await fairness_module.run_fairness_probe(["utterance one", "utterance two"])

    assert result.sample_size == 2
    assert result.label_stability_rate == 1.0
    assert result.flagged_utterances == []