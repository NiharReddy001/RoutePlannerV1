"""Unit tests for simulation engine, blockage handling, replanning from pose, and state machines.

(Requirements 19-21, 26)
"""

from app.models.coordinates import GridPoint
from app.models.map_data import MapData, Zone, ZoneType
from app.models.robot_state import RobotConfig, RobotStatus
from app.planner.patrol_planner import MissionPlanner
from app.simulation.simulator import SimulationEngine


def make_sim_map() -> MapData:
    return MapData(
        id="sim_map",
        name="Sim Map",
        width=10,
        height=10,
        resolution=0.5,
        walls=[],
        zones=[
            Zone(
                id="std_z",
                name="Area 1",
                type=ZoneType.STANDARD_PATROL,
                cells=[GridPoint(x=5, y=5)],
            )
        ],
        robot_start=GridPoint(x=0, y=0),
        charging_dock=GridPoint(x=0, y=0),
    )


def test_simulation_pause_resume_reset():
    """26. Simulation pause, resume, and reset operate reliably without state leaks."""
    m = make_sim_map()
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)
    plan = planner.plan_mission()

    sim = SimulationEngine(m, cfg)
    sim.load_plan(plan)

    # Initially idle
    assert sim.status == RobotStatus.IDLE
    assert sim.current_waypoint_index == 0

    # Start
    sim.start()
    assert sim.is_running is True
    assert sim.status == RobotStatus.NAVIGATING

    # Step forward 2 waypoints
    telemetry = sim.step(steps_to_advance=2)
    assert telemetry.current_step_index == 2
    assert sim.current_waypoint_index == 2
    assert sim.battery_pct < 100.0

    # Pause
    sim.pause()
    assert sim.is_running is False
    assert sim.is_paused is True
    assert sim.status == RobotStatus.PAUSED
    saved_index = sim.current_waypoint_index

    # Stepping while paused does not advance
    sim.step(steps_to_advance=1)
    assert sim.current_waypoint_index == saved_index

    # Resume
    sim.resume()
    assert sim.is_running is True
    assert sim.is_paused is False

    # Reset
    sim.reset()
    assert sim.is_running is False
    assert sim.is_paused is False
    assert sim.current_waypoint_index == 0
    assert sim.current_pose.position == m.robot_start
    assert sim.battery_pct == 100.0
    assert sim.status == RobotStatus.IDLE


def test_temporary_blockage_and_replanning():
    """19, 20, 21. Temporary blockage insertion, replanning from current robot pose, and blockage removal."""
    m = make_sim_map()
    cfg = RobotConfig(battery_capacity_pct=100.0, consumption_per_meter=0.1)
    planner = MissionPlanner(m, robot_config=cfg)
    plan = planner.plan_mission()

    sim = SimulationEngine(m, cfg)
    sim.load_plan(plan)
    sim.start()

    # Advance 3 steps
    sim.step(steps_to_advance=3)
    curr_pos = sim.current_pose.position

    # 19. Insert temporary blockage directly in front of robot
    blockage_pt = sim.active_plan.waypoints[sim.current_waypoint_index + 1]
    blockage_zone = Zone(
        id="temp_block_1",
        name="Spill",
        type=ZoneType.TEMPORARY_BLOCKAGE,
        cells=[blockage_pt],
    )
    sim.map_data.zones.append(blockage_zone)

    # Next step detects blockage and stops safely
    sim.step(steps_to_advance=1)
    assert sim.status == RobotStatus.BLOCKED
    assert sim.is_running is False

    # 21. Replan from current robot position
    planner_updated = MissionPlanner(sim.map_data, robot_config=cfg)
    new_plan = sim.replan_from_current_state(planner_updated)

    assert new_plan.is_feasible is True
    # Verify new route starts from robot's current position, not original start!
    assert new_plan.waypoints[0] == curr_pos
    # Verify new route does not step on blockage_pt
    assert not any(pt == blockage_pt for pt in new_plan.waypoints)

    # 20. Remove temporary blockage and verify underlying terrain is restored
    sim.map_data.zones = [z for z in sim.map_data.zones if z.id != "temp_block_1"]
    assert sim.map_data.is_traversable(blockage_pt.x, blockage_pt.y) is True
