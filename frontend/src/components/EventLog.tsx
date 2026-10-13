import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import type { SimulationEvent } from '../types';

interface EventLogProps {
  events: SimulationEvent[];
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'OBSTACLE_DETECTED':
      case 'BATTERY_DEPLETED':
        return '#f43f5e';
      case 'TASK_COMPLETED':
      case 'DOCKED':
        return '#10b981';
      case 'REPLAN_REQUESTED':
      case 'PLAN_LOADED':
        return '#38bdf8';
      case 'EXECUTION_START':
      case 'EXECUTION_RESUME':
        return '#06b6d4';
      case 'EXECUTION_PAUSE':
      case 'WARNING':
        return '#f59e0b';
      default:
        return '#94a3b8';
    }
  };

  return (
    <div className="tech-card">
      <div className="tech-card-header">
        <div className="tech-card-title">
          <Terminal size={14} color="#06b6d4" />
          <span>MISSION AUDIT LOG</span>
        </div>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {events.length} EVENTS
        </span>
      </div>

      <div
        ref={containerRef}
        style={{
          maxHeight: 280,
          minHeight: 160,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          backgroundColor: 'var(--surface-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 3,
          padding: '6px 8px',
        }}
      >
        {events.map((evt) => {
          const badgeColor = getEventBadgeColor(evt.event_type);
          return (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                gap: 6,
                lineHeight: 1.35,
              }}
            >
              <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>[{evt.timestamp}]</span>
              <span style={{ color: badgeColor, fontWeight: 700, flexShrink: 0 }}>
                {evt.event_type}:
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{evt.message}</span>
            </div>
          );
        })}

        {events.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: 4 }}>
            No operational events logged yet.
          </div>
        )}
      </div>
    </div>
  );
};
