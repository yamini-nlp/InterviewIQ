from unittest.mock import AsyncMock

import pytest

from app.models.mlim import (
    ASLOutput,
    PELOutput,
    GSTLOutput,
    IFLOutput,
    MLIMAnalysis,
    EscalationRecord,
    EscalationUpdateRequest,
)
from app.services.mlim.escalation import (
    evaluate_escalation,
    STRESS_ESCALATION_THRESHOLD,
    ENTROPY_ESCALATION_THRESHOLD,
    MASKING_CONFIDENCE_ESCALATION_THRESHOLD,
)
from app.routers.mlim import update_escalation


def _make_asl(
    affective_masking_detected: bool = False,
    sentiment_confidence: float = 0.5,
) -> ASLOutput:
    return ASLOutput(
        sentiment="positive",
        sentiment_confidence=sentiment_confidence,
        valence=0.5,
        arousal=0.5,
        uncertainty_s=0.2,
        affective_masking_detected=affective_masking_detected,
        masking_reason=None,
        lexicon_sentiment="positive",
        lexicon_confidence=0.6,
        lexicon_llm_disagreement=False,
    )


def _make_pel() -> PELOutput:
    return PELOutput(
        primary_speech_act="representative",
        speech_act_confidence=0.7,
        secondary_speech_acts=[],
        concurrent_speech_acts=[],
        is_interrogative=False,
        sarcasm_detected=False,
        pragmatic_inversion=False,
        is_requesting_challenge=False,
        is_expressing_frustration=False,
        is_signaling_confusion=False,
        is_face_saving=False,
        is_seeking_validation=False,
        is_committing_to_retry=False,
        maxim_violations={},
        gricean_implicature="none",
        pragmatic_context_label="neutral",
    )


def _make_gstl(stress_indicators: float = 0.3) -> GSTLOutput:
    return GSTLOutput(
        dominant_goal="pass_interview",
        goal_belief_distribution={"pass_interview": 1.0},
        confidence_level=0.7,
        goal_drift_detected=False,
        session_trajectory="stable",
        engagement_level=0.6,
        stress_indicators=stress_indicators,
        readiness_estimate=0.5,
        recommended_system_action="encourage",
    )


def _make_ifl(entropy: float = 0.5, intent_label: str = "genuine_answer") -> IFLOutput:
    return IFLOutput(
        intent_label=intent_label,
        intent_confidence=0.6,
        intent_distribution={intent_label: 0.6},
        entropy=entropy,
        should_solicit_clarification=False,
        clarification_prompt=None,
        intent_aware_response_modifier="proceed_standard",
        failure_mode_detected="none",
        failure_mode_explanation=None,
    )


def _make_analysis(asl: ASLOutput, gstl: GSTLOutput, ifl: IFLOutput) -> MLIMAnalysis:
    return MLIMAnalysis(
        session_id="session-1",
        question_text="Tell me about yourself.",
        utterance="I think I did fine.",
        asl=asl,
        pel=_make_pel(),
        gstl=gstl,
        ifl=ifl,
    )


def test_high_entropy_and_high_stress_triggers_escalation():
    analysis = _make_analysis(
        asl=_make_asl(),
        gstl=_make_gstl(stress_indicators=STRESS_ESCALATION_THRESHOLD + 0.1),
        ifl=_make_ifl(entropy=ENTROPY_ESCALATION_THRESHOLD + 0.1),
    )

    record = evaluate_escalation(analysis)

    assert record is not None
    assert record.reason == "high_uncertainty"
    assert record.session_id == "session-1"
    assert record.status == "open"


def test_high_confidence_masking_triggers_escalation():
    analysis = _make_analysis(
        asl=_make_asl(
            affective_masking_detected=True,
            sentiment_confidence=MASKING_CONFIDENCE_ESCALATION_THRESHOLD + 0.1,
        ),
        gstl=_make_gstl(stress_indicators=0.1),
        ifl=_make_ifl(entropy=0.1),
    )

    record = evaluate_escalation(analysis)

    assert record is not None
    assert record.reason == "affective_masking_high_confidence"


def test_neither_condition_returns_none():
    analysis = _make_analysis(
        asl=_make_asl(affective_masking_detected=False, sentiment_confidence=0.5),
        gstl=_make_gstl(stress_indicators=0.1),
        ifl=_make_ifl(entropy=0.1),
    )

    record = evaluate_escalation(analysis)

    assert record is None


def test_low_confidence_masking_does_not_trigger():
    analysis = _make_analysis(
        asl=_make_asl(
            affective_masking_detected=True,
            sentiment_confidence=MASKING_CONFIDENCE_ESCALATION_THRESHOLD - 0.1,
        ),
        gstl=_make_gstl(stress_indicators=0.1),
        ifl=_make_ifl(entropy=0.1),
    )

    record = evaluate_escalation(analysis)

    assert record is None


@pytest.mark.asyncio
async def test_status_update_round_trip(monkeypatch):
    existing_record = EscalationRecord(
        session_id="session-1",
        user_id="user-1",
        analysis_id=None,
        reason="high_uncertainty",
        intent_label="expressing_confusion",
        entropy=2.0,
        stress_indicators=0.9,
        status="open",
    )
    stored = existing_record.model_dump()
    stored["created_at"] = stored["created_at"].isoformat()

    updated_stored = dict(stored)

    async def fake_find_one(query, projection=None):
        return dict(updated_stored)

    async def fake_update_one(query, update):
        updated_stored.update(update["$set"])
        return None

    fake_db = AsyncMock()
    fake_db.mlim_escalations.find_one = AsyncMock(side_effect=fake_find_one)
    fake_db.mlim_escalations.update_one = AsyncMock(side_effect=fake_update_one)

    monkeypatch.setattr("app.routers.mlim.get_db", lambda: fake_db)

    request = EscalationUpdateRequest(status="reviewed", reviewer_notes="Looked into it.")
    current_user = {"id": "user-1"}

    result = await update_escalation(
        escalation_id=existing_record.id,
        request=request,
        current_user=current_user,
    )

    assert result["status"] == "reviewed"
    assert result["reviewer_notes"] == "Looked into it."
    assert result["reviewed_at"] is not None