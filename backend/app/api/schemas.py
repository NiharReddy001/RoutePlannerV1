"""Typed request and response schemas for FastAPI endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..models.coordinates import GridPoint
from ..models.map_data import MapData
from ..models.mission import MissionConfig, MissionPlan
from ..models.robot_state import RobotConfig


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: str


class PointToPointRequest(BaseModel):
    map_data: MapData
    start: GridPoint
    goal: GridPoint
    allow_diagonal: bool = False
    clearance_cells: int = 0
    include_temporary_blockages: bool = True


class MissionPlanRequest(BaseModel):
    map_data: MapData
    robot_config: RobotConfig | None = None
    mission_config: MissionConfig | None = None
    allow_diagonal: bool = False
    clearance_cells: int = 0
    include_temporary_blockages: bool = True
    current_battery_pct: float = 100.0
    current_robot_position: GridPoint | None = None
    completed_task_counts: dict[str, int] | None = None


class ValidateRouteRequest(BaseModel):
    map_data: MapData
    path: list[GridPoint]
    expected_start: GridPoint | None = None
    expected_goal: GridPoint | None = None
    allow_diagonal: bool = False
    include_temporary_blockages: bool = True


class SimulationInitRequest(BaseModel):
    map_data: MapData
    robot_config: RobotConfig | None = None
    plan: MissionPlan | None = None


class SimulationStepRequest(BaseModel):
    steps: int = Field(default=1, ge=1, le=50)


class SimulationSpeedRequest(BaseModel):
    speed_multiplier: float = Field(default=1.0, ge=0.2, le=10.0)


class BlockageRequest(BaseModel):
    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)
    name: str | None = "Temporary Blockage"


class WebotsExportRequest(BaseModel):
    map_data: MapData
    plan: MissionPlan
    target_speed_m_s: float = 1.0
