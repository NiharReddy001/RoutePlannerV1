"""Unit tests for A* pathfinding covering empty maps, walls, diagonal corner-cutting,

out-of-bounds endpoints, and unreachable targets.
"""

from app.models.coordinates import GridPoint
from app.models.map_data import MapData
from app.planner.astar import AStarPlanner


def make_simple_map(width: int = 10, height: int = 10, walls=None, zones=None) -> MapData:
    return MapData(
        id="test_map",
        name="Test Grid",
        width=width,
        height=height,
        resolution=0.5,
        walls=walls or [],
        zones=zones or [],
        robot_start=GridPoint(x=1, y=1),
        charging_dock=GridPoint(x=0, y=0),
    )


def test_astar_empty_map():
    """1. A* on an empty map finds direct path."""
    m = make_simple_map(10, 10)
    planner = AStarPlanner(m, allow_diagonal=False)
    res = planner.plan(GridPoint(x=1, y=1), GridPoint(x=4, y=4))
    assert res.success is True
    assert len(res.path) == 7  # (4-1) + (4-1) + 1 = 7 points
    assert res.path[0] == GridPoint(x=1, y=1)
    assert res.path[-1] == GridPoint(x=4, y=4)


def test_astar_routing_around_wall():
    """2. A* routes cleanly around a wall barrier."""
    # Place a vertical wall between x=3, y=1..5
    walls = [GridPoint(x=3, y=y) for y in range(1, 6)]
    m = make_simple_map(10, 10, walls=walls)
    planner = AStarPlanner(m, allow_diagonal=False)
    res = planner.plan(GridPoint(x=2, y=3), GridPoint(x=4, y=3))
    assert res.success is True
    assert res.path[0] == GridPoint(x=2, y=3)
    assert res.path[-1] == GridPoint(x=4, y=3)
    # Check that no point in path hits the wall
    wall_coords = {(p.x, p.y) for p in walls}
    for pt in res.path:
        assert (pt.x, pt.y) not in wall_coords


def test_astar_multiple_obstacles():
    """3. A* navigates complex multi-obstacle maze."""
    walls = [
        GridPoint(x=2, y=0), GridPoint(x=2, y=1), GridPoint(x=2, y=2),
        GridPoint(x=4, y=3), GridPoint(x=4, y=4), GridPoint(x=4, y=5),
    ]
    m = make_simple_map(8, 8, walls=walls)
    planner = AStarPlanner(m, allow_diagonal=False)
    res = planner.plan(GridPoint(x=0, y=1), GridPoint(x=6, y=4))
    assert res.success is True
    wall_coords = {(p.x, p.y) for p in walls}
    for pt in res.path:
        assert (pt.x, pt.y) not in wall_coords


def test_astar_start_equals_goal():
    """4. Start equal to goal returns single point path with zero cost."""
    m = make_simple_map(5, 5)
    planner = AStarPlanner(m)
    pt = GridPoint(x=2, y=2)
    res = planner.plan(pt, pt)
    assert res.success is True
    assert len(res.path) == 1
    assert res.path[0] == pt
    assert res.cost == 0.0


def test_astar_unreachable_goal():
    """5. Unreachable goal completely surrounded by walls reports failure."""
    # Goal at (5, 5) enclosed by walls at (4,5), (6,5), (5,4), (5,6)
    walls = [
        GridPoint(x=4, y=5), GridPoint(x=6, y=5),
        GridPoint(x=5, y=4), GridPoint(x=5, y=6),
    ]
    m = make_simple_map(10, 10, walls=walls)
    planner = AStarPlanner(m, allow_diagonal=False)
    res = planner.plan(GridPoint(x=1, y=1), GridPoint(x=5, y=5))
    assert res.success is False
    assert "unreachable" in res.error_message.lower()


def test_astar_blocked_start():
    """6. Start point inside wall returns immediate failure."""
    walls = [GridPoint(x=1, y=1)]
    m = make_simple_map(10, 10, walls=walls)
    planner = AStarPlanner(m)
    res = planner.plan(GridPoint(x=1, y=1), GridPoint(x=4, y=4))
    assert res.success is False
    assert "start" in res.error_message.lower()


def test_astar_blocked_goal():
    """7. Goal point inside wall returns immediate failure."""
    walls = [GridPoint(x=4, y=4)]
    m = make_simple_map(10, 10, walls=walls)
    planner = AStarPlanner(m)
    res = planner.plan(GridPoint(x=1, y=1), GridPoint(x=4, y=4))
    assert res.success is False
    assert "goal" in res.error_message.lower()


def test_astar_out_of_bounds():
    """8. Out-of-bounds coordinates return failure."""
    m = make_simple_map(5, 5)
    planner = AStarPlanner(m)
    res1 = planner.plan(GridPoint(x=-1, y=0), GridPoint(x=2, y=2))
    assert res1.success is False
    assert "out of bounds" in res1.error_message.lower()

    res2 = planner.plan(GridPoint(x=0, y=0), GridPoint(x=10, y=10))
    assert res2.success is False
    assert "out of bounds" in res2.error_message.lower()


def test_astar_grid_boundaries():
    """9. Path hugs boundaries without stepping outside [0..W-1, 0..H-1]."""
    m = make_simple_map(6, 6)
    planner = AStarPlanner(m)
    res = planner.plan(GridPoint(x=0, y=0), GridPoint(x=5, y=5))
    assert res.success is True
    for pt in res.path:
        assert 0 <= pt.x < 6
        assert 0 <= pt.y < 6


def test_astar_diagonal_safety_prevents_corner_cutting():
    """10. Diagonal movement enabled does not cut corners across diagonal obstacle walls."""
    # Obstacle configuration:
    # Wall at (1, 0) and wall at (0, 1).
    # Moving from (0, 0) to (1, 1) diagonally would cut through the corner of two walls!
    walls = [GridPoint(x=1, y=0), GridPoint(x=0, y=1)]
    m = make_simple_map(5, 5, walls=walls)
    planner = AStarPlanner(m, allow_diagonal=True)
    res = planner.plan(GridPoint(x=0, y=0), GridPoint(x=1, y=1))
    assert res.success is False or len(res.path) > 2
    # Specifically: point (0, 0) cannot step directly to (1, 1) in 1 step!
    if res.success:
        assert not (res.path[0] == GridPoint(x=0, y=0) and res.path[1] == GridPoint(x=1, y=1))
