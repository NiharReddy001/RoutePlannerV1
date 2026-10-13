import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  MapData,
  GridPoint,
  MissionPlan,
  SimulationState,
  ToolMode,
  ZoneType,
  Checkpoint,
} from '../types';

interface MapCanvasProps {
  mapData: MapData;
  onMapChange: (updatedMap: MapData) => void;
  activeTool: ToolMode;
  selectedZoneType: ZoneType;
  selectedCell: GridPoint | null;
  onSelectCell: (pt: GridPoint | null) => void;
  plan: MissionPlan | null;
  simState: SimulationState | null;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  mapData,
  onMapChange,
  activeTool,
  selectedZoneType,
  selectedCell,
  onSelectCell,
  plan,
  simState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan and Zoom viewport state
  const [zoom, setZoom] = useState<number>(24); // pixels per cell
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mouse brush interaction state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [lastGridPos, setLastGridPos] = useState<GridPoint | null>(null);

  // Region drag selection
  const [dragStartCell, setDragStartCell] = useState<GridPoint | null>(null);
  const [dragCurrentCell, setDragCurrentCell] = useState<GridPoint | null>(null);

  // Hover coordinate readout
  const [hoverCoord, setHoverCoord] = useState<GridPoint | null>(null);

  // Loaded floorplan underlay image element
  const underlayImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (mapData.underlay?.data_url) {
      const img = new Image();
      img.src = mapData.underlay.data_url;
      img.onload = () => {
        underlayImgRef.current = img;
      };
    } else {
      underlayImgRef.current = null;
    }
  }, [mapData.underlay?.data_url]);

  // Convert screen coordinates to grid coordinates
  const screenToGrid = useCallback(
    (screenX: number, screenY: number): GridPoint | null => {
      const gx = Math.floor((screenX - panOffset.x) / zoom);
      const gy = Math.floor((screenY - panOffset.y) / zoom);
      if (gx < 0 || gx >= mapData.width || gy < 0 || gy >= mapData.height) {
        return null;
      }
      return { x: gx, y: gy };
    },
    [panOffset, zoom, mapData.width, mapData.height]
  );

  // Convert grid coordinates to canvas screen top-left
  const gridToScreen = useCallback(
    (gx: number, gy: number) => {
      return {
        x: panOffset.x + gx * zoom,
        y: panOffset.y + gy * zoom,
      };
    },
    [panOffset, zoom]
  );

  // Center & Fit map to viewport
  const fitMapToViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const padding = 60;
    const availW = canvas.clientWidth - padding * 2;
    const availH = canvas.clientHeight - padding * 2;
    const zoomX = availW / mapData.width;
    const zoomY = availH / mapData.height;
    const newZoom = Math.max(12, Math.min(48, Math.floor(Math.min(zoomX, zoomY))));
    setZoom(newZoom);
    setPanOffset({
      x: Math.floor((canvas.clientWidth - mapData.width * newZoom) / 2),
      y: Math.floor((canvas.clientHeight - mapData.height * newZoom) / 2),
    });
  }, [mapData.width, mapData.height]);

  useEffect(() => {
    fitMapToViewport();
  }, [mapData.id, fitMapToViewport]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // 1. Background Fill
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, width, height);

    // 2. Render Floorplan Underlay (if uploaded)
    if (underlayImgRef.current && mapData.underlay) {
      ctx.save();
      ctx.globalAlpha = mapData.underlay.opacity;
      const startPos = gridToScreen(0, 0);
      const imgW = mapData.width * zoom * mapData.underlay.scale;
      const imgH = mapData.height * zoom * mapData.underlay.scale;
      ctx.drawImage(
        underlayImgRef.current,
        startPos.x + mapData.underlay.offset_x,
        startPos.y + mapData.underlay.offset_y,
        imgW,
        imgH
      );
      ctx.restore();
    }

    // 3. Grid Floor Boundary and Tiles
    const mapOrigin = gridToScreen(0, 0);
    const mapW = mapData.width * zoom;
    const mapH = mapData.height * zoom;

    // Floor area background
    ctx.fillStyle = '#0d1527';
    ctx.fillRect(mapOrigin.x, mapOrigin.y, mapW, mapH);

    // Grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#17223b';
    for (let x = 0; x <= mapData.width; x++) {
      const sx = mapOrigin.x + x * zoom;
      ctx.beginPath();
      ctx.moveTo(sx, mapOrigin.y);
      ctx.lineTo(sx, mapOrigin.y + mapH);
      ctx.stroke();
    }
    for (let y = 0; y <= mapData.height; y++) {
      const sy = mapOrigin.y + y * zoom;
      ctx.beginPath();
      ctx.moveTo(mapOrigin.x, sy);
      ctx.lineTo(mapOrigin.x + mapW, sy);
      ctx.stroke();
    }

    // Outer grid border
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#273859';
    ctx.strokeRect(mapOrigin.x, mapOrigin.y, mapW, mapH);

    // 4. Render Zones
    for (const zone of mapData.zones) {
      let fillColor = 'rgba(59, 130, 246, 0.25)'; // standard patrol
      let strokeColor = '#3b82f6';

      if (zone.type === 'restricted') {
        fillColor = 'rgba(239, 68, 68, 0.35)';
        strokeColor = '#ef4444';
      } else if (zone.type === 'high_priority_inspection') {
        fillColor = 'rgba(244, 63, 94, 0.35)';
        strokeColor = '#f43f5e';
      } else if (zone.type === 'extra_patrol') {
        fillColor = 'rgba(168, 85, 247, 0.3)';
        strokeColor = '#a855f7';
      } else if (zone.type === 'one_time_inspection') {
        fillColor = 'rgba(245, 158, 11, 0.3)';
        strokeColor = '#f59e0b';
      } else if (zone.type === 'temporary_blockage') {
        fillColor = 'rgba(236, 72, 153, 0.5)';
        strokeColor = '#ec4899';
      } else if (zone.type === 'low_priority') {
        fillColor = 'rgba(100, 116, 139, 0.2)';
        strokeColor = '#64748b';
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;

      for (const cell of zone.cells) {
        const pos = gridToScreen(cell.x, cell.y);
        ctx.fillRect(pos.x + 1, pos.y + 1, zoom - 2, zoom - 2);
        ctx.strokeRect(pos.x + 1, pos.y + 1, zoom - 2, zoom - 2);

        // Badge indicator for extra patrol or one-time target
        if (zoom >= 20) {
          if (zone.type === 'extra_patrol') {
            ctx.fillStyle = '#c084fc';
            ctx.font = `bold ${Math.max(9, Math.floor(zoom * 0.4))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${zone.required_visits}x`, pos.x + zoom / 2, pos.y + zoom / 2);
          } else if (zone.type === 'temporary_blockage') {
            ctx.fillStyle = '#f43f5e';
            ctx.font = `bold ${Math.max(10, Math.floor(zoom * 0.5))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✕', pos.x + zoom / 2, pos.y + zoom / 2);
          }
        }
      }
    }

    // 5. Render Visited Trail (from simulation)
    if (simState && simState.visited_cells.length > 0) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      for (const pt of simState.visited_cells) {
        const pos = gridToScreen(pt.x, pt.y);
        ctx.fillRect(pos.x + 2, pos.y + 2, zoom - 4, zoom - 4);
      }
    }

    // 6. Render Walls / Physical Obstacles
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    for (const wall of mapData.walls) {
      const pos = gridToScreen(wall.x, wall.y);
      ctx.fillRect(pos.x, pos.y, zoom, zoom);
      ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, zoom - 1, zoom - 1);
    }

    // 7. Render Planned Route
    if (plan && plan.waypoints.length > 1) {
      const currIdx = simState ? simState.current_waypoint_index : 0;

      // Draw Visited Path segment
      if (currIdx > 0) {
        ctx.beginPath();
        ctx.lineWidth = Math.max(2, Math.floor(zoom * 0.15));
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)'; // dimmed
        ctx.setLineDash([4, 4]);
        const startPos = gridToScreen(plan.waypoints[0].x, plan.waypoints[0].y);
        ctx.moveTo(startPos.x + zoom / 2, startPos.y + zoom / 2);

        for (let i = 1; i <= Math.min(currIdx, plan.waypoints.length - 1); i++) {
          const pt = plan.waypoints[i];
          const pos = gridToScreen(pt.x, pt.y);
          ctx.lineTo(pos.x + zoom / 2, pos.y + zoom / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Remaining Planned Route
      ctx.beginPath();
      ctx.lineWidth = Math.max(3, Math.floor(zoom * 0.18));
      ctx.strokeStyle = '#06b6d4'; // bright cyan
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 6;

      const remainingStartIdx = Math.min(currIdx, plan.waypoints.length - 1);
      const remStart = gridToScreen(plan.waypoints[remainingStartIdx].x, plan.waypoints[remainingStartIdx].y);
      ctx.moveTo(remStart.x + zoom / 2, remStart.y + zoom / 2);

      for (let i = remainingStartIdx + 1; i < plan.waypoints.length; i++) {
        const pt = plan.waypoints[i];
        const pos = gridToScreen(pt.x, pt.y);
        ctx.lineTo(pos.x + zoom / 2, pos.y + zoom / 2);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Route waypoint nodes
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < plan.waypoints.length; i += Math.max(1, Math.floor(40 / zoom))) {
        const pt = plan.waypoints[i];
        const pos = gridToScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(pos.x + zoom / 2, pos.y + zoom / 2, Math.max(2, zoom * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 8. Render Checkpoints
    for (const cp of mapData.checkpoints) {
      const pos = gridToScreen(cp.position.x, cp.position.y);
      const cx = pos.x + zoom / 2;
      const cy = pos.y + zoom / 2;
      const r = Math.max(7, zoom * 0.38);

      // Checkpoint badge
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Checkpoint number
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.floor(r * 1.0))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = cp.order !== null && cp.order !== undefined ? `${cp.order}` : 'C';
      ctx.fillText(label, cx, cy);
    }

    // 9. Render Charging Dock
    const dockPos = gridToScreen(mapData.charging_dock.x, mapData.charging_dock.y);
    const dockCx = dockPos.x + zoom / 2;
    const dockCy = dockPos.y + zoom / 2;
    const dockR = Math.max(8, zoom * 0.42);

    ctx.fillStyle = '#059669';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dockCx, dockCy, dockR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Lightning bolt glyph
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, Math.floor(dockR * 1.1))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', dockCx, dockCy);

    // 10. Render Robot
    const robotPt = simState ? simState.current_pose.position : mapData.robot_start;
    const headingDeg = simState ? simState.current_pose.heading_deg : 0.0;
    const robotPos = gridToScreen(robotPt.x, robotPt.y);
    const rcx = robotPos.x + zoom / 2;
    const rcy = robotPos.y + zoom / 2;
    const robotR = Math.max(8, zoom * 0.42);

    // Robot body
    ctx.save();
    ctx.translate(rcx, rcy);
    ctx.rotate((headingDeg * Math.PI) / 180);

    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = simState?.is_running ? 10 : 3;

    ctx.beginPath();
    ctx.arc(0, 0, robotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Heading pointer arrow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(robotR * 0.8, 0);
    ctx.lineTo(-robotR * 0.5, -robotR * 0.5);
    ctx.lineTo(-robotR * 0.2, 0);
    ctx.lineTo(-robotR * 0.5, robotR * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 11. Render Drag-Selection Rectangle (when in zone_rect mode)
    if (dragStartCell && dragCurrentCell) {
      const minX = Math.min(dragStartCell.x, dragCurrentCell.x);
      const maxX = Math.max(dragStartCell.x, dragCurrentCell.x);
      const minY = Math.min(dragStartCell.y, dragCurrentCell.y);
      const maxY = Math.max(dragStartCell.y, dragCurrentCell.y);

      const rTopLeft = gridToScreen(minX, minY);
      const rW = (maxX - minX + 1) * zoom;
      const rH = (maxY - minY + 1) * zoom;

      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(rTopLeft.x, rTopLeft.y, rW, rH);
      ctx.strokeRect(rTopLeft.x, rTopLeft.y, rW, rH);
      ctx.setLineDash([]);
    }

    // 12. Render Hover Outline
    if (hoverCoord && !isPanning) {
      const hpos = gridToScreen(hoverCoord.x, hoverCoord.y);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(hpos.x + 1, hpos.y + 1, zoom - 2, zoom - 2);
    }

    // 13. Render Selected Cell Highlight
    if (selectedCell) {
      const spos = gridToScreen(selectedCell.x, selectedCell.y);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(spos.x + 1, spos.y + 1, zoom - 2, zoom - 2);
    }
  }, [
    mapData,
    plan,
    simState,
    selectedCell,
    zoom,
    panOffset,
    hoverCoord,
    dragStartCell,
    dragCurrentCell,
    gridToScreen,
    isPanning,
  ]);

  // Handle cell tool actions (brush, eraser, dock, start, checkpoints)
  const applyToolAtCell = useCallback(
    (cell: GridPoint) => {
      if (activeTool === 'wall') {
        const exists = mapData.walls.some((w) => w.x === cell.x && w.y === cell.y);
        if (!exists) {
          onMapChange({
            ...mapData,
            walls: [...mapData.walls, cell],
          });
        }
      } else if (activeTool === 'eraser') {
        const filteredWalls = mapData.walls.filter((w) => !(w.x === cell.x && w.y === cell.y));
        const filteredBlockages = mapData.zones.filter(
          (z) => !(z.type === 'temporary_blockage' && z.cells.some((c) => c.x === cell.x && c.y === cell.y))
        );
        onMapChange({
          ...mapData,
          walls: filteredWalls,
          zones: filteredBlockages,
        });
      } else if (activeTool === 'robot_start') {
        onMapChange({
          ...mapData,
          robot_start: cell,
        });
      } else if (activeTool === 'dock') {
        onMapChange({
          ...mapData,
          charging_dock: cell,
        });
      } else if (activeTool === 'checkpoint') {
        const nextOrder = mapData.checkpoints.length + 1;
        const newCp: Checkpoint = {
          id: `cp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: `Checkpoint ${nextOrder}`,
          position: cell,
          order: nextOrder,
          mandatory: true,
        };
        onMapChange({
          ...mapData,
          checkpoints: [...mapData.checkpoints, newCp],
        });
      } else if (activeTool === 'blockage') {
        const exists = mapData.zones.some(
          (z) => z.type === 'temporary_blockage' && z.cells.some((c) => c.x === cell.x && c.y === cell.y)
        );
        if (!exists) {
          const newBlockage = {
            id: `temp_block_${cell.x}_${cell.y}`,
            name: `Blockage (${cell.x}, ${cell.y})`,
            type: 'temporary_blockage' as ZoneType,
            cells: [cell],
            priority: 0,
            required_visits: 0,
            color: '#ec4899',
          };
          onMapChange({
            ...mapData,
            zones: [...mapData.zones, newBlockage],
          });
        }
      } else if (activeTool === 'select') {
        onSelectCell(cell);
      }
    },
    [activeTool, mapData, onMapChange, onSelectCell]
  );

  // Apply rectangular region selection to create a zone
  const applyZoneRegion = useCallback(
    (start: GridPoint, end: GridPoint) => {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      const cells: GridPoint[] = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          cells.push({ x, y });
        }
      }

      const zoneName = `${selectedZoneType.replace('_', ' ').toUpperCase()} Region`;
      const newZone = {
        id: `zone_${Date.now()}`,
        name: zoneName,
        type: selectedZoneType,
        cells,
        priority: selectedZoneType === 'high_priority_inspection' ? 8 : 2,
        required_visits: selectedZoneType === 'extra_patrol' ? 2 : 1,
      };

      onMapChange({
        ...mapData,
        zones: [...mapData.zones, newZone],
      });
    },
    [selectedZoneType, mapData, onMapChange]
  );

  // Mouse event listeners for drawing, panning, zooming
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle-click or Pan tool triggers panning
    if (e.button === 1 || activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (e.button !== 0) return; // Only process left click

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gridPt = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    if (!gridPt) return;

    if (activeTool === 'zone_rect') {
      setDragStartCell(gridPt);
      setDragCurrentCell(gridPt);
    } else {
      setIsDrawing(true);
      setLastGridPos(gridPt);
      applyToolAtCell(gridPt);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const gridPt = screenToGrid(mouseX, mouseY);
    setHoverCoord(gridPt);

    if (activeTool === 'zone_rect' && dragStartCell && gridPt) {
      setDragCurrentCell(gridPt);
    } else if (isDrawing && gridPt) {
      if (!lastGridPos || lastGridPos.x !== gridPt.x || lastGridPos.y !== gridPt.y) {
        setLastGridPos(gridPt);
        applyToolAtCell(gridPt);
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDrawing) {
      setIsDrawing(false);
      setLastGridPos(null);
    }
    if (activeTool === 'zone_rect' && dragStartCell && dragCurrentCell) {
      applyZoneRegion(dragStartCell, dragCurrentCell);
      setDragStartCell(null);
      setDragCurrentCell(null);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoom((prevZoom) => {
        const newZoom = Math.max(8, Math.min(80, prevZoom * zoomFactor));
        setPanOffset((prevPan) => {
          const newPanX = mouseX - (mouseX - prevPan.x) * (newZoom / prevZoom);
          const newPanY = mouseY - (mouseY - prevPan.y) * (newZoom / prevZoom);
          return { x: newPanX, y: newPanY };
        });
        return newZoom;
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isPanning || activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDrawing(false);
          setIsPanning(false);
          setHoverCoord(null);
          setDragStartCell(null);
          setDragCurrentCell(null);
        }}
      />

      {/* Coordinate & Zoom Readout HUD */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          backgroundColor: 'rgba(7, 11, 20, 0.88)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--border-subtle)',
          padding: '3px 8px',
          borderRadius: 3,
          display: 'flex',
          gap: 12,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div>
          GRID:{' '}
          <span style={{ color: 'var(--text-primary)' }}>
            {hoverCoord ? `${hoverCoord.x}, ${hoverCoord.y}` : '--, --'}
          </span>
        </div>
        <div>
          WORLD:{' '}
          <span style={{ color: '#06b6d4' }}>
            {hoverCoord
              ? `${(hoverCoord.x * mapData.resolution).toFixed(1)}m, ${(hoverCoord.y * mapData.resolution).toFixed(1)}m`
              : '--, --'}
          </span>
        </div>
        <div>
          SCALE: <span style={{ color: 'var(--text-primary)' }}>{Math.round((zoom / 24) * 100)}%</span>
        </div>
      </div>

      {/* Canvas Viewport Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          display: 'flex',
          gap: 2,
          backgroundColor: 'rgba(7, 11, 20, 0.88)',
          border: '1px solid var(--border-subtle)',
          padding: 2,
          borderRadius: 3,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.min(80, z * 1.25))}
          title="Zoom In"
          style={{ width: 24, height: 24, backgroundColor: 'var(--surface-subtle)', fontSize: 12 }}
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(8, z * 0.8))}
          title="Zoom Out"
          style={{ width: 24, height: 24, backgroundColor: 'var(--surface-subtle)', fontSize: 12 }}
        >
          -
        </button>
        <button
          onClick={fitMapToViewport}
          title="Fit Map to Viewport"
          style={{ padding: '0 6px', height: 24, backgroundColor: 'var(--surface-subtle)', fontSize: 10 }}
        >
          FIT
        </button>
      </div>
    </div>
  );
};
