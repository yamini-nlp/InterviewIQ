from app.services.mlim.explain import feature_attribution


def test_feature_attribution_known_top_contributor():
    feature_vector = {
        "is_signaling_confusion": 1.0,
        "is_face_saving": 0.2,
        "sarcasm_detected": 0.0,
        "engagement_level": 0.5,
    }
    distribution = {
        "expressing_confusion": 0.7,
        "face_saving_assertion": 0.2,
        "genuine_answer": 0.1,
    }
    prior_weights = {
        "is_signaling_confusion": {"expressing_confusion": 2.5},
        "is_face_saving": {"face_saving_assertion": 2.5},
        "sarcasm_detected": {"sarcastic_response": 2.5},
    }

    attributions = feature_attribution(
        feature_vector, distribution, "expressing_confusion", prior_weights
    )

    assert len(attributions) == 1
    top = attributions[0]
    assert top.feature == "is_signaling_confusion"
    assert top.value == 1.0
    assert top.weight == 2.5
    assert top.contribution == 2.5


def test_feature_attribution_sorted_by_absolute_contribution():
    feature_vector = {
        "feature_a": 0.4,
        "feature_b": 1.0,
        "feature_c": -2.0,
    }
    distribution = {"label_x": 0.6}
    prior_weights = {
        "feature_a": {"label_x": 1.0},
        "feature_b": {"label_x": 0.5},
        "feature_c": {"label_x": 1.0},
    }

    attributions = feature_attribution(feature_vector, distribution, "label_x", prior_weights)

    assert [a.feature for a in attributions] == ["feature_c", "feature_b", "feature_a"]
    assert attributions[0].contribution == -2.0


def test_feature_attribution_ignores_features_without_label_weight():
    feature_vector = {"feature_a": 1.0, "feature_b": 1.0}
    distribution = {"label_x": 0.6}
    prior_weights = {
        "feature_a": {"label_y": 3.0},
        "feature_b": {"label_x": 1.0},
    }

    attributions = feature_attribution(feature_vector, distribution, "label_x", prior_weights)

    assert len(attributions) == 1
    assert attributions[0].feature == "feature_b"


def test_feature_attribution_caps_at_six():
    feature_vector = {f"feature_{i}": float(i + 1) for i in range(10)}
    distribution = {"label_x": 1.0}
    prior_weights = {f"feature_{i}": {"label_x": 1.0} for i in range(10)}

    attributions = feature_attribution(feature_vector, distribution, "label_x", prior_weights)

    assert len(attributions) == 6
    assert attributions[0].feature == "feature_9"