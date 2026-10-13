"""Single-robot execution simulation state machine and event logging."""

from __future__ import annotations

import math
import time

from pydantic import BaseModel, Field

from ..models.coordinates import GridPoint
from ..models.map_data import MapData
from ..models.mission import MissionPlan
from ..models.robot_state import RobotConfig, RobotPose, RobotStatus, RobotTelemetry
from ..planner.energy_model import EnergyModel
from ..planner.patrol_planner import MissionPlanner


class SimulationEvent(BaseModel):
    id: str
    timestamp: str
    event_type: str
    message: str
    details: dict[str, str] | None = None


class SimulationState(BaseModel):
    is_running: bool = False
    is_paused: bool = False
    is_completed: bool = False
    status: RobotStatus = RobotStatus.IDLE
    current_waypoint_index: int = 0
    total_waypoints: int = 0
    current_pose: RobotPose
    battery_pct: float = 100.0
    is_charging: bool = False
    is_docked: bool = False
    distance_traveled_m: float = 0.0
    simulation_speed: float = 1.0
    completed_task_ids: dict[str, int] = Field(default_factory=dict)
    visited_cells: list[GridPoint] = Field(default_factory=list)
    recent_events: list[SimulationEvent] = Field(default_factory=list)


class SimulationEngine:
    """Manages robot motion execution along planned routes, battery drain, task completions, and replanning triggers."""

    def __init__(self, map_data: MapData, robot_config: RobotConfig):
        self.map_data = map_data
        self.robot_config = robot_config
        self.active_plan: MissionPlan | None = None

        self.is_running: bool = False
        self.is_paused: bool = False
        self.is_completed: bool = False
        self.status: RobotStatus = RobotStatus.IDLE
        self.current_waypoint_index: int = 0
        self.current_pose = RobotPose(position=map_data.robot_start, heading_deg=0.0)
        self.battery_pct: float = self.robot_config.battery_capacity_pct
        self.is_charging: bool = False
        self.is_docked: bool = False
        self.distance_traveled_m: float = 0.0
        self.simulation_speed: float = 1.0
        self.completed_tasks: dict[str, int] = {}
        self.visited_cells: set[tuple[int, int]] = {(map_data.robot_start.x, map_data.robot_start.y)}
        self.event_log: list[SimulationEvent] = []

        self._log_event("SYSTEM", f"Simulation engine initialized at ({map_data.robot_start.x}, {map_data.robot_start.y})")

    def _log_event(self, event_type: str, message: str, details: dict[str, str] | None = None) -> None:
        evt = SimulationEvent(
            id=str(len(self.event_log) + 1),
            timestamp=time.strftime("%H:%M:%S", time.localtime()),
            event_type=event_type,
            message=message,
            details=details,
        )
        self.event_log.append(evt)
        # Keep maximum 100 recent events in memory
        if len(self.event_log) > 100:
            self.event_log = self.event_log[-100:]

    def load_plan(self, plan: MissionPlan, reset_state: bool = False) -> None:
        self.active_plan = plan
        if reset_state:
            self.reset()
        else:
            self._log_event("PLAN_LOADED", f"New plan '{plan.plan_id}' loaded with {len(plan.waypoints)} waypoints.")

    def start(self) -> None:
        if not self.active_plan or not self.active_plan.waypoints:
            self._log_event("WARNING", "Cannot start simulation: No active route loaded.")
            return
        if self.is_completed:
            self.reset()
        self.is_running = True
        self.is_paused = False
        self.status = RobotStatus.NAVIGATING
        self._log_event("EXECUTION_START", f"Simulation started at waypoint {self.current_waypoint_index}.")

    def pause(self) -> None:
        if self.is_running:
            self.is_running = False
            self.is_paused = True
            self.status = RobotStatus.PAUSED
            self._log_event("EXECUTION_PAUSE", f"Simulation paused at waypoint {self.current_waypoint_index}.")

    def resume(self) -> None:
        if self.is_paused and not self.is_completed:
            self.is_running = True
            self.is_paused = False
            self.status = RobotStatus.NAVIGATING
            self._log_event("EXECUTION_RESUME", f"Simulation resumed at waypoint {self.current_waypoint_index}.")

    def stop(self) -> None:
        self.is_running = False
        self.is_paused = False
        self.status = RobotStatus.IDLE
        self._log_event("EXECUTION_STOP", "Simulation stopped by operator.")

    def reset(self) -> None:
        self.is_running = False
        self.is_paused = False
        self.is_completed = False
        self.status = RobotStatus.IDLE
        self.current_waypoint_index = 0
        self.current_pose = RobotPose(position=self.map_data.robot_start, heading_deg=0.0)
        self.battery_pct = self.robot_config.battery_capacity_pct
        self.is_charging = False
        self.is_docked = False
        self.distance_traveled_m = 0.0
        self.completed_tasks = {}
        self.visited_cells = {(self.map_data.robot_start.x, self.map_data.robot_start.y)}
        self._log_event("EXECUTION_RESET", "Simulation state reset to start configuration.")

    def step(self, steps_to_advance: int = 1) -> RobotTelemetry:
        """Advance the simulation forward along the active route."""
        if not self.is_running or not self.active_plan or not self.active_plan.waypoints:
            return self.get_telemetry()

        dock = self.map_data.charging_dock

        # Check if already docked
        if self.is_docked:
            # Charge battery
            if self.battery_pct < self.robot_config.battery_capacity_pct:
                self.battery_pct = EnergyModel.charge_step(self.battery_pct, 1.0 * self.simulation_speed, self.robot_config)
                self.is_charging = True
                self.status = RobotStatus.DOCKED
            else:
                self.is_charging = False
                self.status = RobotStatus.DOCKED
            return self.get_telemetry()

        waypoints = self.active_plan.waypoints

        for _ in range(steps_to_advance):
            if self.current_waypoint_index >= len(waypoints) - 1:
                # Reached end of route
                self.is_running = False
                self.is_completed = True
                if self.current_pose.position.x == dock.x and self.current_pose.position.y == dock.y:
                    self.is_docked = True
                    self.status = RobotStatus.DOCKED
                    self._log_event("DOCKED", f"Robot safely docked at charging station ({dock.x}, {dock.y}).")
                else:
                    self.status = RobotStatus.IDLE
                    self._log_event("MISSION_COMPLETE", "Robot reached final route waypoint.")
                break

            # Look ahead to next waypoint
            next_idx = self.current_waypoint_index + 1
            next_pt = waypoints[next_idx]

            # Collision check against dynamic blockages or updated walls
            if not self.map_data.is_traversable(next_pt.x, next_pt.y, include_temporary_blockages=True):
                self.is_running = False
                self.status = RobotStatus.BLOCKED
                self._log_event(
                    "OBSTACLE_DETECTED",
                    f"Path blocked at step {next_idx} ({next_pt.x}, {next_pt.y}). Execution paused for replanning."
                )
                break

            # Calculate heading change and distance
            curr_pt = self.current_pose.position
            dx = next_pt.x - curr_pt.x
            dy = next_pt.y - curr_pt.y
            if dx != 0 or dy != 0:
                # 0=East (+x), 90=South (+y), 180=West (-x), 270=North (-y)
                angle_rad = math.atan2(dy, dx)
                heading_deg = (math.degrees(angle_rad) + 360.0) % 360.0
                self.current_pose.heading_deg = round(heading_deg, 1)

            step_dist_m = math.sqrt(dx * dx + dy * dy) * self.map_data.resolution
            drain_pct = EnergyModel.calculate_travel_energy_pct(step_dist_m, self.robot_config)

            # Check battery
            if self.battery_pct - drain_pct <= 0.0:
                self.battery_pct = 0.0
                self.is_running = False
                self.status = RobotStatus.OUT_OF_BATTERY
                self._log_event("BATTERY_DEPLETED", f"Robot ran out of battery at ({curr_pt.x}, {curr_pt.y})!")
                break

            self.battery_pct = round(max(0.0, self.battery_pct - drain_pct), 2)
            self.distance_traveled_m = round(self.distance_traveled_m + step_dist_m, 2)
            self.current_waypoint_index = next_idx
            self.current_pose.position = next_pt
            self.visited_cells.add((next_pt.x, next_pt.y))

            # Check if this cell satisfies any mission tasks
            self._check_task_completion(next_pt)

            # Check if robot has reached dock
            if next_pt.x == dock.x and next_pt.y == dock.y and next_idx == len(waypoints) - 1:
                self.is_docked = True
                self.is_charging = True
                self.status = RobotStatus.DOCKED
                self.is_completed = True
                self.is_running = False
                self._log_event("DOCKED", f"Robot safely returned to charging dock ({dock.x}, {dock.y}). Charging initiated.")
                break

        return self.get_telemetry()

    def _check_task_completion(self, pt: GridPoint) -> None:
        """Check if visiting cell pt completes or updates any checkpoint or zone tasks."""
        if not self.active_plan:
            return

        for task in self.active_plan.tasks:
            if task.target_position.x == pt.x and task.target_position.y == pt.y:
                prev_visits = self.completed_tasks.get(task.id, 0)
                if prev_visits < task.required_visits:
                    new_visits = prev_visits + 1
                    self.completed_tasks[task.id] = new_visits
                    task.completed_visits = new_visits
                    if new_visits >= task.required_visits:
                        task.is_completed = True
                        self._log_event("TASK_COMPLETED", f"Completed task: {task.target_name}")

    def get_telemetry(self) -> RobotTelemetry:
        return RobotTelemetry(
            pose=self.current_pose,
            battery_pct=round(self.battery_pct, 1),
            status=self.status,
            is_charging=self.is_charging,
            is_docked=self.is_docked,
            distance_traveled_m=round(self.distance_traveled_m, 2),
            current_step_index=self.current_waypoint_index,
            total_steps=len(self.active_plan.waypoints) if self.active_plan else 0,
        )

    def get_state(self) -> SimulationState:
        return SimulationState(
            is_running=self.is_running,
            is_paused=self.is_paused,
            is_completed=self.is_completed,
            status=self.status,
            current_waypoint_index=self.current_waypoint_index,
            total_waypoints=len(self.active_plan.waypoints) if self.active_plan else 0,
            current_pose=self.current_pose,
            battery_pct=round(self.battery_pct, 1),
            is_charging=self.is_charging,
            is_docked=self.is_docked,
            distance_traveled_m=round(self.distance_traveled_m, 2),
            simulation_speed=self.simulation_speed,
            completed_task_ids=dict(self.completed_tasks),
            visited_cells=[GridPoint(x=x, y=y) for (x, y) in self.visited_cells],
            recent_events=list(self.event_log[-20:]),
        )

    def replan_from_current_state(self, planner: MissionPlanner) -> MissionPlan:
        """Trigger dynamic replanning from current robot pose preserving already completed tasks."""
        self._log_event(
            "REPLAN_REQUESTED",
            f"Dynamic replanning triggered from robot position ({self.current_pose.position.x}, {self.current_pose.position.y}) with {self.battery_pct:.1f}% battery."
        )
        new_plan = planner.plan_mission(
            current_robot_position=self.current_pose.position,
            current_battery_pct=self.battery_pct,
            completed_task_counts=self.completed_tasks,
        )
        self.load_plan(new_plan, reset_state=False)
        self.current_waypoint_index = 0
        if self.status == RobotStatus.BLOCKED and new_plan.is_feasible:
            self.status = RobotStatus.NAVIGATING
        return new_plan
