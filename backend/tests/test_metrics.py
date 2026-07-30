import re
import time
import uuid

from app.core import metrics
from app.core.metrics import Counter, Histogram, Timer


def test_counter_increments_on_repeated_calls():
    counter = Counter("test_counter_repeated", "help text")

    counter.inc(route="/a", method="GET")
    counter.inc(route="/a", method="GET")
    counter.inc(route="/a", method="GET")

    snapshot = counter.snapshot()
    key = (("method", "GET"), ("route", "/a"))
    assert snapshot[key] == 3.0


def test_counter_tracks_distinct_label_combinations_independently():
    counter = Counter("test_counter_labels", "help text")

    counter.inc(route="/a", status="200")
    counter.inc(route="/a", status="200")
    counter.inc(route="/a", status="500")
    counter.inc(route="/b", status="200")

    snapshot = counter.snapshot()
    assert snapshot[(("route", "/a"), ("status", "200"))] == 2.0
    assert snapshot[(("route", "/a"), ("status", "500"))] == 1.0
    assert snapshot[(("route", "/b"), ("status", "200"))] == 1.0


def test_counter_inc_with_custom_amount():
    counter = Counter("test_counter_amount", "help text")
    counter.inc(amount=5.0, op="x")
    counter.inc(amount=2.5, op="x")
    assert counter.snapshot()[(("op", "x"),)] == 7.5


def test_counter_render_contains_help_type_and_values():
    counter = Counter("test_counter_render", "a helpful description")
    counter.inc(route="/health")
    output = counter.render()

    assert "# HELP test_counter_render a helpful description" in output
    assert "# TYPE test_counter_render counter" in output
    assert 'test_counter_render{route="/health"} 1.0' in output


def test_histogram_observes_and_buckets_correctly():
    histogram = Histogram("test_histogram_buckets", "help text", buckets=(0.1, 0.5, 1.0))

    histogram.observe(0.05, stage="asl")
    histogram.observe(0.3, stage="asl")
    histogram.observe(0.8, stage="asl")
    histogram.observe(5.0, stage="asl")

    bucket_counts, sums, counts = histogram.snapshot()
    key = (("stage", "asl"),)

    assert bucket_counts[key][0.1] == 1
    assert bucket_counts[key][0.5] == 2
    assert bucket_counts[key][1.0] == 3
    assert counts[key] == 4
    assert sums[key] == 0.05 + 0.3 + 0.8 + 5.0


def test_histogram_tracks_labels_independently():
    histogram = Histogram("test_histogram_labels", "help text", buckets=(1.0,))

    histogram.observe(0.5, stage="pel")
    histogram.observe(2.0, stage="gstl")

    bucket_counts, sums, counts = histogram.snapshot()
    assert counts[(("stage", "pel"),)] == 1
    assert counts[(("stage", "gstl"),)] == 1
    assert bucket_counts[(("stage", "pel"),)][1.0] == 1
    assert bucket_counts[(("stage", "gstl"),)][1.0] == 0


def test_histogram_render_includes_bucket_sum_count_and_inf():
    histogram = Histogram("test_histogram_render", "help text", buckets=(0.5, 1.0))
    histogram.observe(0.75, stage="ifl")
    output = histogram.render()

    assert "# HELP test_histogram_render help text" in output
    assert "# TYPE test_histogram_render histogram" in output
    assert 'test_histogram_render_bucket{le="0.5",stage="ifl"} 0' in output
    assert 'test_histogram_render_bucket{le="1.0",stage="ifl"} 1' in output
    assert 'test_histogram_render_bucket{le="+Inf",stage="ifl"} 1' in output
    assert 'test_histogram_render_sum{stage="ifl"} 0.75' in output
    assert 'test_histogram_render_count{stage="ifl"} 1' in output


