from typing import Optional

from app.config import settings
from app.models.mlim import MLIMAnalysis, EscalationRecord

STRESS_ESCALATION_THRESHOLD = 0.75
ENTROPY_ESCALATION_THRESHOLD = settings.mlim_clarification_entropy_threshold
MASKING_CONFIDENCE_ESCALATION_THRESHOLD = 0.8


def evaluate_escalation(analysis: MLIMAnalysis) -> Optional[EscalationRecord]:
    entropy = analysis.ifl.entropy
    stress_indicators = analysis.gstl.stress_indicators
    intent_label = analysis.ifl.intent_label

    high_uncertainty_and_stress = (
        entropy > ENTROPY_ESCALATION_THRESHOLD
        and stress_indicators > STRESS_ESCALATION_THRESHOLD
    )
    high_confidence_masking = (
        analysis.asl.affective_masking_detected
        and analysis.asl.sentiment_confidence > MASKING_CONFIDENCE_ESCALATION_THRESHOLD
    )

    if high_uncertainty_and_stress:
        reason = "high_uncertainty"
    elif high_confidence_masking:
        reason = "affective_masking_high_confidence"
    else:
        return None

    return EscalationRecord(
        session_id=analysis.session_id,
        user_id="",
        analysis_id=None,
        reason=reason,
        intent_label=intent_label,
        entropy=entropy,
        stress_indicators=stress_indicators,
        status="open",
    )