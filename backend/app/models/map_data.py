"""Map and Zone data models for grid navigation and patrol missions."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

from .coordinates import GridPoint


class ZoneType(str, Enum):
    RESTRICTED = "restricted"
    STANDARD_PATROL = "standard_patrol"
    EXTRA_PATROL = "extra_patrol"
    HIGH_PRIORITY_INSPECTION = "high_priority_inspection"
    LOW_PRIORITY = "low_priority"
    ONE_TIME_INSPECTION = "one_time_inspection"
    TEMPORARY_BLOCKAGE = "temporary_blockage"


class Zone(BaseModel):
    id: str = Field(..., description="Unique zone identifier")
    name: str = Field(..., description="Human-readable zone label")
    type: ZoneType = Field(..., description="Zone behavioral classification")
    cells: list[GridPoint] = Field(default_factory=list, description="List of grid points in this zone")
    priority: int = Field(default=1, ge=0, le=10, description="Relative priority score (higher = earlier)")
    required_visits: int = Field(default=1, ge=0, le=10, description="Required visits (e.g. for extra patrol)")
    color: str | None = Field(default=None, description="Display color hex code")

    def cell_set(self) -> set[tuple[int, int]]:
        return {(p.x, p.y) for p in self.cells}


class Checkpoint(BaseModel):
    id: str = Field(..., description="Unique checkpoint identifier")
    name: str = Field(..., description="Human-readable checkpoint label")
    position: GridPoint = Field(..., description="Grid coordinate")
    order: int | None = Field(default=None, ge=0, description="Explicit visit sequence order if constrained")
    mandatory: bool = Field(default=True, description="Whether this checkpoint is strictly required")


class UnderlayImage(BaseModel):
    filename: str | None = None
    data_url: str | None = None
    opacity: float = Field(default=0.5, ge=0.0, le=1.0)
    scale: float = Field(default=1.0, gt=0.0)
    offset_x: float = 0.0
    offset_y: float = 0.0


class MapData(BaseModel):
    id: str = Field(..., description="Unique map identifier")
    name: str = Field(..., description="Map display name")
    schema_version: str = Field(default="1.0.0", description="Data contract schema version")
    width: int = Field(..., ge=3, le=250, description="Grid width in cells")
    height: int = Field(..., ge=3, le=250, description="Grid height in cells")
    resolution: float = Field(default=0.5, gt=0.0, le=10.0, description="Cell side dimension in meters")
    walls: list[GridPoint] = Field(default_factory=list, description="List of physical obstacle cells")
    zones: list[Zone] = Field(default_factory=list, description="Defined zone overlays")
    robot_start: GridPoint = Field(..., description="Initial robot start location")
    charging_dock: GridPoint = Field(..., description="Charging dock location")
    checkpoints: list[Checkpoint] = Field(default_factory=list, description="Mission checkpoints")
    underlay: UnderlayImage | None = None

    @field_validator("width", "height")
    @classmethod
    def validate_dimensions(cls, v: int) -> int:
        if v < 3:
            raise ValueError("Map dimension must be at least 3x3 cells")
        if v > 250:
            raise ValueError("Map dimension exceeds maximum supported limit of 250")
        return v

    @model_validator(mode="after")
    def validate_point_bounds(self) -> MapData:
        if not self.is_in_bounds(self.robot_start.x, self.robot_start.y):
            raise ValueError(f"robot_start ({self.robot_start.x}, {self.robot_start.y}) is outside map bounds [0..{self.width-1}, 0..{self.height-1}]")
        if not self.is_in_bounds(self.charging_dock.x, self.charging_dock.y):
            raise ValueError(f"charging_dock ({self.charging_dock.x}, {self.charging_dock.y}) is outside map bounds [0..{self.width-1}, 0..{self.height-1}]")
        return self

    def is_in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def get_wall_set(self) -> set[tuple[int, int]]:
        return {(p.x, p.y) for p in self.walls}

    def get_restricted_cells(self) -> set[tuple[int, int]]:
        restricted: set[tuple[int, int]] = set()
        for z in self.zones:
            if z.type == ZoneType.RESTRICTED:
                restricted.update(z.cell_set())
        return restricted

    def get_temporary_blockages(self) -> set[tuple[int, int]]:
        blockages: set[tuple[int, int]] = set()
        for z in self.zones:
            if z.type == ZoneType.TEMPORARY_BLOCKAGE:
                blockages.update(z.cell_set())
        return blockages

    def is_traversable(self, x: int, y: int, include_temporary_blockages: bool = True) -> bool:
        if not self.is_in_bounds(x, y):
            return False
        pt = (x, y)
        if pt in self.get_wall_set():
            return False
        if pt in self.get_restricted_cells():
            return False
        if include_temporary_blockages and pt in self.get_temporary_blockages():
            return False
        return True
