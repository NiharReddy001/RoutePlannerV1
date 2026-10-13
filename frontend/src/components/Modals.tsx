import React, { useState } from 'react';
import { X, AlertCircle, Upload, Download } from 'lucide-react';
import type { MapData, MissionPlan, UnderlayImage } from '../types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #27354f',
          borderRadius: 8,
          width: '90%',
          maxWidth: 480,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            fontWeight: 700,
            color: '#f8fafc',
          }}
        >
          <span>{title}</span>
          <button onClick={onClose} style={{ color: '#94a3b8' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
};

// --- NEW MAP MODAL ---
interface NewMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, width: number, height: number, resolution: number) => void;
}

export const NewMapModal: React.FC<NewMapModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('New Patrol Grid');
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  const [resolution, setResolution] = useState(0.5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(name, width, height, resolution);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Grid Map">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Map Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%' }}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
              Width (cells)
            </label>
            <input
              type="number"
              min={3}
              max={100}
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 20)}
              style={{ width: '100%' }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
              Height (cells)
            </label>
            <input
              type="number"
              min={3}
              max={100}
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 15)}
              style={{ width: '100%' }}
              required
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Resolution (meters per cell)
          </label>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="5.0"
            value={resolution}
            onChange={(e) => setResolution(parseFloat(e.target.value) || 0.5)}
            style={{ width: '100%' }}
            required
          />
          <span style={{ fontSize: 10, color: '#64748b', marginTop: 2, display: 'block' }}>
            Grid physical coverage: {(width * resolution).toFixed(1)}m × {(height * resolution).toFixed(1)}m
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '6px 12px', backgroundColor: '#1e293b', border: '1px solid #334155' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ padding: '6px 14px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600 }}
          >
            Create Map
          </button>
        </div>
      </form>
    </Modal>
  );
};

// --- EXPORT MODAL ---
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapData: MapData;
  plan: MissionPlan | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, mapData, plan }) => {
  const [tab, setTab] = useState<'map' | 'plan'>('map');

  const mapJson = JSON.stringify(mapData, null, 2);
  const planJson = plan ? JSON.stringify(plan, null, 2) : 'No plan generated yet.';

  const handleDownload = () => {
    const content = tab === 'map' ? mapJson : planJson;
    const filename = tab === 'map' ? `${mapData.id}.json` : `${mapData.id}_mission_plan.json`;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Project & Routes">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setTab('map')}
          style={{
            flex: 1,
            padding: '6px 10px',
            backgroundColor: tab === 'map' ? '#0284c7' : '#1e293b',
            color: tab === 'map' ? '#ffffff' : '#94a3b8',
          }}
        >
          Map Schema JSON
        </button>
        <button
          onClick={() => setTab('plan')}
          style={{
            flex: 1,
            padding: '6px 10px',
            backgroundColor: tab === 'plan' ? '#0284c7' : '#1e293b',
            color: tab === 'plan' ? '#ffffff' : '#94a3b8',
          }}
        >
          Mission Plan JSON
        </button>
      </div>

      <textarea
        readOnly
        value={tab === 'map' ? mapJson : planJson}
        rows={12}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button
          onClick={onClose}
          style={{ padding: '6px 12px', backgroundColor: '#1e293b', border: '1px solid #334155' }}
        >
          Close
        </button>
        <button
          onClick={handleDownload}
          style={{ padding: '6px 14px', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 600 }}
        >
          <Download size={14} />
          Download JSON
        </button>
      </div>
    </Modal>
  );
};

// --- IMPORT MODAL ---
interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedMap: MapData) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText((event.target?.result as string) || '');
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Basic client schema check
      if (!parsed.width || !parsed.height || !parsed.robot_start || !parsed.charging_dock) {
        throw new Error("Invalid map JSON: missing required 'width', 'height', 'robot_start', or 'charging_dock'");
      }
      onImport(parsed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Malformed JSON');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Map JSON">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Choose File from Disk
          </label>
          <input type="file" accept=".json" onChange={handleFileUpload} style={{ width: '100%' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Or Paste JSON directly:
          </label>
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setError(null);
            }}
            placeholder="Paste exported map JSON here..."
            rows={8}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>

        {error && (
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid #f43f5e',
              color: '#f43f5e',
              borderRadius: 4,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '6px 12px', backgroundColor: '#1e293b', border: '1px solid #334155' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProcessImport}
            disabled={!jsonText.trim()}
            style={{
              padding: '6px 14px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              opacity: jsonText.trim() ? 1 : 0.5,
            }}
          >
            <Upload size={14} />
            Validate & Load
          </button>
        </div>
      </div>
    </Modal>
  );
};

// --- UNDERLAY IMAGE MODAL ---
interface UnderlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  underlay: UnderlayImage | undefined;
  onUpdateUnderlay: (underlay: UnderlayImage | undefined) => void;
}

export const UnderlayModal: React.FC<UnderlayModalProps> = ({
  isOpen,
  onClose,
  underlay,
  onUpdateUnderlay,
}) => {
  const [opacity, setOpacity] = useState(underlay?.opacity ?? 0.5);
  const [scale, setScale] = useState(underlay?.scale ?? 1.0);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUpdateUnderlay({
        filename: file.name,
        data_url: dataUrl,
        opacity,
        scale,
        offset_x: 0,
        offset_y: 0,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (underlay) {
      onUpdateUnderlay({
        ...underlay,
        opacity,
        scale,
      });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Floorplan Image Underlay">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            Upload Floorplan (PNG/JPG)
          </label>
          <input type="file" accept="image/*" onChange={handleImageFile} style={{ width: '100%' }} />
          <span style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'block' }}>
            Note: Floorplan is rendered as a visual trace underlay. Trace obstacles over it using the Wall brush.
          </span>
        </div>

        {underlay?.data_url && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                <span>Opacity</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                <span>Scale</span>
                <span>{scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          {underlay && (
            <button
              type="button"
              onClick={() => {
                onUpdateUnderlay(undefined);
                onClose();
              }}
              style={{ padding: '6px 12px', backgroundColor: '#1e293b', color: '#f43f5e', border: '1px solid #334155' }}
            >
              Remove Underlay
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '6px 12px', backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{ padding: '6px 14px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600 }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
