"""Mission-Aware Autonomous Patrol Planner.

Sequences checkpoints, prioritized inspections, patrol coverage, and extra-patrol visits
with A* obstacle avoidance, independent path validation, and battery return-to-dock guarantees.
"""

from __future__ import annotations

import time
import uuid

from ..models.coordinates import GridPoint
from ..models.map_data import MapData, ZoneType
from ..models.mission import MissionConfig, MissionPlan, MissionTask, RouteLeg, TaskType
from ..models.robot_state import RobotConfig
from .astar import AStarPlanner
from .energy_model import EnergyModel
from .validator import validate_path


class MissionPlanner:
    """Core mission-aware route planner."""

    def __init__(
        self,
        map_data: MapData,
        robot_config: RobotConfig,
        mission_config: MissionConfig | None = None,
        allow_diagonal: bool = False,
        clearance_cells: int = 0,
        include_temporary_blockages: bool = True,
    ):
        self.map_data = map_data
        self.robot_config = robot_config
        self.mission_config = mission_config or MissionConfig()
        self.allow_diagonal = allow_diagonal
        self.clearance_cells = clearance_cells
        self.include_temporary_blockages = include_temporary_blockages
        self.astar = AStarPlanner(
            map_data=self.map_data,
            allow_diagonal=self.allow_diagonal,
            clearance_cells=self.clearance_cells,
            include_temporary_blockages=self.include_temporary_blockages,
        )

    def extract_tasks(
        self,
        completed_task_counts: dict[str, int] | None = None,
    ) -> list[MissionTask]:
        """Extracts and initialises structured tasks from checkpoints and zone overlays."""
        tasks: list[MissionTask] = []
        completed_map = completed_task_counts or {}

        # 1. Checkpoint tasks
        sorted_checkpoints = list(self.map_data.checkpoints)
        if self.mission_config.fixed_checkpoint_order:
            sorted_checkpoints.sort(key=lambda cp: cp.order if cp.order is not None else 999)

        for cp in sorted_checkpoints:
            t_id = f"chk_{cp.id}"
            done = completed_map.get(t_id, 0)
            req = 1
            tasks.append(
                MissionTask(
                    id=t_id,
                    task_type=TaskType.CHECKPOINT,
                    target_position=cp.position,
                    target_name=f"Checkpoint: {cp.name}",
                    priority=10,
                    required_visits=req,
                    completed_visits=done,
                    is_completed=(done >= req),
                )
            )

        # 2. Zone tasks
        for zone in self.map_data.zones:
            if zone.type == ZoneType.RESTRICTED or zone.type == ZoneType.TEMPORARY_BLOCKAGE:
                continue

            # Map zone type to TaskType and priority
            t_type = TaskType.STANDARD_PATROL
            base_prio = zone.priority
            req_visits = 1

            if zone.type == ZoneType.HIGH_PRIORITY_INSPECTION:
                t_type = TaskType.HIGH_PRIORITY_INSPECTION
                base_prio = max(base_prio, 8)
                req_visits = 1
            elif zone.type == ZoneType.EXTRA_PATROL:
                t_type = TaskType.EXTRA_PATROL
                base_prio = max(base_prio, 5)
                req_visits = max(zone.required_visits, self.mission_config.extra_patrol_multiplier)
            elif zone.type == ZoneType.ONE_TIME_INSPECTION:
                t_type = TaskType.ONE_TIME_INSPECTION
                base_prio = max(base_prio, 6)
                req_visits = 1
            elif zone.type == ZoneType.LOW_PRIORITY:
                t_type = TaskType.LOW_PRIORITY
                base_prio = min(base_prio, 1)
                req_visits = 1

            for p in zone.cells:
                t_id = f"zone_{zone.id}_{p.x}_{p.y}"
                done = completed_map.get(t_id, 0)
                tasks.append(
                    MissionTask(
                        id=t_id,
                        task_type=t_type,
                        target_position=p,
                        target_name=f"{zone.name} cell ({p.x}, {p.y})",
                        zone_id=zone.id,
                        priority=base_prio,
                        required_visits=req_visits,
                        completed_visits=done,
                        is_completed=(done >= req_visits),
                    )
                )

        return tasks

    def plan_mission(
        self,
        current_robot_position: GridPoint | None = None,
        current_battery_pct: float = 100.0,
        completed_task_counts: dict[str, int] | None = None,
    ) -> MissionPlan:
        """Constructs a validated, obstacle-aware, battery-constrained mission route."""
        start_time = time.perf_counter()
        plan_id = str(uuid.uuid4())[:8]
        start_pt = current_robot_position or self.map_data.robot_start
        dock_pt = self.map_data.charging_dock

        tasks = self.extract_tasks(completed_task_counts=completed_task_counts)
        legs: list[RouteLeg] = []
        all_waypoints: list[GridPoint] = [start_pt]
        warnings: list[str] = []
        unreachable_task_ids: list[str] = []

        curr_pos = start_pt
        curr_battery = current_battery_pct
        accumulated_distance_m = 0.0

        # Check start traversability
        if not self.astar.is_cell_passable(start_pt.x, start_pt.y):
            # Check if start point is strictly a wall
            if (start_pt.x, start_pt.y) in self.map_data.get_wall_set():
                warnings.append(f"Robot start ({start_pt.x}, {start_pt.y}) is inside a wall obstacle.")
            elif (start_pt.x, start_pt.y) in self.map_data.get_restricted_cells():
                warnings.append(f"Robot start ({start_pt.x}, {start_pt.y}) is inside a restricted no-go zone.")
            elif self.include_temporary_blockages and (start_pt.x, start_pt.y) in self.map_data.get_temporary_blockages():
                warnings.append(f"Robot start ({start_pt.x}, {start_pt.y}) is obstructed by a temporary blockage.")

        # Check dock reachability test upfront
        dock_check = self.astar.plan(start_pt, dock_pt)
        dock_reachable = dock_check.success
        if not dock_reachable:
            warnings.append(
                f"Charging dock ({dock_pt.x}, {dock_pt.y}) is currently unreachable from robot position: {dock_check.error_message}"
            )

        # Separate checkpoints if fixed ordering is requested
        pending_checkpoints: list[MissionTask] = []
        pending_other_tasks: list[MissionTask] = []

        for t in tasks:
            if t.is_completed:
                continue

            # Pre-filter targets that are clearly inside obstacles/blockages
            tgt_pt = (t.target_position.x, t.target_position.y)
            if tgt_pt in self.map_data.get_wall_set():
                t.is_unreachable = True
                t.unreachable_reason = "Target location is occupied by a wall obstacle"
                unreachable_task_ids.append(t.id)
                continue
            if tgt_pt in self.map_data.get_restricted_cells():
                t.is_unreachable = True
                t.unreachable_reason = "Target location is inside a restricted no-go zone"
                unreachable_task_ids.append(t.id)
                continue
            if self.include_temporary_blockages and tgt_pt in self.map_data.get_temporary_blockages():
                t.is_unreachable = True
                t.unreachable_reason = "Target location is blocked by temporary obstruction"
                unreachable_task_ids.append(t.id)
                continue

            if t.task_type == TaskType.CHECKPOINT and self.mission_config.fixed_checkpoint_order:
                pending_checkpoints.append(t)
            else:
                pending_other_tasks.append(t)

        # Helper to execute leg to target
        def schedule_target(target_task: MissionTask) -> bool:
            nonlocal curr_pos, curr_battery, accumulated_distance_m
            res = self.astar.plan(curr_pos, target_task.target_position)
            if not res.success:
                target_task.is_unreachable = True
                target_task.unreachable_reason = res.error_message
                unreachable_task_ids.append(target_task.id)
                return False

            leg_dist = len(res.path[1:]) * self.map_data.resolution

            # Check return-to-dock feasibility from target_task.target_position
            if self.mission_config.enforce_return_to_dock and dock_reachable:
                dock_res = self.astar.plan(target_task.target_position, dock_pt)
                if dock_res.success:
                    return_dist = len(dock_res.path[1:]) * self.map_data.resolution
                    eval_energy = EnergyModel.evaluate_mission_energy(
                        current_battery_pct=curr_battery,
                        mission_distance_m=leg_dist,
                        return_to_dock_distance_m=return_dist,
                        config=self.robot_config,
                    )
                    if not eval_energy.is_feasible:
                        warnings.append(
                            f"Task {target_task.target_name} skipped due to energy constraint: {eval_energy.warning}"
                        )
                        return False
                else:
                    warnings.append(
                        f"Cannot verify return to dock from {target_task.target_name} ({target_task.target_position.x}, {target_task.target_position.y})"
                    )

            # Leg is feasible! Commit it.
            leg_index = len(legs)
            leg = RouteLeg(
                leg_index=leg_index,
                from_point=curr_pos,
                to_point=target_task.target_position,
                path=res.path,
                distance_m=round(leg_dist, 3),
                task_id=target_task.id,
                task_type=target_task.task_type,
                description=f"Transit to {target_task.target_name}",
            )
            legs.append(leg)

            # Append waypoints (skip first point to avoid duplicate with previous leg endpoint)
            if len(res.path) > 1:
                all_waypoints.extend(res.path[1:])

            accumulated_distance_m += leg_dist
            curr_battery = max(0.0, curr_battery - EnergyModel.calculate_travel_energy_pct(leg_dist, self.robot_config))
            curr_pos = target_task.target_position
            target_task.completed_visits += 1
            if target_task.completed_visits >= target_task.required_visits:
                target_task.is_completed = True
            return True

        # 1. Process fixed checkpoints first
        for cp_task in pending_checkpoints:
            schedule_target(cp_task)

        # 2. Process other tasks using priority-weighted greedy scheduling
        # Tasks are repeatedly selected based on max score:
        # score = (prio_weight * priority + 1.0) / (manhattan_dist + 1.0)
        prio_weights = self.mission_config.priority_weights
        candidate_pool = [t for t in pending_other_tasks if not t.is_completed and not t.is_unreachable]

        while candidate_pool:
            best_task: MissionTask | None = None
            best_score = -1.0

            for cand in candidate_pool:
                weight = 1.0
                if cand.task_type == TaskType.HIGH_PRIORITY_INSPECTION:
                    weight = prio_weights.get("high", 3.0)
                elif cand.task_type == TaskType.LOW_PRIORITY:
                    weight = prio_weights.get("low", 0.5)
                else:
                    weight = prio_weights.get("standard", 1.0)

                m_dist = curr_pos.manhattan_distance(cand.target_position)
                score = (weight * cand.priority + 1.0) / (m_dist + 1.0)
                if score > best_score:
                    best_score = score
                    best_task = cand

            if best_task is None:
                break

            candidate_pool.remove(best_task)
            success = schedule_target(best_task)

            # If it requires extra visits and is not yet completed and was reachable, re-add to pool
            if success and not best_task.is_completed and not best_task.is_unreachable:
                candidate_pool.append(best_task)

            # If battery drops too close to safety reserve, abort adding further tasks
            if curr_battery <= self.robot_config.safety_reserve_pct + 1.0:
                warnings.append("Low battery threshold reached; stopping further target expansion to ensure safe return.")
                break

        # 3. Final return to dock leg
        if self.mission_config.enforce_return_to_dock:
            if curr_pos.x != dock_pt.x or curr_pos.y != dock_pt.y:
                dock_plan = self.astar.plan(curr_pos, dock_pt)
                if dock_plan.success:
                    dock_dist = len(dock_plan.path[1:]) * self.map_data.resolution
                    leg = RouteLeg(
                        leg_index=len(legs),
                        from_point=curr_pos,
                        to_point=dock_pt,
                        path=dock_plan.path,
                        distance_m=round(dock_dist, 3),
                        task_id="return_to_dock",
                        task_type=TaskType.RETURN_TO_DOCK,
                        description="Final return to charging dock",
                    )
                    legs.append(leg)
                    if len(dock_plan.path) > 1:
                        all_waypoints.extend(dock_plan.path[1:])
                    accumulated_distance_m += dock_dist
                    curr_battery = max(0.0, curr_battery - EnergyModel.calculate_travel_energy_pct(dock_dist, self.robot_config))
                    curr_pos = dock_pt
                else:
                    dock_reachable = False
                    warnings.append(
                        f"Final return to dock failed: Dock ({dock_pt.x}, {dock_pt.y}) is blocked or unreachable."
                    )

        # 4. Independent path validation
        val_res = validate_path(
            path=all_waypoints,
            map_data=self.map_data,
            expected_start=start_pt,
            expected_goal=dock_pt if self.mission_config.enforce_return_to_dock and dock_reachable else None,
            allow_diagonal=self.allow_diagonal,
            include_temporary_blockages=self.include_temporary_blockages,
        )
        if not val_res.is_valid:
            warnings.extend(val_res.errors)

        # 5. Coverage calculation
        total_patrol_cells = sum(
            len(z.cells) for z in self.map_data.zones
            if z.type in [ZoneType.STANDARD_PATROL, ZoneType.HIGH_PRIORITY_INSPECTION, ZoneType.EXTRA_PATROL, ZoneType.ONE_TIME_INSPECTION]
        )
        completed_cells = sum(
            1 for t in tasks
            if t.zone_id is not None and t.completed_visits >= 1
        )
        coverage_pct = round((completed_cells / max(1, total_patrol_cells)) * 100.0, 1)

        # Duration estimation based on linear robot speed
        duration_s = round(accumulated_distance_m / max(0.1, self.robot_config.speed_m_s), 1)
        battery_used = round(current_battery_pct - curr_battery, 2)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        is_feasible = val_res.is_valid and (curr_battery >= self.robot_config.safety_reserve_pct or not self.mission_config.enforce_return_to_dock)

        return MissionPlan(
            plan_id=plan_id,
            algorithm_name="A* + Priority-Weighted Mission Sequencer",
            is_feasible=is_feasible,
            waypoints=all_waypoints,
            legs=legs,
            tasks=tasks,
            total_distance_m=round(accumulated_distance_m, 2),
            estimated_duration_s=duration_s,
            estimated_battery_used_pct=battery_used,
            estimated_final_battery_pct=round(curr_battery, 2),
            planning_time_ms=elapsed_ms,
            coverage_percentage=coverage_pct,
            dock_reachable=dock_reachable,
            warnings=warnings,
            unreachable_tasks=unreachable_task_ids,
            created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )
