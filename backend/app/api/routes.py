"""FastAPI API route definitions for mapping, route planning, simulation, and Webots integration."""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, status

from ..adapters.webots_contract import WebotsRouteExport, export_route_for_webots
from ..models.coordinates import GridPoint
from ..models.map_data import MapData, Zone, ZoneType
from ..models.mission import MissionPlan
from ..models.robot_state import RobotConfig
from ..planner.astar import AStarPlanner, AStarResult
from ..planner.patrol_planner import MissionPlanner
from ..planner.validator import ValidationResult, validate_path
from ..services.sample_maps import get_default_sample_map
from ..services.storage import StorageService
from ..simulation.simulator import SimulationEngine, SimulationState
from .schemas import (
    BlockageRequest,
    HealthResponse,
    MissionPlanRequest,
    PointToPointRequest,
    SimulationInitRequest,
    SimulationSpeedRequest,
    SimulationStepRequest,
    ValidateRouteRequest,
    WebotsExportRequest,
)

router = APIRouter(prefix="/api")
storage_service = StorageService()

# Global in-memory simulation instance
_sim_engine: SimulationEngine | None = None


def get_or_create_sim(map_data: MapData | None = None, robot_config: RobotConfig | None = None) -> SimulationEngine:
    global _sim_engine
    if _sim_engine is None or map_data is not None:
        m = map_data or get_default_sample_map()
        cfg = robot_config or RobotConfig()
        _sim_engine = SimulationEngine(m, cfg)
    return _sim_engine


# --- HEALTH & STATUS ---
@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="1.0.0",
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


# --- MAP MANAGEMENT & PERSISTENCE ---
@router.get("/maps")
def list_maps() -> list[dict]:
    # Ensure default sample map is present in storage
    maps = storage_service.list_maps()
    if not maps:
        sample = get_default_sample_map()
        storage_service.save_map(sample)
        maps = storage_service.list_maps()
    return maps


@router.get("/maps/sample/default", response_model=MapData)
def get_sample_map() -> MapData:
    return get_default_sample_map()


@router.get("/maps/{map_id}", response_model=MapData)
def get_map(map_id: str) -> MapData:
    m = storage_service.load_map(map_id)
    if m is None:
        if map_id == "sample_facility_alpha":
            sample = get_default_sample_map()
            storage_service.save_map(sample)
            return sample
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Map '{map_id}' not found")
    return m


@router.post("/maps", response_model=MapData)
def save_map(map_data: MapData) -> MapData:
    try:
        storage_service.save_map(map_data)
        return map_data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to persist map: {e!s}")


