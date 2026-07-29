import math
import pytest

from app.services.mlim.gstl import (
    GOAL_KEYS,
    TRANSITION_MATRIX,
    GOAL_DRIFT_KL_THRESHOLD,
    update_belief,
    detect_goal_drift,
    kl_divergence,
)


def test_transition_matrix_rows_sum_to_one():
    for g in GOAL_KEYS:
        row_sum = sum(TRANSITION_MATRIX[g].values())
        assert row_sum == pytest.approx(1.0, abs=1e-9)


def test_transition_matrix_covers_all_goals():
    assert set(TRANSITION_MATRIX.keys()) == set(GOAL_KEYS)
    for g in GOAL_KEYS:
        assert set(TRANSITION_MATRIX[g].keys()) == set(GOAL_KEYS)


def test_update_belief_uniform_prior_uniform_likelihood_matches_transition_marginals():
    prior = {g: 0.2 for g in GOAL_KEYS}
    likelihoods = {g: 0.5 for g in GOAL_KEYS}

    column_sums = {
        g: sum(TRANSITION_MATRIX[g_prime][g] for g_prime in GOAL_KEYS) for g in GOAL_KEYS
    }
    total = sum(column_sums.values())
    expected = {g: column_sums[g] / total for g in GOAL_KEYS}

    posterior = update_belief(prior, likelihoods)

    assert sum(posterior.values()) == pytest.approx(1.0, abs=1e-9)
    for g in GOAL_KEYS:
        assert posterior[g] == pytest.approx(expected[g], abs=1e-9)


def test_update_belief_hand_computed():
    prior = {
        "demonstrate_competence": 1.0,
        "seek_feedback": 0.0,
        "pass_screening": 0.0,
        "build_confidence": 0.0,
        "explore_role": 0.0,
    }
    likelihoods = {
        "demonstrate_competence": 0.9,
        "seek_feedback": 0.1,
        "pass_screening": 0.1,
        "build_confidence": 0.1,
        "explore_role": 0.1,
    }

    predicted = {
        g: TRANSITION_MATRIX["demonstrate_competence"][g] for g in GOAL_KEYS
    }
    expected_unnormalized = {g: likelihoods[g] * predicted[g] for g in GOAL_KEYS}
    expected_total = sum(expected_unnormalized.values())
    expected = {g: v / expected_total for g, v in expected_unnormalized.items()}

    posterior = update_belief(prior, likelihoods)

    assert sum(posterior.values()) == pytest.approx(1.0, abs=1e-9)
    for g in GOAL_KEYS:
        assert posterior[g] == pytest.approx(expected[g], abs=1e-9)
    assert posterior["demonstrate_competence"] > posterior["seek_feedback"]


def test_update_belief_zero_prior_falls_back_to_uniform_prior_before_transition():
    prior = {g: 0.0 for g in GOAL_KEYS}
    likelihoods = {g: 0.5 for g in GOAL_KEYS}

    column_sums = {
        g: sum(TRANSITION_MATRIX[g_prime][g] for g_prime in GOAL_KEYS) for g in GOAL_KEYS
    }
    total = sum(column_sums.values())
    expected = {g: column_sums[g] / total for g in GOAL_KEYS}

    posterior = update_belief(prior, likelihoods)

    assert sum(posterior.values()) == pytest.approx(1.0, abs=1e-9)
    for g in GOAL_KEYS:
        assert posterior[g] == pytest.approx(expected[g], abs=1e-9)


def test_kl_divergence_identical_distributions_is_zero():
    p = {g: 0.2 for g in GOAL_KEYS}
    assert kl_divergence(p, p) == pytest.approx(0.0, abs=1e-9)


def test_kl_divergence_hand_computed():
    p = {
        "demonstrate_competence": 0.7,
        "seek_feedback": 0.1,
        "pass_screening": 0.1,
        "build_confidence": 0.05,
        "explore_role": 0.05,
    }
    q = {
        "demonstrate_competence": 0.2,
        "seek_feedback": 0.2,
        "pass_screening": 0.2,
        "build_confidence": 0.2,
        "explore_role": 0.2,
    }

    expected = sum(p[g] * math.log(p[g] / q[g]) for g in GOAL_KEYS)
    assert kl_divergence(p, q) == pytest.approx(expected, abs=1e-9)


def test_detect_goal_drift_insufficient_history_returns_false():
    history = [{g: 0.2 for g in GOAL_KEYS} for _ in range(3)]
    assert detect_goal_drift(history, window=5) is False


def test_detect_goal_drift_no_drift_when_distribution_unchanged():
    stable = {
        "demonstrate_competence": 0.6,
        "seek_feedback": 0.1,
        "pass_screening": 0.1,
        "build_confidence": 0.1,
        "explore_role": 0.1,
    }
    history = [dict(stable) for _ in range(7)]
    assert detect_goal_drift(history, window=5) is False


def test_detect_goal_drift_detects_large_shift():
    past = {
        "demonstrate_competence": 0.9,
        "seek_feedback": 0.025,
        "pass_screening": 0.025,
        "build_confidence": 0.025,
        "explore_role": 0.025,
    }
    now = {
        "demonstrate_competence": 0.025,
        "seek_feedback": 0.025,
        "pass_screening": 0.025,
        "build_confidence": 0.025,
        "explore_role": 0.9,
    }
    history = [dict(past)] * 6 + [dict(now)]

    divergence = kl_divergence(now, past)
    assert divergence > GOAL_DRIFT_KL_THRESHOLD
    assert detect_goal_drift(history, window=5) is True