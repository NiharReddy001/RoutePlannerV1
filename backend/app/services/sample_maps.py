"""Standard demonstration sample maps for autonomous patrol evaluation."""

from __future__ import annotations

from ..models.coordinates import GridPoint
from ..models.map_data import Checkpoint, MapData, Zone, ZoneType


def get_default_sample_map() -> MapData:
    """Generates 'MDP Facility Alpha' - a comprehensive demonstration map featuring corridors,

    partition walls, multi-type patrol zones, checkpoints, and obstacle bypass scenarios.
    Grid Size: 24 wide x 18 high (resolution: 0.5m/cell = 12m x 9m facility).
    """
    width = 24
    height = 18

    # Build perimeter walls
    walls: list[GridPoint] = []
    for x in range(width):
        walls.append(GridPoint(x=x, y=0))
        walls.append(GridPoint(x=x, y=height - 1))
    for y in range(1, height - 1):
        walls.append(GridPoint(x=0, y=y))
        walls.append(GridPoint(x=width - 1, y=y))

    # Internal partition 1: Central vertical divider with a north opening and a south opening
    # Wall from y=4 to y=13 at x=10, with doorway at y=8..9
    for y in range(4, 8):
        walls.append(GridPoint(x=10, y=y))
    for y in range(10, 14):
        walls.append(GridPoint(x=10, y=y))

    # Internal partition 2: Horizontal office partition in West quadrant (y=7, x=1..6 with doorway at x=4)
    for x in [1, 2, 3, 5, 6]:
        walls.append(GridPoint(x=x, y=7))

    # Internal partition 3: Server room enclosure in East quadrant (x=16..22, y=6..11)
    # Server room walls at y=6 (x=16..22), y=11 (x=16..22), x=16 (y=6..11, door at y=8)
    for x in range(16, 23):
        walls.append(GridPoint(x=x, y=6))
        walls.append(GridPoint(x=x, y=11))
    for y in [7, 9, 10]:
        walls.append(GridPoint(x=16, y=y))

    # Robot start and dock
    dock = GridPoint(x=2, y=2)
    start = GridPoint(x=2, y=3)

    # Checkpoints
    checkpoints = [
        Checkpoint(id="cp1", name="West Wing Gate", position=GridPoint(x=4, y=4), order=1, mandatory=True),
        Checkpoint(id="cp2", name="Central Corridor Waypoint", position=GridPoint(x=10, y=9), order=2, mandatory=True),
        Checkpoint(id="cp3", name="East Wing Depot", position=GridPoint(x=20, y=14), order=3, mandatory=True),
    ]

    # Zones
    zones = [
        # Standard Patrol Zone: West Lobby (x=2..5, y=12..15)
        Zone(
            id="zone_standard_lobby",
            name="West Lobby Patrol",
            type=ZoneType.STANDARD_PATROL,
            cells=[GridPoint(x=x, y=y) for x in range(2, 6) for y in range(12, 16)],
            priority=2,
            required_visits=1,
            color="#3b82f6",
        ),
        # High-Priority Inspection: Server Room interior (x=18..21, y=8..9)
        Zone(
            id="zone_server_room",
            name="Critical Server Room",
            type=ZoneType.HIGH_PRIORITY_INSPECTION,
            cells=[GridPoint(x=x, y=y) for x in range(18, 22) for y in range(8, 10)],
            priority=8,
            required_visits=1,
            color="#ef4444",
        ),
        # Extra Patrol: South Perimeter Corridor (x=12..16, y=14..16)
        Zone(
            id="zone_extra_south",
            name="South Perimeter Extra Patrol",
            type=ZoneType.EXTRA_PATROL,
            cells=[GridPoint(x=x, y=y) for x in range(12, 17) for y in range(14, 17)],
            priority=5,
            required_visits=2,
            color="#8b5cf6",
        ),
        # One-time Inspection: Water Valve (x=8, y=2)
        Zone(
            id="zone_valve_inspection",
            name="Main Ventilation Valve",
            type=ZoneType.ONE_TIME_INSPECTION,
            cells=[GridPoint(x=8, y=2)],
            priority=6,
            required_visits=1,
            color="#eab308",
        ),
        # Restricted No-Go Zone: High Voltage Room (x=13..15, y=2..4)
        Zone(
            id="zone_high_voltage",
            name="Restricted High Voltage Area",
            type=ZoneType.RESTRICTED,
            cells=[GridPoint(x=x, y=y) for x in range(13, 16) for y in range(2, 5)],
            priority=0,
            required_visits=0,
            color="#f97316",
        ),
        # Temporary Blockage: Maintenance Spill in corridor (x=10, y=8)
        Zone(
            id="zone_temporary_spill",
            name="Maintenance Spill (Temporary Blockage)",
            type=ZoneType.TEMPORARY_BLOCKAGE,
            cells=[GridPoint(x=10, y=8)],
            priority=0,
            required_visits=0,
            color="#ec4899",
        ),
    ]

    return MapData(
        id="sample_facility_alpha",
        name="MDP Facility Alpha",
        schema_version="1.0.0",
        width=width,
        height=height,
        resolution=0.5,
        walls=walls,
        zones=zones,
        robot_start=start,
        charging_dock=dock,
        checkpoints=checkpoints,
    )