def test_timer_context_manager_records_observation():
    histogram = Histogram("test_histogram_timer", "help text")

    with Timer(histogram, stage="test_stage"):
        time.sleep(0.01)

    bucket_counts, sums, counts = histogram.snapshot()
    key = (("stage", "test_stage"),)
    assert counts[key] == 1
    assert sums[key] >= 0.01


def test_record_request_increments_counter_and_histogram():
    route = f"/test/route/{uuid.uuid4()}"

    metrics.record_request("GET", route, 200, 0.123)
    metrics.record_request("GET", route, 200, 0.456)

    request_snapshot = metrics.http_requests_total.snapshot()
    key = (("method", "GET"), ("route", route), ("status", "200"))
    assert request_snapshot[key] == 2.0

    _, sums, counts = metrics.http_request_duration_seconds.snapshot()
    latency_key = (("method", "GET"), ("route", route))
    assert counts[latency_key] == 2
    assert abs(sums[latency_key] - (0.123 + 0.456)) < 1e-9


def test_record_mlim_stage_increments_histogram_for_stage():
    stage = f"asl-{uuid.uuid4()}"

    metrics.record_mlim_stage(stage, 0.2)
    metrics.record_mlim_stage(stage, 0.4)

    _, sums, counts = metrics.mlim_stage_duration_seconds.snapshot()
    key = (("stage", stage),)
    assert counts[key] == 2
    assert abs(sums[key] - 0.6) < 1e-9


def test_time_mlim_stage_helper_records_wall_clock_latency():
    stage = f"gstl-{uuid.uuid4()}"

    with metrics.time_mlim_stage(stage):
        time.sleep(0.01)

    _, sums, counts = metrics.mlim_stage_duration_seconds.snapshot()
    key = (("stage", stage),)
    assert counts[key] == 1
    assert sums[key] >= 0.01


def test_record_groq_error_increments_counter():
    operation = f"call_groq-{uuid.uuid4()}"

    metrics.record_groq_error(operation=operation)
    metrics.record_groq_error(operation=operation)
    metrics.record_groq_error(operation=operation)

    snapshot = metrics.groq_api_errors_total.snapshot()
    assert snapshot[(("operation", operation),)] == 3.0


def test_record_mongo_error_increments_counter():
    operation = f"sessions_find_one-{uuid.uuid4()}"

    metrics.record_mongo_error(operation=operation)
    metrics.record_mongo_error(operation=operation)

    snapshot = metrics.mongo_query_errors_total.snapshot()
    assert snapshot[(("operation", operation),)] == 2.0


def test_render_prometheus_text_includes_all_registered_metrics():
    route = f"/prom/render/{uuid.uuid4()}"
    stage = f"ifl-{uuid.uuid4()}"
    groq_op = f"call_groq_json-{uuid.uuid4()}"
    mongo_op = f"reports_save-{uuid.uuid4()}"

    metrics.record_request("POST", route, 201, 0.05)
    metrics.record_mlim_stage(stage, 0.02)
    metrics.record_groq_error(operation=groq_op)
    metrics.record_mongo_error(operation=mongo_op)

    output = metrics.render_prometheus_text()

    assert "# TYPE http_requests_total counter" in output
    assert "# TYPE http_request_duration_seconds histogram" in output
    assert "# TYPE mlim_stage_duration_seconds histogram" in output
    assert "# TYPE groq_api_errors_total counter" in output
    assert "# TYPE mongo_query_errors_total counter" in output

    assert route in output
    assert stage in output
    assert groq_op in output
    assert mongo_op in output


def test_render_prometheus_text_is_valid_exposition_format():
    metrics.record_request("GET", f"/format-check/{uuid.uuid4()}", 200, 0.01)
    output = metrics.render_prometheus_text()

    for line in output.splitlines():
        if not line or line.startswith("#"):
            continue
        assert re.match(r"^[a-zA-Z_:][a-zA-Z0-9_:]*(\{.*\})? [0-9eE+\-.]+$", line), line