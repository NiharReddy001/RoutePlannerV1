import React from 'react';
import {
  Save,
  FolderOpen,
  Plus,
  Download,
  Upload,
  Image as ImageIcon,
  Cpu,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { MapData, RobotStatus } from '../types';

interface HeaderProps {
  mapData: MapData;
  isBackendConnected: boolean;
  robotStatus: RobotStatus;
  batteryPct: number;
  onNewMap: () => void;
  onLoadSample: () => void;
  onSaveMap: () => void;
  onExportMap: () => void;
  onImportMap: () => void;
  onToggleUnderlay: () => void;
  hasUnderlay: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mapData,
  isBackendConnected,
  robotStatus,
  batteryPct,
  onNewMap,
  onLoadSample,
  onSaveMap,
  onExportMap,
  onImportMap,
  onToggleUnderlay,
  hasUnderlay,
}) => {
  const getStatusBadge = () => {
    switch (robotStatus) {
      case 'navigating':
      case 'patrolling':
        return { text: 'PATROLLING', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'returning_to_dock':
        return { text: 'RETURNING TO DOCK', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' };
      case 'docked':
        return { text: 'DOCKED (CHARGING)', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' };
      case 'paused':
        return { text: 'PAUSED', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'blocked':
        return { text: 'OBSTACLE DETECTED', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' };
      case 'out_of_battery':
        return { text: 'BATTERY DEPLETED', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.2)' };
      default:
        return { text: 'IDLE (READY)', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
    }
  };

  const status = getStatusBadge();

  return (
    <header
      style={{
        height: 'var(--header-height, 46px)',
        backgroundColor: 'var(--surface-panel)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        flexShrink: 0,
        zIndex: 30,
      }}
    >
      {/* Brand & Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            backgroundColor: '#0c1b33',
            border: '1px solid #0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}
        >
          <Cpu size={15} />
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              lineHeight: 1.15,
            }}
          >
            AUTONOMOUS PATROL CONTROLLER
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.02em',
            }}
          >
            MDP MISSION-AWARE ROUTE PLANNER v1.0
          </div>
        </div>
      </div>

      {/* Central Telemetry Ribbon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Robot Status Pill */}
        <div
          style={{
            height: 24,
            padding: '0 8px',
            borderRadius: 3,
            backgroundColor: status.bg,
            border: `1px solid ${status.color}`,
            color: status.color,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ fontSize: 8 }}>●</span>
          <span>{status.text}</span>
        </div>

        {/* Battery State */}
        <div
          style={{
            height: 24,
            padding: '0 8px',
            borderRadius: 3,
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-panel)',
            color: batteryPct > 20 ? '#38bdf8' : '#f43f5e',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span>BATTERY: {batteryPct.toFixed(0)}%</span>
        </div>

        {/* Map Metadata */}
        <div
          style={{
            height: 24,
            padding: '0 8px',
            borderRadius: 3,
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-panel)',
            color: 'var(--text-secondary)',
            fontSize: 10.5,
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>MAP:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{mapData.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            ({mapData.width}×{mapData.height} @ {mapData.resolution}m)
          </span>
        </div>

        {/* Backend Online / Offline */}
        <div
          title={isBackendConnected ? 'FastAPI Planner Engine Online' : 'Backend Offline'}
          style={{
            height: 24,
            padding: '0 8px',
            borderRadius: 3,
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-panel)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: isBackendConnected ? '#10b981' : '#f43f5e',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isBackendConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{isBackendConnected ? 'API ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <button
          onClick={onNewMap}
          style={{
            height: 26,
            padding: '0 8px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
          }}
          title="Create New Blank Map"
        >
          <Plus size={13} />
          <span>New</span>
        </button>

        <button
          onClick={onLoadSample}
          style={{
            height: 26,
            padding: '0 8px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
          }}
          title="Load Facility Alpha Sample Map"
        >
          <FolderOpen size={13} />
          <span>Sample</span>
        </button>

        <button
          onClick={onSaveMap}
          style={{
            height: 26,
            padding: '0 8px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
          }}
          title="Save Map to Server Storage"
        >
          <Save size={13} />
          <span>Save</span>
        </button>

        <button
          onClick={onExportMap}
          style={{
            height: 26,
            padding: '0 8px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
          }}
          title="Export Map & Mission to JSON File"
        >
          <Download size={13} />
          <span>Export</span>
        </button>

        <button
          onClick={onImportMap}
          style={{
            height: 26,
            padding: '0 8px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-panel)',
            fontSize: 11,
          }}
          title="Import JSON Map File"
        >
          <Upload size={13} />
          <span>Import</span>
        </button>

        <button
          onClick={onToggleUnderlay}
          style={{
            height: 26,
            padding: '0 8px',
            backgroundColor: hasUnderlay ? '#0284c7' : 'var(--surface-card)',
            border: hasUnderlay ? '1px solid #38bdf8' : '1px solid var(--border-panel)',
            color: hasUnderlay ? '#ffffff' : 'inherit',
            fontSize: 11,
          }}
          title="Floorplan Image Underlay"
        >
          <ImageIcon size={13} />
          <span>Underlay</span>
        </button>
      </div>
    </header>
  );
};
