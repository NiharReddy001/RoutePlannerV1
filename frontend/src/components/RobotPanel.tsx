import React from 'react';
import { Battery, BatteryCharging, Gauge } from 'lucide-react';
import type { RobotConfig, RobotTelemetry, RobotStatus } from '../types';

interface RobotPanelProps {
  config: RobotConfig;
  onChangeConfig: (newConfig: RobotConfig) => void;
  telemetry: RobotTelemetry | null;
  status: RobotStatus;
}

export const RobotPanel: React.FC<RobotPanelProps> = ({
  config,
  onChangeConfig,
  telemetry,
  status,
}) => {
  const batteryPct = telemetry ? telemetry.battery_pct : config.battery_capacity_pct;
  const isCharging = telemetry?.is_charging || false;

  const getBatteryColor = (pct: number) => {
    if (pct > 50) return '#10b981';
    if (pct > config.safety_reserve_pct) return '#f59e0b';
    return '#f43f5e';
  };

  const batteryColor = getBatteryColor(batteryPct);

  return (
    <div className="tech-card">
      <div className="tech-card-header">
        <div className="tech-card-title">
          <Gauge size={14} color="#06b6d4" />
          <span>ROBOT TELEMETRY & SPECS</span>
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: 'var(--font-mono)',
            color: '#38bdf8',
            fontWeight: 700,
            padding: '2px 6px',
            backgroundColor: 'var(--surface-subtle)',
            borderRadius: 3,
            border: '1px solid var(--border-subtle)',
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>

      {/* Battery State Gauge */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
            {isCharging ? <BatteryCharging size={13} color="#06b6d4" /> : <Battery size={13} color={batteryColor} />}
            <span>Battery State</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: batteryColor }}>
            {batteryPct.toFixed(1)}%
          </span>
        </div>

        {/* Battery Bar with Safety Reserve Notch */}
        <div
          style={{
            height: 8,
            backgroundColor: 'var(--surface-sunken)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, batteryPct))}%`,
              backgroundColor: batteryColor,
              transition: 'width 0.15s ease',
            }}
          />
          {/* Safety reserve marker */}
          <div
            title={`Safety Reserve (${config.safety_reserve_pct}%)`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${config.safety_reserve_pct}%`,
              width: 2,
              backgroundColor: '#f43f5e',
              zIndex: 2,
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>
          <span>Reserve: {config.safety_reserve_pct}%</span>
          <span>{isCharging ? 'Recharging at Dock' : `${config.consumption_per_meter}%/m`}</span>
        </div>
      </div>

      {/* Realtime Pose readout */}
      {telemetry && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
          }}
        >
          <div className="metric-box">
            <span className="metric-label">Position</span>
            <span className="metric-value">
              ({telemetry.pose.position.x}, {telemetry.pose.position.y})
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Heading</span>
            <span className="metric-value" style={{ color: '#06b6d4' }}>
              {telemetry.pose.heading_deg}°
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Traveled</span>
            <span className="metric-value">{telemetry.distance_traveled_m.toFixed(1)} m</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Waypoint</span>
            <span className="metric-value" style={{ color: '#10b981' }}>
              {telemetry.current_step_index} / {telemetry.total_steps}
            </span>
          </div>
        </div>
      )}

      {/* Tunable Hardware Specifications */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          ROBOT KINEMATICS & DRAIN MODEL
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Speed (m/s):</span>
          <input
            type="number"
            step="0.1"
            min="0.2"
            max="5.0"
            value={config.speed_m_s}
            onChange={(e) => onChangeConfig({ ...config, speed_m_s: parseFloat(e.target.value) || 1.0 })}
            style={{ width: 62, textAlign: 'right' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Drain Rate (%/m):</span>
          <input
            type="number"
            step="0.05"
            min="0.05"
            max="5.0"
            value={config.consumption_per_meter}
            onChange={(e) =>
              onChangeConfig({ ...config, consumption_per_meter: parseFloat(e.target.value) || 0.5 })
            }
            style={{ width: 62, textAlign: 'right' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Safety Reserve (%):</span>
          <input
            type="number"
            step="1"
            min="5"
            max="40"
            value={config.safety_reserve_pct}
            onChange={(e) =>
              onChangeConfig({ ...config, safety_reserve_pct: parseFloat(e.target.value) || 15.0 })
            }
            style={{ width: 62, textAlign: 'right' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Clearance (cells):</span>
          <input
            type="number"
            step="1"
            min="0"
            max="3"
            value={config.clearance_cells}
            onChange={(e) => onChangeConfig({ ...config, clearance_cells: parseInt(e.target.value) || 0 })}
            style={{ width: 62, textAlign: 'right' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Allow Diagonals (8-Way):</span>
          <input
            type="checkbox"
            checked={config.allow_diagonal}
            onChange={(e) => onChangeConfig({ ...config, allow_diagonal: e.target.checked })}
          />
        </div>
      </div>
    </div>
  );
};
