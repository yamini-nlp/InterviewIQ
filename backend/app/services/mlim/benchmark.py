import math
from collections import defaultdict
from typing import Dict, List, Tuple

from app.models.mlim import MLIMAnalysis, MIComparisonResult

SENTIMENT_ONLY_ACTION_MAP: Dict[str, str] = {
    "positive": "affirm",
    "negative": "comfort",
    "neutral": "neutral_ack",
}

DEFAULT_SENTIMENT_ONLY_ACTION = "neutral_ack"


def reduce_to_sentiment_only(analysis: MLIMAnalysis) -> str:
    return SENTIMENT_ONLY_ACTION_MAP.get(
        analysis.asl.sentiment, DEFAULT_SENTIMENT_ONLY_ACTION
    )


def _full_signal_bucket(analysis: MLIMAnalysis) -> str:
    return f"{analysis.gstl.dominant_goal}::{analysis.pel.primary_speech_act}"


def entropy(dist: Dict[str, float]) -> float:
    total = sum(max(v, 0.0) for v in dist.values())
    if total <= 0:
        return 0.0
    return -sum(
        (v / total) * math.log(v / total)
        for v in dist.values()
        if v > 0.0
    )


def mutual_information(joint_counts: Dict[Tuple[str, str], int]) -> float:
    total = sum(joint_counts.values())
    if total <= 0:
        return 0.0

    x_marginal: Dict[str, float] = defaultdict(float)
    y_marginal: Dict[str, float] = defaultdict(float)
    joint_probs: Dict[Tuple[str, str], float] = {}

    for (x, y), count in joint_counts.items():
        if count <= 0:
            continue
        p_xy = count / total
        joint_probs[(x, y)] = p_xy
        x_marginal[x] += p_xy
        y_marginal[y] += p_xy

    mi = 0.0
    for (x, y), p_xy in joint_probs.items():
        denom = x_marginal[x] * y_marginal[y]
        if p_xy <= 0.0 or denom <= 0.0:
            continue
        mi += p_xy * math.log(p_xy / denom)

    return mi


def compute_mi_comparison(analyses: List[MLIMAnalysis]) -> MIComparisonResult:
    sentiment_joint_counts: Dict[Tuple[str, str], int] = defaultdict(int)
    full_joint_counts: Dict[Tuple[str, str], int] = defaultdict(int)
    sentiment_action_counts: Dict[str, int] = defaultdict(int)
    full_signal_bucket_counts: Dict[str, int] = defaultdict(int)

    for analysis in analyses:
        intent_label = analysis.ifl.intent_label
        sentiment_only_action = reduce_to_sentiment_only(analysis)
        full_signal_bucket = _full_signal_bucket(analysis)

        sentiment_joint_counts[(intent_label, sentiment_only_action)] += 1
        full_joint_counts[(intent_label, full_signal_bucket)] += 1
        sentiment_action_counts[sentiment_only_action] += 1
        full_signal_bucket_counts[full_signal_bucket] += 1

    sample_size = len(analyses)

    mi_sentiment_only = mutual_information(sentiment_joint_counts)
    mi_full_signal = mutual_information(full_joint_counts)

    sentiment_only_action_distribution = (
        {k: v / sample_size for k, v in sentiment_action_counts.items()}
        if sample_size > 0
        else {}
    )
    full_signal_action_distribution = (
        {k: v / sample_size for k, v in full_signal_bucket_counts.items()}
        if sample_size > 0
        else {}
    )

    return MIComparisonResult(
        mi_sentiment_only=mi_sentiment_only,
        mi_full_signal=mi_full_signal,
        mlim_strictly_more_informative=mi_full_signal > mi_sentiment_only,
        sample_size=sample_size,
        sentiment_only_action_distribution=sentiment_only_action_distribution,
        full_signal_action_distribution=full_signal_action_distribution,
    )