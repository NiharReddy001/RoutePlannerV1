"""Robot configuration, pose, and telemetry models."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from .coordinates import GridPoint


class RobotStatus(str, Enum):
    IDLE = "idle"
    NAVIGATING = "navigating"
    PATROLLING = "patrolling"
    RETURNING_TO_DOCK = "returning_to_dock"
    DOCKED = "docked"
    PAUSED = "paused"
    OUT_OF_BATTERY = "out_of_battery"
    BLOCKED = "blocked"


class RobotConfig(BaseModel):
    battery_capacity_pct: float = Field(default=100.0, ge=10.0, le=100.0, description="Max battery capacity in %")
    consumption_per_meter: float = Field(default=0.5, gt=0.0, le=10.0, description="Estimated battery % consumed per meter")
    safety_reserve_pct: float = Field(default=15.0, ge=0.0, le=50.0, description="Minimum battery safety reserve %")
    speed_m_s: float = Field(default=1.0, gt=0.1, le=10.0, description="Simulated robot linear speed in m/s")
    charging_rate_pct_s: float = Field(default=5.0, gt=0.1, le=50.0, description="Recharge rate % per second while docked")
    clearance_cells: int = Field(default=0, ge=0, le=5, description="Clearance margin / obstacle inflation radius in cells")
    allow_diagonal: bool = Field(default=False, description="Enable 8-directional movement with corner-cutting safety")


class RobotPose(BaseModel):
    position: GridPoint = Field(..., description="Current grid location")
    heading_deg: float = Field(default=0.0, description="Orientation angle in degrees (0=East, 90=South, 180=West, 270=North)")


class RobotTelemetry(BaseModel):
    pose: RobotPose
    battery_pct: float = Field(default=100.0, ge=0.0, le=100.0)
    status: RobotStatus = Field(default=RobotStatus.IDLE)
    is_charging: bool = False
    is_docked: bool = False
    distance_traveled_m: float = 0.0
    current_step_index: int = 0
    total_steps: int = 0