@router.delete("/maps/{map_id}")
def delete_map(map_id: str) -> dict:
    deleted = storage_service.delete_map(map_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Map '{map_id}' not found")
    return {"success": True, "message": f"Map '{map_id}' deleted"}


@router.post("/maps/validate")
def validate_map_schema(map_data: MapData) -> dict:
    return {"is_valid": True, "message": "Map data structure and bounds are valid"}


@router.post("/maps/import", response_model=MapData)
def import_map(map_data: MapData) -> MapData:
    storage_service.save_map(map_data)
    return map_data


@router.get("/maps/{map_id}/export")
def export_map(map_id: str) -> dict:
    m = storage_service.load_map(map_id)
    if m is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Map '{map_id}' not found")
    return m.model_dump()


# --- PLANNING ENDPOINTS ---
@router.post("/plan/point-to-point", response_model=AStarResult)
def plan_point_to_point(req: PointToPointRequest) -> AStarResult:
    planner = AStarPlanner(
        map_data=req.map_data,
        allow_diagonal=req.allow_diagonal,
        clearance_cells=req.clearance_cells,
        include_temporary_blockages=req.include_temporary_blockages,
    )
    return planner.plan(req.start, req.goal)


@router.post("/plan/mission", response_model=MissionPlan)
def plan_mission(req: MissionPlanRequest) -> MissionPlan:
    cfg = req.robot_config or RobotConfig()
    planner = MissionPlanner(
        map_data=req.map_data,
        robot_config=cfg,
        mission_config=req.mission_config,
        allow_diagonal=req.allow_diagonal,
        clearance_cells=req.clearance_cells,
        include_temporary_blockages=req.include_temporary_blockages,
    )
    plan = planner.plan_mission(
        current_robot_position=req.current_robot_position,
        current_battery_pct=req.current_battery_pct,
        completed_task_counts=req.completed_task_counts,
    )
    # Automatically register plan with simulation engine
    sim = get_or_create_sim(req.map_data, cfg)
    sim.load_plan(plan, reset_state=(req.current_robot_position is None))
    return plan


@router.post("/plan/validate", response_model=ValidationResult)
def validate_route(req: ValidateRouteRequest) -> ValidationResult:
    return validate_path(
        path=req.path,
        map_data=req.map_data,
        expected_start=req.expected_start,
        expected_goal=req.expected_goal,
        allow_diagonal=req.allow_diagonal,
        include_temporary_blockages=req.include_temporary_blockages,
    )


# --- SIMULATION CONTROL ENDPOINTS ---
@router.post("/simulation/init", response_model=SimulationState)
def init_simulation(req: SimulationInitRequest) -> SimulationState:
    cfg = req.robot_config or RobotConfig()
    sim = get_or_create_sim(req.map_data, cfg)
    if req.plan:
        sim.load_plan(req.plan, reset_state=True)
    else:
        sim.reset()
    return sim.get_state()


@router.get("/simulation/state", response_model=SimulationState)
def get_simulation_state() -> SimulationState:
    sim = get_or_create_sim()
    return sim.get_state()


@router.post("/simulation/start", response_model=SimulationState)
def start_simulation() -> SimulationState:
    sim = get_or_create_sim()
    sim.start()
    return sim.get_state()


@router.post("/simulation/pause", response_model=SimulationState)
def pause_simulation() -> SimulationState:
    sim = get_or_create_sim()
    sim.pause()
    return sim.get_state()


@router.post("/simulation/resume", response_model=SimulationState)
def resume_simulation() -> SimulationState:
    sim = get_or_create_sim()
    sim.resume()
    return sim.get_state()


@router.post("/simulation/stop", response_model=SimulationState)
def stop_simulation() -> SimulationState:
    sim = get_or_create_sim()
    sim.stop()
    return sim.get_state()


@router.post("/simulation/reset", response_model=SimulationState)
def reset_simulation() -> SimulationState:
    sim = get_or_create_sim()
    sim.reset()
    return sim.get_state()


@router.post("/simulation/step", response_model=SimulationState)
def step_simulation(req: SimulationStepRequest) -> SimulationState:
    sim = get_or_create_sim()
    sim.step(steps_to_advance=req.steps)
    return sim.get_state()


@router.post("/simulation/speed", response_model=SimulationState)
def set_simulation_speed(req: SimulationSpeedRequest) -> SimulationState:
    sim = get_or_create_sim()
    sim.simulation_speed = req.speed_multiplier
    return sim.get_state()


@router.post("/simulation/blockages/add", response_model=SimulationState)
def add_temporary_blockage(req: BlockageRequest) -> SimulationState:
    sim = get_or_create_sim()
    pt = GridPoint(x=req.x, y=req.y)
    # Check if blockage already exists at this coordinate
    existing = [z for z in sim.map_data.zones if z.type == ZoneType.TEMPORARY_BLOCKAGE and any(c.x == pt.x and c.y == pt.y for c in z.cells)]
    if not existing:
        zone_id = f"blockage_{req.x}_{req.y}"
        z = Zone(
            id=zone_id,
            name=req.name or f"Blockage at ({req.x}, {req.y})",
            type=ZoneType.TEMPORARY_BLOCKAGE,
            cells=[pt],
            priority=0,
            required_visits=0,
            color="#ec4899",
        )
        sim.map_data.zones.append(z)
        sim._log_event("BLOCKAGE_ADDED", f"Temporary blockage placed at ({req.x}, {req.y})")
    return sim.get_state()


@router.post("/simulation/blockages/remove", response_model=SimulationState)
def remove_temporary_blockage(req: BlockageRequest) -> SimulationState:
    sim = get_or_create_sim()
    pt = (req.x, req.y)
    sim.map_data.zones = [
        z for z in sim.map_data.zones
        if not (z.type == ZoneType.TEMPORARY_BLOCKAGE and any(c.x == pt[0] and c.y == pt[1] for c in z.cells))
    ]
    sim._log_event("BLOCKAGE_REMOVED", f"Temporary blockage cleared at ({req.x}, {req.y})")
    return sim.get_state()


@router.post("/simulation/replan", response_model=MissionPlan)
def replan_simulation() -> MissionPlan:
    sim = get_or_create_sim()
    planner = MissionPlanner(sim.map_data, robot_config=sim.robot_config)
    return sim.replan_from_current_state(planner)


# --- WEBOTS INTEGRATION ---
@router.post("/adapters/webots/export", response_model=WebotsRouteExport)
def export_webots(req: WebotsExportRequest) -> WebotsRouteExport:
    return export_route_for_webots(
        plan=req.plan,
        map_data=req.map_data,
        target_speed_m_s=req.target_speed_m_s,
    )
