import React from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Navigation2,
  Battery,
  ShieldCheck,
  Send,
} from 'lucide-react';
import type { MissionPlan, SimulationState } from '../types';

interface RouteStatsProps {
  plan: MissionPlan | null;
  simState: SimulationState | null;
  onExportWebots: () => void;
}

export const RouteStats: React.FC<RouteStatsProps> = ({
  plan,
  simState,
  onExportWebots,
}) => {
  if (!plan) {
    return (
      <div
        className="tech-card"
        style={{
          color: 'var(--text-muted)',
          fontSize: 11,
          textAlign: 'center',
          padding: '24px 16px',
        }}
      >
        No active route plan computed. Click 'GENERATE ROUTE' to optimize a mission plan.
      </div>
    );
  }

  const completedTasks = simState ? Object.keys(simState.completed_task_ids).length : 0;
  const totalTasks = plan.tasks.length;

  return (
    <div className="tech-card">
      <div className="tech-card-header">
        <div className="tech-card-title">
          <Activity size={14} color="#10b981" />
          <span>ROUTE PERFORMANCE</span>
        </div>
        <div
          style={{
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 9.5,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: plan.is_feasible ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: plan.is_feasible ? '1px solid #10b981' : '1px solid #f43f5e',
            color: plan.is_feasible ? '#10b981' : '#f43f5e',
          }}
        >
          {plan.is_feasible ? 'FEASIBLE & SAFE' : 'CONSTRAINED'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
        }}
      >
        <div className="metric-box">
          <span className="metric-label">
            <Navigation2 size={11} color="#06b6d4" />
            Distance
          </span>
          <span className="metric-value">{plan.total_distance_m.toFixed(1)} m</span>
          <span className="metric-sub">{plan.waypoints.length} cells traversed</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">
            <Clock size={11} color="#38bdf8" />
            Duration
          </span>
          <span className="metric-value">{plan.estimated_duration_s.toFixed(0)} s</span>
          <span className="metric-sub">Solved in {plan.planning_time_ms} ms</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">
            <Battery size={11} color="#10b981" />
            Energy Req.
          </span>
          <span className="metric-value">{plan.estimated_battery_used_pct.toFixed(1)}%</span>
          <span className="metric-sub">Final: {plan.estimated_final_battery_pct.toFixed(1)}%</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">
            <ShieldCheck size={11} color="#a855f7" />
            Coverage
          </span>
          <span className="metric-value">{plan.coverage_percentage}%</span>
          <span className="metric-sub">
            {completedTasks}/{totalTasks} tasks complete
          </span>
        </div>
      </div>

      {/* Warnings & Diagnostics Banner */}
      {plan.warnings.length > 0 && (
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid #f59e0b',
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 10.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>
            <AlertTriangle size={13} />
            <span>OPERATIONAL WARNINGS ({plan.warnings.length})</span>
          </div>
          <ul style={{ paddingLeft: 16, color: '#fbbf24', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {plan.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Export to Webots Action */}
      <button
        onClick={onExportWebots}
        style={{
          height: 28,
          backgroundColor: 'var(--surface-subtle)',
          border: '1px solid var(--border-interactive)',
          color: '#38bdf8',
          fontSize: 11,
          fontWeight: 600,
        }}
        title="Export route to Webots JSON integration contract"
      >
        <Send size={12} />
        <span>EXPORT ROUTE TO WEBOTS</span>
      </button>
    </div>
  );
};
