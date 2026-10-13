"""Unit tests for map persistence, import/export validation, and sample maps.

(Requirements 27, 28)
"""

from pathlib import Path

import pytest
from app.models.coordinates import GridPoint
from app.models.map_data import Checkpoint, MapData, Zone, ZoneType
from app.models.robot_state import RobotConfig
from app.planner.patrol_planner import MissionPlanner
from app.services.sample_maps import get_default_sample_map
from app.services.storage import StorageService
from pydantic import ValidationError


def test_map_save_load_round_trip(tmp_path: Path):
    """27. Map save and load preserves all dimensions, walls, zones, and checkpoints."""
    storage = StorageService(storage_dir=tmp_path)
    original_map = MapData(
        id="save_test_map",
        name="Save Test",
        width=12,
        height=14,
        resolution=0.25,
        walls=[GridPoint(x=3, y=4), GridPoint(x=5, y=6)],
        zones=[
            Zone(
                id="z1",
                name="Zone 1",
                type=ZoneType.STANDARD_PATROL,
                cells=[GridPoint(x=2, y=2)],
            )
        ],
        robot_start=GridPoint(x=1, y=1),
        charging_dock=GridPoint(x=0, y=0),
        checkpoints=[
            Checkpoint(id="cp1", name="Checkpoint 1", position=GridPoint(x=4, y=4), order=1)
        ],
    )

    saved_file = storage.save_map(original_map)
    assert saved_file.exists()

    loaded_map = storage.load_map("save_test_map")
    assert loaded_map is not None
    assert loaded_map.id == original_map.id
    assert loaded_map.width == original_map.width
    assert loaded_map.height == original_map.height
    assert loaded_map.resolution == original_map.resolution
    assert len(loaded_map.walls) == len(original_map.walls)
    assert len(loaded_map.zones) == len(original_map.zones)
    assert len(loaded_map.checkpoints) == len(original_map.checkpoints)


def test_import_export_validation():
    """28. Invalid map schemas are rejected during import."""
    invalid_json_payload = {
        "id": "corrupted",
        "name": "Corrupted Map",
        "width": 1,  # Invalid: width must be >= 3
        "height": 2,
        "robot_start": {"x": 0, "y": 0},
    }

    with pytest.raises(ValidationError):
        MapData.model_validate(invalid_json_payload)


def test_default_sample_map_is_valid_and_plannable():
    """Verify that MDP Facility Alpha sample map generates a feasible plan."""
    sample_map = get_default_sample_map()
    assert sample_map.width == 24
    assert sample_map.height == 18

    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.05)
    planner = MissionPlanner(sample_map, robot_config=cfg)
    plan = planner.plan_mission()

    assert plan.is_feasible is True
    assert len(plan.waypoints) > 10
    assert plan.dock_reachable is True
