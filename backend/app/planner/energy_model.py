"""Configurable battery and energy consumption feasibility model."""

from __future__ import annotations

from typing import NamedTuple

from ..models.robot_state import RobotConfig


class EnergyEvaluation(NamedTuple):
    is_feasible: bool
    mission_energy_pct: float
    return_energy_pct: float
    total_energy_pct: float
    final_battery_pct: float
    warning: str | None


class EnergyModel:
    """Calculates linear distance battery consumption, return-to-dock reserves, and recharge rates."""

    @staticmethod
    def calculate_travel_energy_pct(distance_m: float, config: RobotConfig) -> float:
        """Linear energy consumption model: distance (m) * consumption_rate (%/m)."""
        return max(0.0, distance_m * config.consumption_per_meter)

    @staticmethod
    def evaluate_mission_energy(
        current_battery_pct: float,
        mission_distance_m: float,
        return_to_dock_distance_m: float,
        config: RobotConfig,
    ) -> EnergyEvaluation:
        """Evaluates whether the robot can complete the proposed mission tasks and return to dock

        without violating the safety reserve threshold.
        """
        mission_energy = EnergyModel.calculate_travel_energy_pct(mission_distance_m, config)
        return_energy = EnergyModel.calculate_travel_energy_pct(return_to_dock_distance_m, config)
        total_energy = mission_energy + return_energy
        final_battery = current_battery_pct - total_energy

        warning: str | None = None
        is_feasible = True

        if final_battery < 0.0:
            is_feasible = False
            warning = (
                f"Battery depletion risk: Mission requires {total_energy:.1f}% battery, "
                f"but only {current_battery_pct:.1f}% is available. Robot would run out before returning to dock."
            )
        elif final_battery < config.safety_reserve_pct:
            is_feasible = False
            warning = (
                f"Safety reserve violated: Estimated final battery {final_battery:.1f}% "
                f"is below required reserve margin {config.safety_reserve_pct:.1f}%."
            )

        return EnergyEvaluation(
            is_feasible=is_feasible,
            mission_energy_pct=round(mission_energy, 2),
            return_energy_pct=round(return_energy, 2),
            total_energy_pct=round(total_energy, 2),
            final_battery_pct=round(final_battery, 2),
            warning=warning,
        )

    @staticmethod
    def charge_step(current_battery_pct: float, delta_seconds: float, config: RobotConfig) -> float:
        """Simulate battery recharge during docked idle state."""
        recharge_amount = delta_seconds * config.charging_rate_pct_s
        return min(config.battery_capacity_pct, current_battery_pct + recharge_amount)
