"""Coordinate and basic geometry models for grid navigation."""

from __future__ import annotations

from typing import NamedTuple

from pydantic import BaseModel, Field


class GridPoint(BaseModel):
    """Grid coordinate where x is horizontal and y is vertical."""
    x: int = Field(..., description="Horizontal grid coordinate, 0-indexed from left")
    y: int = Field(..., description="Vertical grid coordinate, 0-indexed from top")

    def to_tuple(self) -> tuple[int, int]:
        return (self.x, self.y)

    @classmethod
    def from_tuple(cls, t: tuple[int, int]) -> GridPoint:
        return cls(x=t[0], y=t[1])

    def manhattan_distance(self, other: GridPoint) -> int:
        return abs(self.x - other.x) + abs(self.y - other.y)

    def chebyshev_distance(self, other: GridPoint) -> int:
        return max(abs(self.x - other.x), abs(self.y - other.y))

    def euclidean_distance(self, other: GridPoint) -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

    def __hash__(self) -> int:
        return hash((self.x, self.y))

    def __eq__(self, other: object) -> bool:
        if isinstance(other, GridPoint):
            return self.x == other.x and self.y == other.y
        if isinstance(other, (tuple, list)) and len(other) == 2:
            return self.x == other[0] and self.y == other[1]
        return False


class Point2D(NamedTuple):
    x: int
    y: int
