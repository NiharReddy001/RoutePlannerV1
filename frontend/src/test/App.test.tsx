import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Header } from '../components/Header';
import { Toolbar } from '../components/Toolbar';
import { RobotPanel } from '../components/RobotPanel';
import { MissionPanel } from '../components/MissionPanel';
import { RouteStats } from '../components/RouteStats';
import { NewMapModal } from '../components/Modals';
import { ZoneLegend } from '../components/ZoneLegend';
import type { MapData, RobotConfig, MissionConfig, MissionPlan } from '../types';

const mockMap: MapData = {
  id: 'test_grid',
  name: 'Facility Test',
  schema_version: '1.0.0',
  width: 20,
  height: 15,
  resolution: 0.5,
  walls: [{ x: 5, y: 5 }],
  zones: [
    {
      id: 'z1',
      name: 'Server Area',
      type: 'high_priority_inspection',
      cells: [{ x: 2, y: 2 }],
      priority: 8,
      required_visits: 1,
    },
  ],
  robot_start: { x: 1, y: 1 },
  charging_dock: { x: 0, y: 0 },
  checkpoints: [
    { id: 'cp1', name: 'Gate 1', position: { x: 4, y: 4 }, order: 1, mandatory: true },
  ],
};

const mockRobotConfig: RobotConfig = {
  battery_capacity_pct: 100.0,
  consumption_per_meter: 0.5,
  safety_reserve_pct: 15.0,
  speed_m_s: 1.0,
  charging_rate_pct_s: 5.0,
  clearance_cells: 0,
  allow_diagonal: false,
};

const mockMissionConfig: MissionConfig = {
  fixed_checkpoint_order: false,
  required_checkpoints: [],
  required_patrol_coverage_pct: 100.0,
  extra_patrol_multiplier: 2,
  priority_weights: { high: 3.0, standard: 1.0, low: 0.5 },
  enforce_return_to_dock: true,
};

describe('Frontend Component Tests', () => {
  it('renders Header with map information and application title', () => {
    render(
      <Header
        mapData={mockMap}
        isBackendConnected={true}
        robotStatus="idle"
        batteryPct={95.5}
        onNewMap={vi.fn()}
        onLoadSample={vi.fn()}
        onSaveMap={vi.fn()}
        onExportMap={vi.fn()}
        onImportMap={vi.fn()}
        onToggleUnderlay={vi.fn()}
        hasUnderlay={false}
      />
    );

    expect(screen.getByText(/AUTONOMOUS PATROL CONTROLLER/i)).toBeInTheDocument();
    expect(screen.getByText(/Facility Test/i)).toBeInTheDocument();
    expect(screen.getByText(/API ONLINE/i)).toBeInTheDocument();
    expect(screen.getByText(/BATTERY: 96%/i)).toBeInTheDocument();
  });

  it('renders Toolbar and switches active tool', () => {
    const handleSelectTool = vi.fn();
    render(
      <Toolbar
        activeTool="wall"
        onSelectTool={handleSelectTool}
        selectedZoneType="standard_patrol"
        canUndo={true}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClearWalls={vi.fn()}
      />
    );

    const selectBtn = screen.getByTitle(/Select & Inspect Cell/i);
    fireEvent.click(selectBtn);
    expect(handleSelectTool).toHaveBeenCalledWith('select');
  });

  it('renders RobotPanel with battery gauge and telemetry parameters', () => {
    const handleChangeConfig = vi.fn();
    render(
      <RobotPanel
        config={mockRobotConfig}
        onChangeConfig={handleChangeConfig}
        telemetry={null}
        status="idle"
      />
    );

    expect(screen.getByText(/ROBOT TELEMETRY & SPECS/i)).toBeInTheDocument();
    expect(screen.getByText(/100.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/Reserve: 15%/i)).toBeInTheDocument();
  });

  it('renders MissionPanel and displays zones and checkpoints', () => {
    const handleDeleteZone = vi.fn();
    render(
      <MissionPanel
        config={mockMissionConfig}
        onChangeConfig={vi.fn()}
        selectedZoneType="high_priority_inspection"
        onSelectZoneType={vi.fn()}
        mapData={mockMap}
        onDeleteZone={handleDeleteZone}
        onDeleteCheckpoint={vi.fn()}
      />
    );

    expect(screen.getByText(/Server Area/i)).toBeInTheDocument();
    expect(screen.getByText(/Gate 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Enforce Return to Dock/i)).toBeInTheDocument();
  });

  it('renders RouteStats with distance and duration metrics when plan exists', () => {
    const mockPlan: MissionPlan = {
      plan_id: 'plan_123',
      algorithm_name: 'A* + Priority-Weighted Mission Sequencer',
      is_feasible: true,
      waypoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      legs: [],
      tasks: [],
      total_distance_m: 24.5,
      estimated_duration_s: 25.0,
      estimated_battery_used_pct: 12.2,
      estimated_final_battery_pct: 87.8,
      planning_time_ms: 15.4,
      coverage_percentage: 100.0,
      dock_reachable: true,
      warnings: [],
      unreachable_tasks: [],
      created_at: '2026-10-12T00:00:00Z',
    };

    render(<RouteStats plan={mockPlan} simState={null} onExportWebots={vi.fn()} />);

    expect(screen.getByText(/24.5 m/i)).toBeInTheDocument();
    expect(screen.getByText(/25 s/i)).toBeInTheDocument();
    expect(screen.getByText(/FEASIBLE & SAFE/i)).toBeInTheDocument();
  });

  it('handles NewMapModal input submission', () => {
    const handleCreate = vi.fn();
    render(
      <NewMapModal
        isOpen={true}
        onClose={vi.fn()}
        onCreate={handleCreate}
      />
    );

    expect(screen.getByText(/Create New Grid Map/i)).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: /Create Map/i });
    fireEvent.click(createBtn);
    expect(handleCreate).toHaveBeenCalled();
  });

  it('renders ZoneLegend with map symbology items', () => {
    render(<ZoneLegend />);
    expect(screen.getByText(/MAP SYMBOLOGY & LEGEND/i)).toBeInTheDocument();
    expect(screen.getByText(/Wall \/ Obstacle/i)).toBeInTheDocument();
    expect(screen.getByText(/Standard Patrol/i)).toBeInTheDocument();
    expect(screen.getByText(/Charging Dock/i)).toBeInTheDocument();
  });
});
