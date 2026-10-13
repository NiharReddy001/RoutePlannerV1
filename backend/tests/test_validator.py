"""Unit tests for independent route validation routine (Requirement 11)."""

from app.models.coordinates import GridPoint
from app.models.map_data import MapData, Zone, ZoneType
from app.planner.validator import validate_path


def make_test_map() -> MapData:
    return MapData(
        id="val_map",
        name="Validator Map",
        width=10,
        height=10,
        resolution=0.5,
        walls=[GridPoint(x=5, y=5)],
        zones=[
            Zone(
                id="restricted_1",
                name="Restricted Zone",
                type=ZoneType.RESTRICTED,
                cells=[GridPoint(x=3, y=3)],
            )
        ],
        robot_start=GridPoint(x=0, y=0),
        charging_dock=GridPoint(x=9, y=9),
    )


def test_validator_accepts_legal_path():
    """Valid path with legal orthogonal transitions is accepted."""
    m = make_test_map()
    path = [GridPoint(x=0, y=0), GridPoint(x=1, y=0), GridPoint(x=2, y=0)]
    res = validate_path(path, m, expected_start=GridPoint(x=0, y=0), expected_goal=GridPoint(x=2, y=0))
    assert res.is_valid is True
    assert len(res.errors) == 0
    assert res.total_distance_m == 1.0


def test_validator_catches_wall_collision():
    """Path attempting to traverse a wall cell is rejected."""
    m = make_test_map()
    path = [GridPoint(x=4, y=5), GridPoint(x=5, y=5), GridPoint(x=6, y=5)]
    res = validate_path(path, m)
    assert res.is_valid is False
    assert any("wall" in err.lower() for err in res.errors)


def test_validator_catches_restricted_zone():
    """Path entering restricted no-go zone is rejected."""
    m = make_test_map()
    path = [GridPoint(x=2, y=3), GridPoint(x=3, y=3), GridPoint(x=4, y=3)]
    res = validate_path(path, m)
    assert res.is_valid is False
    assert any("restricted" in err.lower() for err in res.errors)


def test_validator_catches_teleportation():
    """Illegal step jump (dx > 1 or dy > 1) is rejected."""
    m = make_test_map()
    path = [GridPoint(x=1, y=1), GridPoint(x=5, y=5)]
    res = validate_path(path, m)
    assert res.is_valid is False
    assert any("teleport" in err.lower() for err in res.errors)


def test_validator_catches_diagonal_when_forbidden():
    """Diagonal step when allow_diagonal=False is rejected."""
    m = make_test_map()
    path = [GridPoint(x=1, y=1), GridPoint(x=2, y=2)]
    res = validate_path(path, m, allow_diagonal=False)
    assert res.is_valid is False
    assert any("diagonal" in err.lower() for err in res.errors)


def test_validator_catches_mismatched_endpoints():
    """Path start or goal mismatch is caught."""
    m = make_test_map()
    path = [GridPoint(x=1, y=1), GridPoint(x=2, y=1)]
    res = validate_path(path, m, expected_start=GridPoint(x=0, y=0), expected_goal=GridPoint(x=2, y=1))
    assert res.is_valid is False
    assert any("start" in err.lower() for err in res.errors)
