"""Mission configuration, task representations, and route plan models."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from .coordinates import GridPoint


class TaskType(str, Enum):
    CHECKPOINT = "checkpoint"
    HIGH_PRIORITY_INSPECTION = "high_priority_inspection"
    STANDARD_PATROL = "standard_patrol"
    EXTRA_PATROL = "extra_patrol"
    ONE_TIME_INSPECTION = "one_time_inspection"
    LOW_PRIORITY = "low_priority"
    RETURN_TO_DOCK = "return_to_dock"


class MissionTask(BaseModel):
    id: str = Field(..., description="Unique task identifier")
    task_type: TaskType = Field(..., description="Classification of the mission action")
    target_position: GridPoint = Field(..., description="Grid coordinate of the task")
    target_name: str = Field(default="", description="Human-readable label for UI and event log")
    zone_id: str | None = Field(default=None, description="Associated zone ID if originated from a zone")
    priority: int = Field(default=1, ge=0, le=10, description="Priority weight")
    required_visits: int = Field(default=1, ge=1, le=10, description="Target visit count")
    completed_visits: int = Field(default=0, ge=0, description="Visits completed so far")
    is_completed: bool = Field(default=False, description="True if required visits reached")
    is_unreachable: bool = Field(default=False, description="True if planner cannot find path to target")
    unreachable_reason: str | None = Field(default=None, description="Diagnostic explanation for unreachability")


class RouteLeg(BaseModel):
    leg_index: int
    from_point: GridPoint
    to_point: GridPoint
    path: list[GridPoint] = Field(default_factory=list, description="Ordered path coordinates connecting endpoints")
    distance_m: float = 0.0
    task_id: str | None = None
    task_type: TaskType
    description: str = ""


class MissionConfig(BaseModel):
    fixed_checkpoint_order: bool = Field(default=False, description="Preserve explicit checkpoint ordering if True")
    required_checkpoints: list[str] = Field(default_factory=list, description="Checkpoint IDs to visit")
    required_patrol_coverage_pct: float = Field(default=100.0, ge=10.0, le=100.0, description="Coverage target % for patrol cells")
    extra_patrol_multiplier: int = Field(default=2, ge=2, le=5, description="Visit multiplier for extra-patrol zones")
    priority_weights: dict[str, float] = Field(
        default_factory=lambda: {"high": 3.0, "standard": 1.0, "low": 0.5},
        description="Weight multipliers for target sequencing"
    )
    enforce_return_to_dock: bool = Field(default=True, description="Always conclude mission at charging dock")


class MissionPlan(BaseModel):
    plan_id: str = Field(..., description="Unique plan identifier")
    algorithm_name: str = Field(default="A* + Priority-Weighted Mission Sequencer")
    is_feasible: bool = Field(..., description="True if safe and reaches all accessible required targets")
    waypoints: list[GridPoint] = Field(default_factory=list, description="Contiguous cell-by-cell path coordinates")
    legs: list[RouteLeg] = Field(default_factory=list, description="Structured mission legs")
    tasks: list[MissionTask] = Field(default_factory=list, description="All evaluated tasks and their states")
    total_distance_m: float = 0.0
    estimated_duration_s: float = 0.0
    estimated_battery_used_pct: float = 0.0
    estimated_final_battery_pct: float = 100.0
    planning_time_ms: float = 0.0
    coverage_percentage: float = 100.0
    dock_reachable: bool = True
    warnings: list[str] = Field(default_factory=list)
    unreachable_tasks: list[str] = Field(default_factory=list)
    created_at: str = ""
