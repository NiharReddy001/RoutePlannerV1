import React from 'react';
import {
  MousePointer,
  Square,
  Eraser,
  BoxSelect,
  Flag,
  Navigation,
  Zap,
  AlertTriangle,
  Move,
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react';
import type { ToolMode, ZoneType } from '../types';

interface ToolbarProps {
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  selectedZoneType?: ZoneType;
  onSelectZoneType?: (zoneType: ZoneType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearWalls: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  selectedZoneType,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearWalls,
}) => {
  const toolGroups: Array<{
    id: string;
    items: Array<{ mode: ToolMode; label: string; icon: React.ReactNode; tooltip: string }>;
  }> = [
    {
      id: 'nav',
      items: [
        { mode: 'select', label: 'Select', icon: <MousePointer size={15} />, tooltip: 'Select & Inspect Cell [V]' },
        { mode: 'pan', label: 'Pan', icon: <Move size={15} />, tooltip: 'Pan Canvas [Space]' },
      ],
    },
    {
      id: 'geometry',
      items: [
        { mode: 'wall', label: 'Wall', icon: <Square size={15} />, tooltip: 'Draw Obstacle Walls [B]' },
        { mode: 'eraser', label: 'Eraser', icon: <Eraser size={15} />, tooltip: 'Erase Walls & Blockages [E]' },
        { mode: 'zone_rect', label: 'Zone', icon: <BoxSelect size={15} />, tooltip: 'Draw Rectangular Zone Region [Z]' },
      ],
    },
    {
      id: 'entities',
      items: [
        { mode: 'robot_start', label: 'Start', icon: <Navigation size={15} />, tooltip: 'Place Robot Start Pose [S]' },
        { mode: 'dock', label: 'Dock', icon: <Zap size={15} />, tooltip: 'Place Charging Dock [D]' },
        { mode: 'checkpoint', label: 'CP', icon: <Flag size={15} />, tooltip: 'Place Numbered Checkpoint [C]' },
      ],
    },
    {
      id: 'dynamic',
      items: [
        { mode: 'blockage', label: 'Blockage', icon: <AlertTriangle size={15} />, tooltip: 'Insert Dynamic Blockage [T]' },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: 'var(--toolbar-width, 46px)',
        backgroundColor: 'var(--surface-panel)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 6,
        flexShrink: 0,
        zIndex: 25,
      }}
    >
      {/* Grouped Tool Buttons */}
      {toolGroups.map((group, gIdx) => (
        <React.Fragment key={group.id}>
          {gIdx > 0 && (
            <div
              style={{
                width: 24,
                height: 1,
                backgroundColor: 'var(--border-subtle)',
                margin: '2px 0',
              }}
            />
          )}
          {group.items.map((t) => {
            const isActive = activeTool === t.mode;
            return (
              <button
                key={t.mode}
                onClick={() => onSelectTool(t.mode)}
                title={t.tooltip}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  backgroundColor: isActive ? '#0284c7' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? '1px solid #38bdf8' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 8px rgba(56, 189, 248, 0.3)' : 'none',
                }}
              >
                {t.icon}
              </button>
            );
          })}
        </React.Fragment>
      ))}

      {/* Active Zone Label Badge */}
      {activeTool === 'zone_rect' && selectedZoneType && (
        <div
          title={`Active Drawing Zone: ${selectedZoneType}`}
          style={{
            fontSize: 8.5,
            padding: '2px 3px',
            borderRadius: 2,
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            maxWidth: 40,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {selectedZoneType.split('_')[0].toUpperCase()}
        </div>
      )}

      {/* Spacer to push actions to bottom */}
      <div style={{ flex: 1 }} />

      <div
        style={{
          width: 24,
          height: 1,
          backgroundColor: 'var(--border-subtle)',
          margin: '2px 0',
        }}
      />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo [Ctrl+Z]"
        style={{
          width: 32,
          height: 30,
          borderRadius: 4,
          backgroundColor: 'transparent',
          color: canUndo ? 'var(--text-secondary)' : 'var(--text-dim)',
        }}
      >
        <Undo2 size={14} />
      </button>

      {/* Redo */}
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo [Ctrl+Y]"
        style={{
          width: 32,
          height: 30,
          borderRadius: 4,
          backgroundColor: 'transparent',
          color: canRedo ? 'var(--text-secondary)' : 'var(--text-dim)',
        }}
      >
        <Redo2 size={14} />
      </button>

      {/* Clear Walls */}
      <button
        onClick={onClearWalls}
        title="Clear All Obstacle Walls"
        style={{
          width: 32,
          height: 30,
          borderRadius: 4,
          backgroundColor: 'transparent',
          color: '#f43f5e',
        }}
      >
        <Trash2 size={14} />
      </button>
    </aside>
  );
};
