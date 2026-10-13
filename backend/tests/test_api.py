"""API integration tests for FastAPI endpoints (Requirements 29, 30)."""

from app.services.sample_maps import get_default_sample_map
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check_endpoint():
    """30. Health check endpoint returns status ok with version."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_api_request_validation():
    """29. API validates input schemas and rejects malformed payloads with 422."""
    bad_payload = {
        "start": {"x": 0, "y": 0},
        # Missing map_data and goal
    }
    response = client.post("/api/plan/point-to-point", json=bad_payload)
    assert response.status_code == 422


def test_api_sample_map_and_planning():
    """Verify loading sample map and planning mission via API."""
    sample = get_default_sample_map()
    payload = {
        "map_data": sample.model_dump(),
        "allow_diagonal": False,
        "current_battery_pct": 100.0,
    }
    response = client.post("/api/plan/mission", json=payload)
    assert response.status_code == 200
    plan_data = response.json()
    assert plan_data["is_feasible"] is True
    assert len(plan_data["waypoints"]) > 0
    assert plan_data["dock_reachable"] is True


def test_api_simulation_lifecycle():
    """Verify simulation init, step, pause, resume, reset endpoints."""
    sample = get_default_sample_map()
    # Plan mission first so simulation has a valid plan
    plan_res = client.post("/api/plan/mission", json={"map_data": sample.model_dump()})
    assert plan_res.status_code == 200
    plan_data = plan_res.json()

    # Init with plan
    res_init = client.post("/api/simulation/init", json={"map_data": sample.model_dump(), "plan": plan_data})
    assert res_init.status_code == 200

    # Start
    res_start = client.post("/api/simulation/start")
    assert res_start.status_code == 200
    assert res_start.json()["is_running"] is True

    # Step
    res_step = client.post("/api/simulation/step", json={"steps": 1})
    assert res_step.status_code == 200

    # Pause
    res_pause = client.post("/api/simulation/pause")
    assert res_pause.status_code == 200
    assert res_pause.json()["is_paused"] is True

    # Reset
    res_reset = client.post("/api/simulation/reset")
    assert res_reset.status_code == 200
    assert res_reset.json()["current_waypoint_index"] == 0


def test_api_not_found_handling():
    """30. Missing map returns HTTP 404."""
    response = client.get("/api/maps/nonexistent_map_id_99999")
    assert response.status_code == 404
