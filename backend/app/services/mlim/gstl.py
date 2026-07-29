import math
import logging
from typing import Dict, List, Optional, Tuple, Any

from app.config import settings
from app.services.groq_service import call_groq_json
from app.models.mlim import ASLOutput, PELOutput, GSTLOutput, GoalState, InteractionEntry

logger = logging.getLogger(__name__)

FAST_MODEL = "llama-3.1-8b-instant"
REASONING_MODEL = "llama-3.3-70b-versatile"

GOAL_KEYS = (
    "demonstrate_competence",
    "seek_feedback",
    "pass_screening",
    "build_confidence",
    "explore_role",
)

TRANSITION_MATRIX: Dict[str, Dict[str, float]] = {
    "demonstrate_competence": {
        "demonstrate_competence": 0.78,
        "seek_feedback": 0.06,
        "pass_screening": 0.08,
        "build_confidence": 0.04,
        "explore_role": 0.04,
    },
    "seek_feedback": {
        "demonstrate_competence": 0.10,
        "seek_feedback": 0.74,
        "pass_screening": 0.05,
        "build_confidence": 0.08,
        "explore_role": 0.03,
    },
    "pass_screening": {
        "demonstrate_competence": 0.10,
        "seek_feedback": 0.04,
        "pass_screening": 0.78,
        "build_confidence": 0.04,
        "explore_role": 0.04,
    },
    "build_confidence": {
        "demonstrate_competence": 0.06,
        "seek_feedback": 0.10,
        "pass_screening": 0.04,
        "build_confidence": 0.76,
        "explore_role": 0.04,
    },
    "explore_role": {
        "demonstrate_competence": 0.06,
        "seek_feedback": 0.05,
        "pass_screening": 0.06,
        "build_confidence": 0.05,
        "explore_role": 0.78,
    },
}

GOAL_DRIFT_KL_THRESHOLD = 0.5


def _uniform_prior() -> Dict[str, float]:
    return {g: 1.0 / len(GOAL_KEYS) for g in GOAL_KEYS}


def _normalize(dist: Dict[str, float]) -> Dict[str, float]:
    total = sum(max(v, 0.0) for v in dist.values())
    if total <= 0:
        return _uniform_prior()
    return {k: max(v, 0.0) / total for k, v in dist.items()}


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def update_belief(prior: Dict[str, float], likelihoods: Dict[str, float]) -> Dict[str, float]:
    prior = {g: max(_safe_float(prior.get(g, 0.0)), 0.0) for g in GOAL_KEYS}
    if sum(prior.values()) <= 0:
        prior = _uniform_prior()

    unnormalized: Dict[str, float] = {}
    for g in GOAL_KEYS:
        predicted = sum(
            TRANSITION_MATRIX[g_prime][g] * prior[g_prime] for g_prime in GOAL_KEYS
        )
        likelihood = max(_safe_float(likelihoods.get(g, 0.0)), 1e-6)
        unnormalized[g] = likelihood * predicted

    return _normalize(unnormalized)


def kl_divergence(p: Dict[str, float], q: Dict[str, float]) -> float:
    eps = 1e-10
    total = 0.0
    for k in GOAL_KEYS:
        pk = max(_safe_float(p.get(k, 0.0)), 0.0)
        if pk <= 0.0:
            continue
        qk = max(_safe_float(q.get(k, 0.0)), eps)
        total += pk * math.log(pk / qk)
    return total


def _kl_at_window(belief_history: List[Dict[str, float]], window: int) -> Optional[float]:
    if window <= 0 or len(belief_history) <= window:
        return None
    current = belief_history[-1]
    past = belief_history[-1 - window]
    return kl_divergence(current, past)


def detect_goal_drift(belief_history: List[Dict[str, float]], window: int = 5) -> bool:
    divergence = _kl_at_window(belief_history, window)
    if divergence is None:
        return False
    return divergence > GOAL_DRIFT_KL_THRESHOLD


async def _get_observation_likelihoods(
    utterance: str,
    job_role: str,
    question_text: str,
    asl: ASLOutput,
    pel: PELOutput,
) -> Dict[str, float]:
    prompt = f"""You are the observation model of an HMM goal-state tracker (P(x_t | G_t=g, C_t)) in an AI interview coaching system.

Job Role: {job_role}
Current Question: "{question_text}"
Current Utterance: "{utterance}"

Affective signals: valence={asl.valence:.2f}, arousal={asl.arousal:.2f}, sentiment={asl.sentiment}
Pragmatic signals: speech_act={pel.primary_speech_act}, frustration={pel.is_expressing_frustration}, confusion={pel.is_signaling_confusion}, is_committing_to_retry={pel.is_committing_to_retry}

For each candidate goal below, estimate an independent likelihood (0.0-1.0) that the observed
utterance and signals would occur if the candidate's true underlying goal were that one. These are
raw likelihoods, not a probability distribution, so they are NOT required to sum to 1.0.

Respond ONLY in this exact JSON format:
{{
  "likelihoods": {{
    "demonstrate_competence": <float 0.0-1.0>,
    "seek_feedback": <float 0.0-1.0>,
    "pass_screening": <float 0.0-1.0>,
    "build_confidence": <float 0.0-1.0>,
    "explore_role": <float 0.0-1.0>
  }}
}}"""

    data = await call_groq_json(prompt, model=FAST_MODEL)
    raw = data.get("likelihoods", {})
    return {g: max(0.0, min(1.0, _safe_float(raw.get(g, 0.1), 0.1))) for g in GOAL_KEYS}


async def _get_derived_signals(
    utterance: str,
    job_role: str,
    question_text: str,
    posterior: Dict[str, float],
    dominant_goal: str,
    goal_drift_detected: bool,
    interaction_history: List[InteractionEntry],
    prior_goal_state: Optional[GoalState],
) -> dict:
    history_str = ""
    horizon = settings.mlim_context_horizon_k
    for entry in interaction_history[-horizon:]:
        history_str += f"Q: {entry.question}\nA: {entry.answer}\nScore: {entry.score}/10\n\n"

    prior_str = ""
    if prior_goal_state:
        prior_str = f"""Prior session state:
- Previous session trajectory: {prior_goal_state.session_trajectory}
- Previous hiring readiness signal: {prior_goal_state.hiring_readiness_signal or "unknown"}
- Previous engagement: {prior_goal_state.engagement_level:.2f}
- Previous stress: {prior_goal_state.stress_indicators:.2f}"""

    belief_str = ", ".join(f"{g}={posterior[g]:.2f}" for g in GOAL_KEYS)

    prompt = f"""You are reasoning over an already-computed, verified HMM belief-state distribution in an AI interview coaching system. Do not re-derive the distribution; use it as ground truth.

Job Role: {job_role}
Current Question: "{question_text}"
Current Utterance: "{utterance}"

Verified goal belief distribution: {belief_str}
Verified dominant goal: {dominant_goal}
Verified temporal goal drift detected: {goal_drift_detected}

Interaction History (last {horizon} turns):
{history_str if history_str else "No prior interactions."}

{prior_str}

Respond ONLY in this exact JSON format:
{{
  "session_trajectory": "improving|declining|stable|volatile|insufficient_data",
  "engagement_level": <float 0.0-1.0>,
  "stress_indicators": <float 0.0-1.0>,
  "readiness_estimate": <float 0.0-1.0>,
  "recommended_system_action": "encourage|challenge|clarify|simplify|validate|escalate_difficulty",
  "hiring_readiness_signal": "strong_yes|lean_yes|neutral|lean_no|strong_no"
}}"""

    return await call_groq_json(prompt, model=FAST_MODEL)


async def compute_gstl(
    utterance: str,
    job_role: str,
    question_text: str,
    prior_goal_state: Optional[GoalState],
    interaction_history: List[InteractionEntry],
    asl: ASLOutput,
    pel: PELOutput,
    belief_history: Optional[List[Dict[str, float]]] = None,
) -> GSTLOutput:
    belief_history = list(belief_history) if belief_history else []

    if prior_goal_state and prior_goal_state.goal_belief_distribution:
        prior = _normalize(
            {g: prior_goal_state.goal_belief_distribution.get(g, 0.0) for g in GOAL_KEYS}
        )
    elif belief_history:
        prior = _normalize(dict(belief_history[-1]))
    else:
        prior = _uniform_prior()

    try:
        likelihoods = await _get_observation_likelihoods(
            utterance, job_role, question_text, asl, pel
        )
    except Exception as e:
        logger.warning(f"GSTL observation model LLM pass failed, using neutral likelihoods: {e}")
        likelihoods = {g: 0.2 for g in GOAL_KEYS}

    posterior = update_belief(prior, likelihoods)
    dominant_goal = max(posterior, key=posterior.get)
    confidence_level = posterior[dominant_goal]

    augmented_history = belief_history + [posterior]
    goal_drift_detected = detect_goal_drift(augmented_history, window=5)
    kl_divergence_value = _kl_at_window(augmented_history, window=5) or 0.0

    belief_update_trace: Dict[str, Any] = {
        "prior": prior,
        "likelihoods": likelihoods,
        "posterior": posterior,
    }

    try:
        derived = await _get_derived_signals(
            utterance=utterance,
            job_role=job_role,
            question_text=question_text,
            posterior=posterior,
            dominant_goal=dominant_goal,
            goal_drift_detected=goal_drift_detected,
            interaction_history=interaction_history,
            prior_goal_state=prior_goal_state,
        )
    except Exception as e:
        logger.warning(f"GSTL derived-signal LLM pass failed, using defaults: {e}")
        derived = {}

    session_trajectory = derived.get("session_trajectory", "insufficient_data")
    engagement_level = max(0.0, min(1.0, _safe_float(derived.get("engagement_level", 0.5), 0.5)))
    stress_indicators = max(0.0, min(1.0, _safe_float(derived.get("stress_indicators", 0.3), 0.3)))
    readiness_estimate = max(0.0, min(1.0, _safe_float(derived.get("readiness_estimate", 0.5), 0.5)))
    recommended_system_action = derived.get("recommended_system_action", "encourage")

    hiring_signal = derived.get("hiring_readiness_signal", "neutral")
    valid_signals = {"strong_yes", "lean_yes", "neutral", "lean_no", "strong_no"}
    if hiring_signal not in valid_signals:
        hiring_signal = "neutral"

    return GSTLOutput(
        dominant_goal=dominant_goal,
        goal_belief_distribution=posterior,
        confidence_level=confidence_level,
        goal_drift_detected=goal_drift_detected,
        session_trajectory=session_trajectory,
        engagement_level=engagement_level,
        stress_indicators=stress_indicators,
        readiness_estimate=readiness_estimate,
        recommended_system_action=recommended_system_action,
        hiring_readiness_signal=hiring_signal,
        belief_update_trace=belief_update_trace,
        goal_drift_kl_divergence=kl_divergence_value,
    )