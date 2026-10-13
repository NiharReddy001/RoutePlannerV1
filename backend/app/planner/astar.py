"""A* grid pathfinding algorithm with 4-way/8-way movement, corner-cutting safety, and diagnostics."""

from __future__ import annotations

import heapq
import math
import time

from pydantic import BaseModel, Field

from ..models.coordinates import GridPoint
from ..models.map_data import MapData


class AStarResult(BaseModel):
    success: bool
    path: list[GridPoint] = Field(default_factory=list)
    cost: float = 0.0
    nodes_expanded: int = 0
    planning_time_ms: float = 0.0
    error_message: str | None = None


class AStarPlanner:
    """Deterministic A* pathfinder for 2D grid maps."""

    SQRT2 = math.sqrt(2.0)
    ORTHOGONAL_DIRECTIONS: list[tuple[int, int, float]] = [
        (0, -1, 1.0),  # North
        (0, 1, 1.0),   # South
        (-1, 0, 1.0),  # West
        (1, 0, 1.0),   # East
    ]
    DIAGONAL_DIRECTIONS: list[tuple[int, int, float]] = [
        (-1, -1, SQRT2),  # North-West
        (1, -1, SQRT2),   # North-East
        (-1, 1, SQRT2),   # South-West
        (1, 1, SQRT2),    # South-East
    ]

    def __init__(
        self,
        map_data: MapData,
        allow_diagonal: bool = False,
        clearance_cells: int = 0,
        include_temporary_blockages: bool = True,
    ):
        self.map_data = map_data
        self.allow_diagonal = allow_diagonal
        self.clearance_cells = clearance_cells
        self.include_temporary_blockages = include_temporary_blockages
        self._blocked_cells = self._compute_blocked_cells()

    def _compute_blocked_cells(self) -> set[tuple[int, int]]:
        """Precompute set of untraversable grid cells including clearance inflation."""
        base_blocked: set[tuple[int, int]] = set()
        base_blocked.update(self.map_data.get_wall_set())
        base_blocked.update(self.map_data.get_restricted_cells())
        if self.include_temporary_blockages:
            base_blocked.update(self.map_data.get_temporary_blockages())

        if self.clearance_cells <= 0:
            return base_blocked

        # Inflate obstacles by clearance_cells radius (Chebyshev disk)
        inflated: set[tuple[int, int]] = set(base_blocked)
        for (bx, by) in base_blocked:
            for dx in range(-self.clearance_cells, self.clearance_cells + 1):
                for dy in range(-self.clearance_cells, self.clearance_cells + 1):
                    nx, ny = bx + dx, by + dy
                    if self.map_data.is_in_bounds(nx, ny):
                        inflated.add((nx, ny))
        return inflated

    def is_cell_passable(self, x: int, y: int) -> bool:
        if not self.map_data.is_in_bounds(x, y):
            return False
        return (x, y) not in self._blocked_cells

    def _heuristic(self, x1: int, y1: int, x2: int, y2: int) -> float:
        dx = abs(x1 - x2)
        dy = abs(y1 - y2)
        if self.allow_diagonal:
            # Octile distance
            return (dx + dy) + (self.SQRT2 - 2.0) * min(dx, dy)
        # Manhattan distance
        return float(dx + dy)

    def plan(self, start: GridPoint, goal: GridPoint) -> AStarResult:
        start_time = time.perf_counter()
        sx, sy = start.x, start.y
        gx, gy = goal.x, goal.y

        # 1. Bounds checks
        if not self.map_data.is_in_bounds(sx, sy):
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Start point ({sx}, {sy}) is out of bounds [0..{self.map_data.width-1}, 0..{self.map_data.height-1}]",
                planning_time_ms=elapsed,
            )
        if not self.map_data.is_in_bounds(gx, gy):
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Goal point ({gx}, {gy}) is out of bounds [0..{self.map_data.width-1}, 0..{self.map_data.height-1}]",
                planning_time_ms=elapsed,
            )

        # 2. Blocked endpoint checks
        # Note: If start or goal itself was blocked by clearance only, allow if it's not base-blocked
        base_walls = self.map_data.get_wall_set()
        base_restricted = self.map_data.get_restricted_cells()
        base_blockages = self.map_data.get_temporary_blockages() if self.include_temporary_blockages else set()

        if (sx, sy) in base_walls:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Start point ({sx}, {sy}) is inside a wall/obstacle",
                planning_time_ms=elapsed,
            )
        if (sx, sy) in base_restricted:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Start point ({sx}, {sy}) is inside a restricted no-go zone",
                planning_time_ms=elapsed,
            )
        if (sx, sy) in base_blockages:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Start point ({sx}, {sy}) is blocked by a temporary obstruction",
                planning_time_ms=elapsed,
            )

        if (gx, gy) in base_walls:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Goal point ({gx}, {gy}) is inside a wall/obstacle",
                planning_time_ms=elapsed,
            )
        if (gx, gy) in base_restricted:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Goal point ({gx}, {gy}) is inside a restricted no-go zone",
                planning_time_ms=elapsed,
            )
        if (gx, gy) in base_blockages:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=False,
                error_message=f"Goal point ({gx}, {gy}) is blocked by a temporary obstruction",
                planning_time_ms=elapsed,
            )

        # 3. Start == Goal check
        if sx == gx and sy == gy:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return AStarResult(
                success=True,
                path=[start],
                cost=0.0,
                nodes_expanded=0,
                planning_time_ms=elapsed,
            )

        # 4. A* Search
        # Priority queue item: (f_score, counter, (x, y))
        counter = 0
        start_pt = (sx, sy)
        goal_pt = (gx, gy)

        open_heap: list[tuple[float, int, tuple[int, int]]] = []
        heapq.heappush(open_heap, (self._heuristic(sx, sy, gx, gy), counter, start_pt))

        came_from: dict[tuple[int, int], tuple[int, int]] = {}
        g_score: dict[tuple[int, int], float] = {start_pt: 0.0}
        closed_set: set[tuple[int, int]] = set()

        nodes_expanded = 0

        while open_heap:
            _, _, current = heapq.heappop(open_heap)
            if current in closed_set:
                continue

            closed_set.add(current)
            nodes_expanded += 1

            if current == goal_pt:
                # Reconstruct path
                path_tuples: list[tuple[int, int]] = [goal_pt]
                curr_node = goal_pt
                while curr_node in came_from:
                    curr_node = came_from[curr_node]
                    path_tuples.append(curr_node)
                path_tuples.reverse()

                path_points = [GridPoint(x=p[0], y=p[1]) for p in path_tuples]
                elapsed = (time.perf_counter() - start_time) * 1000.0
                return AStarResult(
                    success=True,
                    path=path_points,
                    cost=g_score[goal_pt],
                    nodes_expanded=nodes_expanded,
                    planning_time_ms=elapsed,
                )

            cx, cy = current
            # Check neighbors
            neighbors = list(self.ORTHOGONAL_DIRECTIONS)
            if self.allow_diagonal:
                neighbors.extend(self.DIAGONAL_DIRECTIONS)

            for dx, dy, step_cost in neighbors:
                nx, ny = cx + dx, cy + dy
                neighbor = (nx, ny)

                if neighbor in closed_set:
                    continue

                if not self.is_cell_passable(nx, ny):
                    # Special allowance if neighbor is goal or start (e.g. within clearance margin)
                    if neighbor != goal_pt:
                        continue

                # Diagonal corner-cutting check:
                # When moving diagonally (abs(dx)==1 and abs(dy)==1), both adjacent orthogonal
                # cells (cx + dx, cy) and (cx, cy + dy) must be traversable!
                if abs(dx) == 1 and abs(dy) == 1:
                    adj1 = (cx + dx, cy)
                    adj2 = (cx, cy + dy)
                    if not self.is_cell_passable(adj1[0], adj1[1]) or not self.is_cell_passable(adj2[0], adj2[1]):
                        # Corner cutting prevented
                        continue

                tentative_g = g_score[current] + step_cost
                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f = tentative_g + self._heuristic(nx, ny, gx, gy)
                    counter += 1
                    heapq.heappush(open_heap, (f, counter, neighbor))

        elapsed = (time.perf_counter() - start_time) * 1000.0
        return AStarResult(
            success=False,
            error_message=f"Goal ({gx}, {gy}) is unreachable from ({sx}, {sy}) (no open path around obstacles)",
            nodes_expanded=nodes_expanded,
            planning_time_ms=elapsed,
        )
