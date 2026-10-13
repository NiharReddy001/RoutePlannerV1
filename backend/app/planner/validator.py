"""Independent path and route validation routine.

Validates that generated routes strictly respect grid boundaries, traversability,
transition legality, collision safety, and expected endpoints.
"""

from __future__ import annotations

import math

from pydantic import BaseModel, Field

from ..models.coordinates import GridPoint
from ..models.map_data import MapData


class ValidationResult(BaseModel):
    is_valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    total_steps: int = 0
    total_distance_m: float = 0.0


def validate_path(
    path: list[GridPoint],
    map_data: MapData,
    expected_start: GridPoint | None = None,
    expected_goal: GridPoint | None = None,
    allow_diagonal: bool = False,
    include_temporary_blockages: bool = True,
) -> ValidationResult:
    """Independently verifies a proposed path against all spatial and physical constraints."""
    errors: list[str] = []
    warnings: list[str] = []

    if not path:
        return ValidationResult(
            is_valid=False,
            errors=["Path is empty."],
            total_steps=0,
            total_distance_m=0.0,
        )

    # 1. Start coordinate check
    if expected_start is not None:
        if path[0].x != expected_start.x or path[0].y != expected_start.y:
            errors.append(
                f"Path start ({path[0].x}, {path[0].y}) does not match expected start ({expected_start.x}, {expected_start.y})"
            )

    # 2. Goal coordinate check
    if expected_goal is not None:
        if path[-1].x != expected_goal.x or path[-1].y != expected_goal.y:
            errors.append(
                f"Path end ({path[-1].x}, {path[-1].y}) does not match expected goal ({expected_goal.x}, {expected_goal.y})"
            )

    walls = map_data.get_wall_set()
    restricted = map_data.get_restricted_cells()
    blockages = map_data.get_temporary_blockages() if include_temporary_blockages else set()

    total_dist = 0.0

    # 3. Step-by-step point validation
    for i, pt in enumerate(path):
        x, y = pt.x, pt.y

        # Bounds
        if not map_data.is_in_bounds(x, y):
            errors.append(f"Step {i}: point ({x}, {y}) is outside map boundaries [0..{map_data.width-1}, 0..{map_data.height-1}]")
            continue

        # Obstacles
        if (x, y) in walls:
            errors.append(f"Step {i}: point ({x}, {y}) collides with a physical wall/obstacle")

        # Restricted
        if (x, y) in restricted:
            errors.append(f"Step {i}: point ({x}, {y}) enters a restricted no-go zone")

        # Temporary Blockages
        if (x, y) in blockages:
            errors.append(f"Step {i}: point ({x}, {y}) is blocked by an active temporary obstruction")

        # 4. Transition legality check
        if i > 0:
            prev = path[i - 1]
            dx = abs(x - prev.x)
            dy = abs(y - prev.y)

            if dx == 0 and dy == 0:
                warnings.append(f"Step {i}: duplicate redundant step at ({x}, {y})")
                continue

            if dx > 1 or dy > 1:
                errors.append(
                    f"Step {i}: illegal teleport transition from ({prev.x}, {prev.y}) to ({x}, {y}) (dx={dx}, dy={dy})"
                )
                continue

            if dx == 1 and dy == 1:
                if not allow_diagonal:
                    errors.append(
                        f"Step {i}: diagonal movement from ({prev.x}, {prev.y}) to ({x}, {y}) is forbidden by configuration"
                    )
                else:
                    # Diagonal corner-cutting check
                    adj1 = (prev.x + (x - prev.x), prev.y)
                    adj2 = (prev.x, prev.y + (y - prev.y))
                    if (adj1 in walls or adj1 in restricted or (include_temporary_blockages and adj1 in blockages)) or \
                       (adj2 in walls or adj2 in restricted or (include_temporary_blockages and adj2 in blockages)):
                        errors.append(
                            f"Step {i}: diagonal move from ({prev.x}, {prev.y}) to ({x}, {y}) cuts through an obstacle corner"
                        )
                step_dist = math.sqrt(2.0) * map_data.resolution
            else:
                step_dist = map_data.resolution

            total_dist += step_dist

    is_valid = len(errors) == 0
    return ValidationResult(
        is_valid=is_valid,
        errors=errors,
        warnings=warnings,
        total_steps=len(path),
        total_distance_m=round(total_dist, 3),
    )
