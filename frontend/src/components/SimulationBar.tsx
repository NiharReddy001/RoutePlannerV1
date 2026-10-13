import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Square,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { SimulationState, MissionPlan } from '../types';

interface SimulationBarProps {
  plan: MissionPlan | null;
  simState: SimulationState | null;
  isPlanning: boolean;
  isPlanStale: boolean;
  onGeneratePlan: () => void;
  onReplan: () => void;
  onStartSim: () => void;
  onPauseSim: () => void;
  onResumeSim: () => void;
  onStopSim: () => void;
  onResetSim: () => void;
  onStepSim: () => void;
  onChangeSpeed: (multiplier: number) => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  plan,
  simState,
  isPlanning,
  isPlanStale,
  onGeneratePlan,
  onReplan,
  onStartSim,
  onPauseSim,
  onResumeSim,
  onStopSim,
  onResetSim,
  onStepSim,
  onChangeSpeed,
}) => {
  const isRunning = simState?.is_running || false;
  const isPaused = simState?.is_paused || false;
  const speed = simState?.simulation_speed || 1.0;

  const currentStep = simState ? simState.current_waypoint_index : 0;
  const totalSteps = plan ? plan.waypoints.length : 0;
  const progressPct = totalSteps > 1 ? Math.min(100, Math.round((currentStep / (totalSteps - 1)) * 100)) : 0;

  return (
    <footer
      style={{
        height: 'var(--footer-height, 48px)',
        backgroundColor: 'var(--surface-panel)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        flexShrink: 0,
        zIndex: 30,
      }}
    >
      {/* Route Computation Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onGeneratePlan}
          disabled={isPlanning}
          style={{
            height: 30,
            padding: '0 13px',
            backgroundColor: isPlanStale ? '#eab308' : '#0284c7',
            color: isPlanStale ? '#0a0f1d' : '#ffffff',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.03em',
            border: isPlanStale ? '1px solid #facc15' : '1px solid #38bdf8',
            boxShadow: '0 0 10px rgba(2, 132, 199, 0.3)',
          }}
          title={isPlanStale ? 'Map modified: recompute route' : 'Generate Mission Route'}
        >
          {isPlanning ? (
            <RefreshCw size={13} className="spin" />
          ) : isPlanStale ? (
            <AlertTriangle size={13} />
          ) : (
            <Sparkles size={13} />
          )}
          <span>{isPlanning ? 'PLANNING...' : isPlanStale ? 'RECOMPUTE ROUTE' : 'GENERATE ROUTE'}</span>
        </button>

        <button
          onClick={onReplan}
          disabled={!simState || isPlanning}
          style={{
            height: 30,
            padding: '0 11px',
            backgroundColor: 'var(--surface-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Dynamic Replanning from current robot coordinates"
        >
          <RefreshCw size={12} />
          <span>REPLAN FROM POSE</span>
        </button>
      </div>

      {/* Execution Playback Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!isRunning && !isPaused && (
          <button
            onClick={onStartSim}
            disabled={!plan || plan.waypoints.length === 0}
            style={{
              height: 30,
              padding: '0 14px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
            title="Start Simulated Mission Execution"
          >
            <Play size={13} fill="#ffffff" />
            <span>EXECUTE</span>
          </button>
        )}

        {isRunning && (
          <button
            onClick={onPauseSim}
            style={{
              height: 30,
              padding: '0 14px',
              backgroundColor: '#f59e0b',
              color: '#0a0f1d',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
            title="Pause Execution"
          >
            <Pause size={13} fill="#0a0f1d" />
            <span>PAUSE</span>
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResumeSim}
            style={{
              height: 30,
              padding: '0 14px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
            title="Resume Execution"
          >
            <Play size={13} fill="#ffffff" />
            <span>RESUME</span>
          </button>
        )}

        <button
          onClick={onStepSim}
          disabled={!plan}
          style={{
            height: 30,
            padding: '0 10px',
            backgroundColor: 'var(--surface-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Step Forward 1 Waypoint"
        >
          <StepForward size={13} />
          <span>STEP</span>
        </button>

        <button
          onClick={onStopSim}
          style={{
            height: 30,
            padding: '0 10px',
            backgroundColor: 'var(--surface-card)',
            color: '#f43f5e',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Stop Simulation"
        >
          <Square size={12} />
          <span>STOP</span>
        </button>

        <button
          onClick={onResetSim}
          style={{
            height: 30,
            padding: '0 10px',
            backgroundColor: 'var(--surface-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Reset Simulation State"
        >
          <RotateCcw size={12} />
          <span>RESET</span>
        </button>
      </div>

      {/* Speed & Progress Monitor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Speed Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SPEED:</span>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-panel)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            {[0.5, 1.0, 2.0, 5.0].map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                style={{
                  height: 24,
                  padding: '0 6px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 0,
                  backgroundColor: speed === s ? '#0284c7' : 'transparent',
                  color: speed === s ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar & Counter */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 140, gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>PROGRESS</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {currentStep}/{totalSteps > 0 ? totalSteps - 1 : 0} ({progressPct}%)
            </span>
          </div>
          <div
            style={{
              height: 4,
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: 2,
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                backgroundColor: '#06b6d4',
                transition: 'width 0.12s ease',
              }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
