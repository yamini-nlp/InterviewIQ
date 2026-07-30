import threading
import time
from typing import Dict, List, Tuple

_LABELS_KEY = Tuple[Tuple[str, str], ...]

DEFAULT_LATENCY_BUCKETS: Tuple[float, ...] = (
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0
)


def _labels_key(labels: Dict[str, str]) -> _LABELS_KEY:
    return tuple(sorted(labels.items()))


def _format_labels(labels: _LABELS_KEY) -> str:
    if not labels:
        return ""
    parts = [f'{k}="{v}"' for k, v in labels]
    return "{" + ",".join(parts) + "}"


class Counter:
    def __init__(self, name: str, help_text: str = "") -> None:
        self.name = name
        self.help_text = help_text
        self._lock = threading.Lock()
        self._values: Dict[_LABELS_KEY, float] = {}

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        key = _labels_key(labels)
        with self._lock:
            self._values[key] = self._values.get(key, 0.0) + amount

    def snapshot(self) -> Dict[_LABELS_KEY, float]:
        with self._lock:
            return dict(self._values)

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help_text}", f"# TYPE {self.name} counter"]
        for key, value in sorted(self.snapshot().items()):
            lines.append(f"{self.name}{_format_labels(key)} {value}")
        return "\n".join(lines)


class Gauge:
    def __init__(self, name: str, help_text: str = "") -> None:
        self.name = name
        self.help_text = help_text
        self._lock = threading.Lock()
        self._values: Dict[_LABELS_KEY, float] = {}

    def set(self, value: float, **labels: str) -> None:
        key = _labels_key(labels)
        with self._lock:
            self._values[key] = value

    def snapshot(self) -> Dict[_LABELS_KEY, float]:
        with self._lock:
            return dict(self._values)

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help_text}", f"# TYPE {self.name} gauge"]
        for key, value in sorted(self.snapshot().items()):
            lines.append(f"{self.name}{_format_labels(key)} {value}")
        return "\n".join(lines)


class Histogram:
    def __init__(
        self,
        name: str,
        help_text: str = "",
        buckets: Tuple[float, ...] = DEFAULT_LATENCY_BUCKETS,
    ) -> None:
        self.name = name
        self.help_text = help_text
        self.buckets = tuple(sorted(buckets))
        self._lock = threading.Lock()
        self._bucket_counts: Dict[_LABELS_KEY, Dict[float, int]] = {}
        self._sums: Dict[_LABELS_KEY, float] = {}
        self._counts: Dict[_LABELS_KEY, int] = {}

    def observe(self, value: float, **labels: str) -> None:
        key = _labels_key(labels)
        with self._lock:
            counts = self._bucket_counts.setdefault(key, {b: 0 for b in self.buckets})
            for bucket in self.buckets:
                if value <= bucket:
                    counts[bucket] += 1
            self._sums[key] = self._sums.get(key, 0.0) + value
            self._counts[key] = self._counts.get(key, 0) + 1

    def snapshot(self):
        with self._lock:
            return (
                {k: dict(v) for k, v in self._bucket_counts.items()},
                dict(self._sums),
                dict(self._counts),
            )

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help_text}", f"# TYPE {self.name} histogram"]
        bucket_counts, sums, counts = self.snapshot()
        for key in sorted(counts.keys()):
            base_labels = dict(key)
            cumulative = 0
            for bucket in self.buckets:
                cumulative = bucket_counts.get(key, {}).get(bucket, 0)
                le_labels = dict(base_labels)
                le_labels["le"] = str(bucket)
                lines.append(
                    f"{self.name}_bucket{_format_labels(_labels_key(le_labels))} {cumulative}"
                )
            inf_labels = dict(base_labels)
            inf_labels["le"] = "+Inf"
            lines.append(
                f"{self.name}_bucket{_format_labels(_labels_key(inf_labels))} {counts[key]}"
            )
            lines.append(f"{self.name}_sum{_format_labels(key)} {sums.get(key, 0.0)}")
            lines.append(f"{self.name}_count{_format_labels(key)} {counts[key]}")
        return "\n".join(lines)


class Timer:
    def __init__(self, histogram: Histogram, **labels: str) -> None:
        self._histogram = histogram
        self._labels = labels
        self._start = 0.0

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        elapsed = time.perf_counter() - self._start
        self._histogram.observe(elapsed, **self._labels)


http_requests_total = Counter(
    "http_requests_total",
    "Total number of HTTP requests processed, labeled by method, route and status code.",
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds, labeled by method and route.",
)

mlim_stage_duration_seconds = Histogram(
    "mlim_stage_duration_seconds",
    "MLIM pipeline stage latency in seconds, labeled by stage (asl, pel, gstl, ifl).",
)

groq_api_errors_total = Counter(
    "groq_api_errors_total",
    "Total number of Groq API call failures, labeled by operation.",
)

mongo_query_errors_total = Counter(
    "mongo_query_errors_total",
    "Total number of MongoDB query failures, labeled by operation.",
)

_ALL_METRICS: List = [
    http_requests_total,
    http_request_duration_seconds,
    mlim_stage_duration_seconds,
    groq_api_errors_total,
    mongo_query_errors_total,
]


def record_request(method: str, route: str, status_code: int, duration_seconds: float) -> None:
    http_requests_total.inc(method=method, route=route, status=str(status_code))
    http_request_duration_seconds.observe(duration_seconds, method=method, route=route)


def record_mlim_stage(stage: str, duration_seconds: float) -> None:
    mlim_stage_duration_seconds.observe(duration_seconds, stage=stage)


def time_mlim_stage(stage: str) -> Timer:
    return Timer(mlim_stage_duration_seconds, stage=stage)


def record_groq_error(operation: str = "unknown") -> None:
    groq_api_errors_total.inc(operation=operation)


def record_mongo_error(operation: str = "unknown") -> None:
    mongo_query_errors_total.inc(operation=operation)


def render_prometheus_text() -> str:
    sections = [metric.render() for metric in _ALL_METRICS]
    return "\n".join(sections) + "\n"