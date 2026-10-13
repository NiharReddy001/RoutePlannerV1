"""Unit tests for data models and malformed map validation (Requirement 12)."""

import pytest
from app.models.coordinates import GridPoint
from app.models.map_data import MapData
from pydantic import ValidationError


def test_malformed_dimensions_rejected():
    """Dimensions smaller than 3 or larger than 250 raise validation error."""
    with pytest.raises(ValidationError):
        MapData(
            id="bad_map",
            name="Too Small",
            width=2,
            height=10,
            robot_start=GridPoint(x=1, y=1),
            charging_dock=GridPoint(x=0, y=0),
        )

    with pytest.raises(ValidationError):
        MapData(
            id="bad_map_huge",
            name="Too Big",
            width=300,
            height=10,
            robot_start=GridPoint(x=1, y=1),
            charging_dock=GridPoint(x=0, y=0),
        )


def test_out_of_bounds_endpoints_rejected():
    """MapData rejects robot_start or charging_dock positioned outside grid boundaries."""
    with pytest.raises(ValidationError):
        MapData(
            id="bad_start",
            name="Bad Start",
            width=5,
            height=5,
            robot_start=GridPoint(x=10, y=2),
            charging_dock=GridPoint(x=0, y=0),
        )

    with pytest.raises(ValidationError):
        MapData(
            id="bad_dock",
            name="Bad Dock",
            width=5,
            height=5,
            robot_start=GridPoint(x=1, y=1),
            charging_dock=GridPoint(x=-1, y=0),
        )


def test_invalid_resolution_rejected():
    """Resolution <= 0 is rejected."""
    with pytest.raises(ValidationError):
        MapData(
            id="bad_res",
            name="Bad Res",
            width=10,
            height=10,
            resolution=0.0,
            robot_start=GridPoint(x=1, y=1),
            charging_dock=GridPoint(x=0, y=0),
        )
