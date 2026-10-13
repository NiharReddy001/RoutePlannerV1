import React, { useState, useEffect, useCallback } from 'react';
import './styles/theme.css';
import type {
  MapData,
  MissionPlan,
  SimulationState,
  ToolMode,
  ZoneType,
  RobotConfig,
  MissionConfig,
  GridPoint,
} from './types';
import { api } from './api/client';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { MapCanvas } from './components/MapCanvas';
import { SimulationBar } from './components/SimulationBar';
import { RobotPanel } from './components/RobotPanel';
import { MissionPanel } from './components/MissionPanel';
import { RouteStats } from './components/RouteStats';
import { ZoneLegend } from './components/ZoneLegend';
import { EventLog } from './components/EventLog';
import {
  NewMapModal,
  ExportModal,
  ImportModal,
  UnderlayModal,
} from './components/Modals';

export const App: React.FC = () => {
  // --- APPLICATION STATE ---
  const [mapData, setMapData] = useState<MapData>({
    id: 'sample_facility_alpha',
    name: 'MDP Facility Alpha',
    schema_version: '1.0.0',
    width: 24,
    height: 18,
    resolution: 0.5,
    walls: [],
    zones: [],
    robot_start: { x: 2, y: 3 },
    charging_dock: { x: 2, y: 2 },
    checkpoints: [],
  });

  const [undoStack, setUndoStack] = useState<MapData[]>([]);
  const [redoStack, setRedoStack] = useState<MapData[]>([]);

  const [activeTool, setActiveTool] = useState<ToolMode>('select');
  const [selectedZoneType, setSelectedZoneType] = useState<ZoneType>('standard_patrol');
  const [selectedCell, setSelectedCell] = useState<GridPoint | null>(null);

  const [robotConfig, setRobotConfig] = useState<RobotConfig>({
    battery_capacity_pct: 100.0,
    consumption_per_meter: 0.5,
    safety_reserve_pct: 15.0,
    speed_m_s: 1.0,
    charging_rate_pct_s: 5.0,
    clearance_cells: 0,
    allow_diagonal: false,
  });

  const [missionConfig, setMissionConfig] = useState<MissionConfig>({
    fixed_checkpoint_order: false,
    required_checkpoints: [],
    required_patrol_coverage_pct: 100.0,
    extra_patrol_multiplier: 2,
    priority_weights: { high: 3.0, standard: 1.0, low: 0.5 },
    enforce_return_to_dock: true,
  });

  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [isPlanStale, setIsPlanStale] = useState<boolean>(false);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);

  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Active right sidebar tab: 'telemetry' | 'mission' | 'audit' | 'legend'
  const [sidebarTab, setSidebarTab] = useState<'telemetry' | 'mission' | 'audit' | 'legend'>('telemetry');

  // Modal dialog states
  const [isNewMapOpen, setIsNewMapOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isUnderlayOpen, setIsUnderlayOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- INITIAL LOAD & CONNECTIVITY CHECK ---
  useEffect(() => {
    async function init() {
      try {
        await api.checkHealth();
        setIsBackendConnected(true);

        // Fetch default sample map
        const defaultMap = await api.getDefaultSampleMap();
        setMapData(defaultMap);

        // Precompute initial plan
        const initialPlan = await api.planMission({
          map_data: defaultMap,
          robot_config: robotConfig,
          mission_config: missionConfig,
        });
        setPlan(initialPlan);

        const initSim = await api.getSimulationState();
        setSimState(initSim);
      } catch (err) {
        console.warn('Backend connection failed:', err);
        setIsBackendConnected(false);
      }
    }
    init();
  }, []);

  // --- MAP MUTATION & UNDO/REDO ---
  const handleMapChange = useCallback(
    (newMap: MapData) => {
      setUndoStack((prev) => [...prev.slice(-30), mapData]);
      setRedoStack([]);
      setMapData(newMap);
      setIsPlanStale(true);
    },
    [mapData]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, mapData]);
    setMapData(prev);
    setIsPlanStale(true);
  }, [undoStack, mapData]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, mapData]);
    setMapData(next);
    setIsPlanStale(true);
  }, [redoStack, mapData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'v') setActiveTool('select');
      else if (e.key === 'b') setActiveTool('wall');
      else if (e.key === 'e') setActiveTool('eraser');
      else if (e.key === 'z') setActiveTool('zone_rect');
      else if (e.key === 's') setActiveTool('robot_start');
      else if (e.key === 'd') setActiveTool('dock');
      else if (e.key === 'c') setActiveTool('checkpoint');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // --- PLANNING ACTIONS ---
  const handleGeneratePlan = async () => {
    setIsPlanning(true);
    try {
      const generatedPlan = await api.planMission({
        map_data: mapData,
        robot_config: robotConfig,
        mission_config: missionConfig,
        allow_diagonal: robotConfig.allow_diagonal,
        clearance_cells: robotConfig.clearance_cells,
        current_battery_pct: robotConfig.battery_capacity_pct,
      });
      setPlan(generatedPlan);
      setIsPlanStale(false);

      const sim = await api.getSimulationState();
      setSimState(sim);
      showToast('Mission route generated successfully.');
    } catch (err: any) {
      alert(`Route Planning Error: ${err.message}`);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleReplan = async () => {
    setIsPlanning(true);
    try {
      const replanned = await api.replanSimulation();
      setPlan(replanned);
      setIsPlanStale(false);
      const sim = await api.getSimulationState();
      setSimState(sim);
      showToast('Dynamic replanning completed from robot position.');
    } catch (err: any) {
      alert(`Replanning Error: ${err.message}`);
    } finally {
      setIsPlanning(false);
    }
  };

  // --- SIMULATION CONTROLS & TICK ---
  const handleStartSim = async () => {
    try {
      const res = await api.startSimulation();
      setSimState(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePauseSim = async () => {
    try {
      const res = await api.pauseSimulation();
      setSimState(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResumeSim = async () => {
    try {
      const res = await api.resumeSimulation();
      setSimState(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStopSim = async () => {
    try {
      const res = await api.stopSimulation();
      setSimState(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetSim = async () => {
    try {
      const res = await api.resetSimulation();
      setSimState(res);
      showToast('Simulation reset to initial state.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStepSim = async () => {
    try {
      const res = await api.stepSimulation(1);
      setSimState(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleChangeSpeed = async (speed: number) => {
    try {
      const res = await api.setSimulationSpeed(speed);
      setSimState(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Simulation execution ticker loop
  const simSpeed = simState?.simulation_speed || 1.0;
  useEffect(() => {
    if (!simState?.is_running) return;

    const intervalMs = Math.max(50, Math.floor(350 / simSpeed));
    const timer = setInterval(async () => {
      try {
        const nextState = await api.stepSimulation(1);
        setSimState(nextState);
      } catch (err) {
        console.error('Simulation step error:', err);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [simState?.is_running, simSpeed]);

  // --- FILE & MAP CRUD ---
  const handleSaveMap = async () => {
    try {
      await api.saveMap(mapData);
      showToast(`Map '${mapData.name}' saved to backend storage.`);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleLoadSample = async () => {
    try {
      const sample = await api.getDefaultSampleMap();
      setMapData(sample);
      setIsPlanStale(true);
      showToast('Loaded sample map: MDP Facility Alpha.');
    } catch (err: any) {
      alert(`Load failed: ${err.message}`);
    }
  };

  const handleCreateNewMap = (name: string, width: number, height: number, resolution: number) => {
    const newMap: MapData = {
      id: `map_${Date.now()}`,
      name,
      schema_version: '1.0.0',
      width,
      height,
      resolution,
      walls: [],
      zones: [],
      robot_start: { x: 1, y: 1 },
      charging_dock: { x: 0, y: 0 },
      checkpoints: [],
    };
    setMapData(newMap);
    setPlan(null);
    setIsPlanStale(false);
    showToast(`Created new map: ${name} (${width}×${height})`);
  };

  const handleImportMap = (imported: MapData) => {
    setMapData(imported);
    setIsPlanStale(true);
    showToast(`Imported map '${imported.name}'.`);
  };

  const handleExportWebots = async () => {
    if (!plan) return;
    try {
      const wbExport = await api.exportWebots(mapData, plan, robotConfig.speed_m_s);
      const blob = new Blob([JSON.stringify(wbExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapData.id}_webots_contract.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Webots route contract exported successfully.');
    } catch (err: any) {
      alert(`Webots Export Failed: ${err.message}`);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0a0f1d',
        overflow: 'hidden',
      }}
    >
      {/* 1. TOP NAV & HEADER */}
      <Header
        mapData={mapData}
        isBackendConnected={isBackendConnected}
        robotStatus={simState?.status || 'idle'}
        batteryPct={simState?.battery_pct || robotConfig.battery_capacity_pct}
        onNewMap={() => setIsNewMapOpen(true)}
        onLoadSample={handleLoadSample}
        onSaveMap={handleSaveMap}
        onExportMap={() => setIsExportOpen(true)}
        onImportMap={() => setIsImportOpen(true)}
        onToggleUnderlay={() => setIsUnderlayOpen(true)}
        hasUnderlay={Boolean(mapData.underlay?.data_url)}
      />

      {/* 2. MAIN WORKSPACE AREA */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Tool Panel */}
        <Toolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          selectedZoneType={selectedZoneType}
          onSelectZoneType={setSelectedZoneType}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearWalls={() => handleMapChange({ ...mapData, walls: [] })}
        />

        {/* Central Map Canvas + Bottom Simulation Execution Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <MapCanvas
              mapData={mapData}
              onMapChange={handleMapChange}
              activeTool={activeTool}
              selectedZoneType={selectedZoneType}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
              plan={plan}
              simState={simState}
            />
          </div>

          <SimulationBar
            plan={plan}
            simState={simState}
            isPlanning={isPlanning}
            isPlanStale={isPlanStale}
            onGeneratePlan={handleGeneratePlan}
            onReplan={handleReplan}
            onStartSim={handleStartSim}
            onPauseSim={handlePauseSim}
            onResumeSim={handleResumeSim}
            onStopSim={handleStopSim}
            onResetSim={handleResetSim}
            onStepSim={handleStepSim}
            onChangeSpeed={handleChangeSpeed}
          />
        </div>

        {/* Right Inspection & Telemetry Sidebar */}
        <aside
          style={{
            width: 'var(--sidebar-width, 370px)',
            backgroundColor: 'var(--surface-panel)',
            borderLeft: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            zIndex: 20,
          }}
        >
          {/* Sidebar Tab Navigation */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-ground)',
              flexShrink: 0,
              height: 34,
            }}
          >
            {(['telemetry', 'mission', 'audit', 'legend'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                style={{
                  flex: 1,
                  height: '100%',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderRadius: 0,
                  color: sidebarTab === tab ? '#38bdf8' : 'var(--text-muted)',
                  borderBottom: sidebarTab === tab ? '2px solid #38bdf8' : '2px solid transparent',
                  backgroundColor: sidebarTab === tab ? 'var(--surface-panel)' : 'transparent',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Sidebar Tab Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {sidebarTab === 'telemetry' && (
              <>
                <RobotPanel
                  config={robotConfig}
                  onChangeConfig={setRobotConfig}
                  telemetry={
                    simState
                      ? {
                          pose: simState.current_pose,
                          battery_pct: simState.battery_pct,
                          status: simState.status,
                          is_charging: simState.is_charging,
                          is_docked: simState.is_docked,
                          distance_traveled_m: simState.distance_traveled_m,
                          current_step_index: simState.current_waypoint_index,
                          total_steps: simState.total_waypoints,
                        }
                      : null
                  }
                  status={simState?.status || 'idle'}
                />

                <RouteStats plan={plan} simState={simState} onExportWebots={handleExportWebots} />
              </>
            )}

            {sidebarTab === 'mission' && (
              <>
                <MissionPanel
                  config={missionConfig}
                  onChangeConfig={setMissionConfig}
                  selectedZoneType={selectedZoneType}
                  onSelectZoneType={setSelectedZoneType}
                  mapData={mapData}
                  onDeleteZone={(zoneId) =>
                    handleMapChange({ ...mapData, zones: mapData.zones.filter((z) => z.id !== zoneId) })
                  }
                  onDeleteCheckpoint={(cpId) =>
                    handleMapChange({
                      ...mapData,
                      checkpoints: mapData.checkpoints.filter((cp) => cp.id !== cpId),
                    })
                  }
                />
                <RouteStats plan={plan} simState={simState} onExportWebots={handleExportWebots} />
              </>
            )}

            {sidebarTab === 'audit' && (
              <>
                <EventLog events={simState?.recent_events || []} />
                <RouteStats plan={plan} simState={simState} onExportWebots={handleExportWebots} />
              </>
            )}

            {sidebarTab === 'legend' && (
              <>
                <ZoneLegend />
                <RouteStats plan={plan} simState={simState} onExportWebots={handleExportWebots} />
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            zIndex: 100,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Dialog Modals */}
      <NewMapModal
        isOpen={isNewMapOpen}
        onClose={() => setIsNewMapOpen(false)}
        onCreate={handleCreateNewMap}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        mapData={mapData}
        plan={plan}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportMap}
      />

      <UnderlayModal
        isOpen={isUnderlayOpen}
        onClose={() => setIsUnderlayOpen(false)}
        underlay={mapData.underlay}
        onUpdateUnderlay={(underlay) => handleMapChange({ ...mapData, underlay })}
      />
    </div>
  );
};

export default App;
