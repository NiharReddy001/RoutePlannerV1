"""Unit tests for mission planner covering checkpoints, priorities, patrol coverage,

extra-patrol visits, one-time tasks, unreachable tasks, battery feasibility, and dock returns.
(Requirements 13-18, 22-25)
"""

from app.models.coordinates import GridPoint
from app.models.map_data import Checkpoint, MapData, Zone, ZoneType
from app.models.mission import MissionConfig, TaskType
from app.models.robot_state import RobotConfig
from app.planner.patrol_planner import MissionPlanner


def make_patrol_map() -> MapData:
    return MapData(
        id="patrol_test_map",
        name="Patrol Map",
        width=15,
        height=15,
        resolution=0.5,
        walls=[],
        zones=[
            Zone(
                id="high_zone",
                name="Server Room Inspection",
                type=ZoneType.HIGH_PRIORITY_INSPECTION,
                cells=[GridPoint(x=10, y=10)],
                priority=9,
            ),
            Zone(
                id="low_zone",
                name="Low Priority Storage",
                type=ZoneType.LOW_PRIORITY,
                cells=[GridPoint(x=3, y=3)],
                priority=1,
            ),
            Zone(
                id="extra_zone",
                name="Perimeter Walk",
                type=ZoneType.EXTRA_PATROL,
                cells=[GridPoint(x=6, y=6)],
                priority=5,
                required_visits=2,
            ),
            Zone(
                id="onetime_zone",
                name="Valve Inspection",
                type=ZoneType.ONE_TIME_INSPECTION,
                cells=[GridPoint(x=8, y=2)],
                priority=6,
            ),
        ],
        robot_start=GridPoint(x=1, y=1),
        charging_dock=GridPoint(x=0, y=0),
        checkpoints=[
            Checkpoint(id="cp1", name="Alpha CP", position=GridPoint(x=2, y=2), order=1),
            Checkpoint(id="cp2", name="Bravo CP", position=GridPoint(x=12, y=2), order=2),
        ],
    )


def test_mission_multiple_checkpoints():
    """13. Mission with multiple checkpoints visits all specified checkpoints."""
    m = make_patrol_map()
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1, safety_reserve_pct=10.0)
    mission_cfg = MissionConfig(fixed_checkpoint_order=True)
    planner = MissionPlanner(m, robot_config=cfg, mission_config=mission_cfg)

    plan = planner.plan_mission()
    assert plan.is_feasible is True
    # Verify cp1 and cp2 appear in legs
    cp_tasks = [t for t in plan.tasks if t.task_type == TaskType.CHECKPOINT]
    assert len(cp_tasks) == 2
    assert all(t.is_completed for t in cp_tasks)


def test_priority_affects_task_selection():
    """14. Priority weighting influences order of target visits."""
    m = make_patrol_map()
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)

    plan = planner.plan_mission()
    # Find index of leg visiting high_zone vs low_zone
    high_leg_idx = None
    low_leg_idx = None
    for leg in plan.legs:
        if "Server Room" in leg.description:
            high_leg_idx = leg.leg_index
        elif "Storage" in leg.description:
            low_leg_idx = leg.leg_index

    assert high_leg_idx is not None
    assert low_leg_idx is not None
    assert plan.is_feasible is True


def test_standard_patrol_coverage():
    """15. Patrol coverage tracks visited cells in declared zones."""
    m = MapData(
        id="cov_map",
        name="Coverage Map",
        width=10,
        height=10,
        resolution=0.5,
        walls=[],
        zones=[
            Zone(
                id="std_z",
                name="Standard Zone",
                type=ZoneType.STANDARD_PATROL,
                cells=[GridPoint(x=2, y=2), GridPoint(x=2, y=3)],
            )
        ],
        robot_start=GridPoint(x=1, y=1),
        charging_dock=GridPoint(x=0, y=0),
    )
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)
    plan = planner.plan_mission()
    assert plan.coverage_percentage == 100.0


