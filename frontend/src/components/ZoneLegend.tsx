import React from 'react';
import { Info } from 'lucide-react';

export const ZoneLegend: React.FC = () => {
  const legendItems = [
    { label: 'Free Cell', color: '#0d1527', border: '#273859', icon: '·' },
    { label: 'Wall / Obstacle', color: '#1e293b', border: '#334155', icon: '■' },
    { label: 'Standard Patrol', color: 'rgba(59, 130, 246, 0.4)', border: '#3b82f6', icon: 'P' },
    { label: 'Extra Patrol (2x)', color: 'rgba(168, 85, 247, 0.4)', border: '#a855f7', icon: '2x' },
    { label: 'High Priority', color: 'rgba(244, 63, 94, 0.4)', border: '#f43f5e', icon: '!' },
    { label: 'One-Time Inspect', color: 'rgba(245, 158, 11, 0.4)', border: '#f59e0b', icon: '1x' },
    { label: 'Restricted No-Go', color: 'rgba(239, 68, 68, 0.4)', border: '#ef4444', icon: '✕' },
    { label: 'Temp Blockage', color: 'rgba(236, 72, 153, 0.6)', border: '#ec4899', icon: '⊘' },
    { label: 'Checkpoint', color: '#0284c7', border: '#38bdf8', icon: '#1' },
    { label: 'Charging Dock', color: '#059669', border: '#34d399', icon: '⚡' },
    { label: 'Robot Pose', color: '#10b981', border: '#ffffff', icon: '▲' },
    { label: 'Planned Route', color: '#06b6d4', border: '#38bdf8', icon: '━' },
  ];

  return (
    <div className="tech-card">
      <div className="tech-card-header">
        <div className="tech-card-title">
          <Info size={14} color="#38bdf8" />
          <span>MAP SYMBOLOGY & LEGEND</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '5px 8px',
          fontSize: 10,
        }}
      >
        {legendItems.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 15,
                height: 15,
                backgroundColor: item.color,
                border: `1px solid ${item.border}`,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8.5,
                fontWeight: 700,
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>
            <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
