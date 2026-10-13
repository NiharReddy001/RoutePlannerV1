"""Webots Integration Adapter Interface and Contract.

Defines language-neutral JSON data contracts, coordinate conversions, waypoint export formats,
and mock interfaces for bridging the route planner to future Webots controllers.
"""

from __future__ import annotations

import math
import time

from pydantic import BaseModel, Field

from ..models.map_data import MapData
from ..models.mission import MissionPlan


class WebotsWaypoint(BaseModel):
    index: int
    grid_x: int
    grid_y: int
    world_x_m: float
    world_y_m: float
    target_speed_m_s: float = 1.0
    action_at_waypoint: str | None = None


class WebotsRouteExport(BaseModel):
    contract_version: str = "1.0.0"
    plan_id: str
    map_id: str
    resolution_m_per_cell: float
    world_origin_offset: tuple[float, float] = (0.0, 0.0)
    total_waypoints: int
    total_distance_m: float
    waypoints: list[WebotsWaypoint]
    exported_at: str


class WebotsTelemetryUpdate(BaseModel):
    """Message sent from a Webots supervisor or robot controller back to the planner."""
    robot_id: str = "surveillance_robot_1"
    timestamp_s: float
    world_x_m: float
    world_y_m: float
    heading_rad: float
    current_waypoint_index: int
    battery_pct: float | None = None
    detected_obstacles: list[tuple[float, float]] = Field(default_factory=list)
    is_estop_active: bool = False


def grid_to_world(grid_x: int, grid_y: int, resolution: float, origin_offset: tuple[float, float] = (0.0, 0.0)) -> tuple[float, float]:
    """Convert grid cell coordinates (top-left origin, Y downwards) to continuous world coordinates (meters)."""
    wx = (grid_x + 0.5) * resolution + origin_offset[0]
    wy = (grid_y + 0.5) * resolution + origin_offset[1]
    return (round(wx, 4), round(wy, 4))


def world_to_grid(world_x: float, world_y: float, resolution: float, origin_offset: tuple[float, float] = (0.0, 0.0)) -> tuple[int, int]:
    """Convert continuous physical world meters to discrete grid indices."""
    gx = int(math.floor((world_x - origin_offset[0]) / resolution))
    gy = int(math.floor((world_y - origin_offset[1]) / resolution))
    return (gx, gy)


def export_route_for_webots(
    plan: MissionPlan,
    map_data: MapData,
    target_speed_m_s: float = 1.0,
    origin_offset: tuple[float, float] = (0.0, 0.0),
) -> WebotsRouteExport:
    """Serializes a MissionPlan into a standardized Webots-ready waypoint route message."""
    wb_waypoints: list[WebotsWaypoint] = []
    task_map: dict[tuple[int, int], str] = {}

    for t in plan.tasks:
        task_map[(t.target_position.x, t.target_position.y)] = f"{t.task_type.value}:{t.target_name}"

    for i, pt in enumerate(plan.waypoints):
        wx, wy = grid_to_world(pt.x, pt.y, map_data.resolution, origin_offset)
        action = task_map.get((pt.x, pt.y))
        wb_waypoints.append(
            WebotsWaypoint(
                index=i,
                grid_x=pt.x,
                grid_y=pt.y,
                world_x_m=wx,
                world_y_m=wy,
                target_speed_m_s=target_speed_m_s,
                action_at_waypoint=action,
            )
        )

    return WebotsRouteExport(
        contract_version="1.0.0",
        plan_id=plan.plan_id,
        map_id=map_data.id,
        resolution_m_per_cell=map_data.resolution,
        world_origin_offset=origin_offset,
        total_waypoints=len(wb_waypoints),
        total_distance_m=plan.total_distance_m,
        waypoints=wb_waypoints,
        exported_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


class MockWebotsAdapter:
    """Mock integration adapter for testing Webots communications without a live Webots runtime."""

    def __init__(self, map_data: MapData):
        self.map_data = map_data
        self.is_connected = False
        self.active_export: WebotsRouteExport | None = None
        self.last_telemetry: WebotsTelemetryUpdate | None = None

    def connect(self) -> bool:
        self.is_connected = True
        return True

    def disconnect(self) -> None:
        self.is_connected = False

    def send_mission_route(self, route: WebotsRouteExport) -> bool:
        if not self.is_connected:
            return False
        self.active_export = route
        return True

    def receive_telemetry(self) -> WebotsTelemetryUpdate | None:
        if not self.is_connected or not self.active_export or not self.active_export.waypoints:
            return None
        # Return mock first waypoint pose
        wp0 = self.active_export.waypoints[0]
        self.last_telemetry = WebotsTelemetryUpdate(
            robot_id="mock_robot_01",
            timestamp_s=time.time(),
            world_x_m=wp0.world_x_m,
            world_y_m=wp0.world_y_m,
            heading_rad=0.0,
            current_waypoint_index=0,
            battery_pct=98.5,
        )
        return self.last_telemetry