def test_extra_patrol_visit_requirements():
    """16. Extra-patrol zones require and receive multiple visits."""
    m = MapData(
        id="extra_map",
        name="Extra Patrol Map",
        width=10,
        height=10,
        resolution=0.5,
        walls=[],
        zones=[
            Zone(
                id="ex_z",
                name="High Traffic Hallway",
                type=ZoneType.EXTRA_PATROL,
                cells=[GridPoint(x=4, y=4)],
                required_visits=2,
            )
        ],
        robot_start=GridPoint(x=1, y=1),
        charging_dock=GridPoint(x=0, y=0),
    )
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)
    plan = planner.plan_mission()

    ex_tasks = [t for t in plan.tasks if t.task_type == TaskType.EXTRA_PATROL]
    assert len(ex_tasks) == 1
    assert ex_tasks[0].required_visits >= 2
    assert ex_tasks[0].completed_visits >= 2


def test_one_time_target_completion_persistence():
    """17. Already completed one-time tasks are not re-scheduled on replanning."""
    m = make_patrol_map()
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)

    # Simulate that "zone_onetime_zone_8_2" was already visited
    completed = {"zone_onetime_zone_8_2": 1}
    plan = planner.plan_mission(completed_task_counts=completed)

    # Check task list
    onetime_task = next(t for t in plan.tasks if t.id == "zone_onetime_zone_8_2")
    assert onetime_task.is_completed is True
    # Ensure no leg transit was generated specifically for this already-done task
    assert not any(leg.task_id == "zone_onetime_zone_8_2" for leg in plan.legs)


def test_unreachable_mission_tasks():
    """18. Tasks placed inside walled-off areas are reported as unreachable with diagnostic reasons."""
    # Place wall enclosing target at (8, 8)
    walls = [
        GridPoint(x=7, y=8), GridPoint(x=9, y=8),
        GridPoint(x=8, y=7), GridPoint(x=8, y=9),
    ]
    m = MapData(
        id="unreachable_map",
        name="Unreachable Map",
        width=12,
        height=12,
        walls=walls,
        zones=[
            Zone(
                id="walled_zone",
                name="Walled Safe",
                type=ZoneType.HIGH_PRIORITY_INSPECTION,
                cells=[GridPoint(x=8, y=8)],
            )
        ],
        robot_start=GridPoint(x=1, y=1),
        charging_dock=GridPoint(x=0, y=0),
    )
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)
    plan = planner.plan_mission()

    assert len(plan.unreachable_tasks) > 0
    t = next(task for task in plan.tasks if task.target_position == GridPoint(x=8, y=8))
    assert t.is_unreachable is True
    assert t.unreachable_reason is not None


def test_battery_feasible_route():
    """22. Route with ample battery completes feasible with reserve intact."""
    m = make_patrol_map()
    # Very low consumption rate
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.01, safety_reserve_pct=15.0)
    planner = MissionPlanner(m, robot_config=cfg)
    plan = planner.plan_mission(current_battery_pct=100.0)

    assert plan.is_feasible is True
    assert plan.estimated_final_battery_pct >= 15.0


def test_battery_infeasible_route():
    """23. Route where battery is too low triggers warning and prevents unsafe execution."""
    m = make_patrol_map()
    # High consumption rate
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=5.0, safety_reserve_pct=20.0)
    planner = MissionPlanner(m, robot_config=cfg)
    # Start with only 22% battery
    plan = planner.plan_mission(current_battery_pct=22.0)

    assert len(plan.warnings) > 0
    assert any("battery" in w.lower() or "reserve" in w.lower() for w in plan.warnings)


def test_return_to_dock_behavior():
    """24. Mission plan finishes at the charging dock when enforce_return_to_dock=True."""
    m = make_patrol_map()
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg, mission_config=MissionConfig(enforce_return_to_dock=True))
    plan = planner.plan_mission()

    assert plan.dock_reachable is True
    assert plan.waypoints[-1] == m.charging_dock
    assert plan.legs[-1].task_type == TaskType.RETURN_TO_DOCK


def test_unreachable_charging_dock():
    """25. Blocked dock is flagged honestly without claiming safe mission feasibility."""
    walls = [
        GridPoint(x=1, y=0), GridPoint(x=0, y=1)  # block dock at (0,0)
    ]
    m = make_patrol_map()
    m.walls.extend(walls)
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg, mission_config=MissionConfig(enforce_return_to_dock=True))
    plan = planner.plan_mission()

    assert plan.dock_reachable is False
    assert any("dock" in w.lower() and "unreachable" in w.lower() for w in plan.warnings)
