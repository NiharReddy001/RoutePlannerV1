import React from 'react';
import { Target, Layers, Trash2 } from 'lucide-react';
import type { MissionConfig, ZoneType, MapData } from '../types';

interface MissionPanelProps {
  config: MissionConfig;
  onChangeConfig: (newConfig: MissionConfig) => void;
  selectedZoneType: ZoneType;
  onSelectZoneType: (zoneType: ZoneType) => void;
  mapData: MapData;
  onDeleteZone: (zoneId: string) => void;
  onDeleteCheckpoint: (checkpointId: string) => void;
}

export const MissionPanel: React.FC<MissionPanelProps> = ({
  config,
  onChangeConfig,
  selectedZoneType,
  onSelectZoneType,
  mapData,
  onDeleteZone,
  onDeleteCheckpoint,
}) => {
  const zoneOptions: Array<{ type: ZoneType; label: string; color: string }> = [
    { type: 'standard_patrol', label: 'Standard Patrol', color: '#3b82f6' },
    { type: 'high_priority_inspection', label: 'High Priority (Server/Critical)', color: '#f43f5e' },
    { type: 'extra_patrol', label: 'Extra Patrol (Multi-Visit)', color: '#a855f7' },
    { type: 'one_time_inspection', label: 'One-Time Inspection', color: '#f59e0b' },
    { type: 'restricted', label: 'Restricted / No-Go Zone', color: '#ef4444' },
    { type: 'low_priority', label: 'Low Priority Inspection', color: '#64748b' },
    { type: 'temporary_blockage', label: 'Temporary Blockage', color: '#ec4899' },
  ];

  return (
    <div className="tech-card">
      <div className="tech-card-header">
        <div className="tech-card-title">
          <Target size={14} color="#38bdf8" />
          <span>MISSION & ZONE RULES</span>
        </div>
      </div>

      {/* Active Zone Classification Brush Selector */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          ACTIVE DRAWING ZONE:
        </label>
        <select
          value={selectedZoneType}
          onChange={(e) => onSelectZoneType(e.target.value as ZoneType)}
          style={{ width: '100%', height: 26 }}
        >
          {zoneOptions.map((opt) => (
            <option key={opt.type} value={opt.type}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mission Objectives & Behavioral Controls */}
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
          PATROL BEHAVIOR CONSTRAINTS
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={config.enforce_return_to_dock}
            onChange={(e) => onChangeConfig({ ...config, enforce_return_to_dock: e.target.checked })}
          />
          <span>Enforce Return to Dock</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={config.fixed_checkpoint_order}
            onChange={(e) => onChangeConfig({ ...config, fixed_checkpoint_order: e.target.checked })}
          />
          <span>Fixed Checkpoint Sequence (1 → 2 → 3)</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Extra-Patrol Visit Multiplier:</span>
          <select
            value={config.extra_patrol_multiplier}
            onChange={(e) => onChangeConfig({ ...config, extra_patrol_multiplier: parseInt(e.target.value) || 2 })}
            style={{ width: 62, height: 24 }}
          >
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>High Priority Weight:</span>
          <input
            type="number"
            step="0.5"
            min="1.0"
            max="10.0"
            value={config.priority_weights['high'] || 3.0}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                priority_weights: { ...config.priority_weights, high: parseFloat(e.target.value) || 3.0 },
              })
            }
            style={{ width: 62, textAlign: 'right' }}
          />
        </div>
      </div>

      {/* Overlays & Targets List */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Layers size={12} />
          <span>CONFIGURED ENTITIES ({mapData.zones.length + mapData.checkpoints.length})</span>
        </div>

        <div
          style={{
            maxHeight: 130,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            paddingRight: 2,
          }}
        >
          {mapData.checkpoints.map((cp) => (
            <div
              key={cp.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 6px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  #{cp.order || 'C'}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{cp.name}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ({cp.position.x}, {cp.position.y})
                </span>
              </div>
              <button
                onClick={() => onDeleteCheckpoint(cp.id)}
                title="Remove Checkpoint"
                style={{ color: '#f43f5e', padding: 2 }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {mapData.zones.map((z) => (
            <div
              key={z.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 6px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    backgroundColor: z.color || '#3b82f6',
                    flexShrink: 0,
                  }}
                />
                <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: 'var(--text-primary)' }}>
                  {z.name}
                </span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ({z.cells.length}c)
                </span>
              </div>
              <button
                onClick={() => onDeleteZone(z.id)}
                title="Remove Zone"
                style={{ color: '#f43f5e', padding: 2 }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {mapData.zones.length === 0 && mapData.checkpoints.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 10, fontStyle: 'italic', padding: 4 }}>
              No zones or checkpoints configured.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
