import type {
  MapData,
  MissionPlan,
  RobotConfig,
  MissionConfig,
  GridPoint,
  SimulationState,
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && data.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // Ignore JSON parse error on non-JSON response
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string; version: string; timestamp: string }>(res);
  },

  async listMaps() {
    const res = await fetch(`${API_BASE}/maps`);
    return handleResponse<Array<{ id: string; name: string; width: number; height: number; resolution: number; checkpoint_count: number; zone_count: number }>>(res);
  },

  async getDefaultSampleMap() {
    const res = await fetch(`${API_BASE}/maps/sample/default`);
    return handleResponse<MapData>(res);
  },

  async getMap(mapId: string) {
    const res = await fetch(`${API_BASE}/maps/${encodeURIComponent(mapId)}`);
    return handleResponse<MapData>(res);
  },

  async saveMap(mapData: MapData) {
    const res = await fetch(`${API_BASE}/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapData),
    });
    return handleResponse<MapData>(res);
  },

  async deleteMap(mapId: string) {
    const res = await fetch(`${API_BASE}/maps/${encodeURIComponent(mapId)}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async validateMap(mapData: MapData) {
    const res = await fetch(`${API_BASE}/maps/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapData),
    });
    return handleResponse<{ is_valid: boolean; message: string }>(res);
  },

  async planMission(params: {
    map_data: MapData;
    robot_config?: RobotConfig;
    mission_config?: MissionConfig;
    allow_diagonal?: boolean;
    clearance_cells?: number;
    current_battery_pct?: number;
    current_robot_position?: GridPoint;
    completed_task_counts?: Record<string, number>;
  }) {
    const res = await fetch(`${API_BASE}/plan/mission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<MissionPlan>(res);
  },

  async initSimulation(params: { map_data: MapData; robot_config?: RobotConfig; plan?: MissionPlan }) {
    const res = await fetch(`${API_BASE}/simulation/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<SimulationState>(res);
  },

  async getSimulationState() {
    const res = await fetch(`${API_BASE}/simulation/state`);
    return handleResponse<SimulationState>(res);
  },

  async startSimulation() {
    const res = await fetch(`${API_BASE}/simulation/start`, { method: 'POST' });
    return handleResponse<SimulationState>(res);
  },

  async pauseSimulation() {
    const res = await fetch(`${API_BASE}/simulation/pause`, { method: 'POST' });
    return handleResponse<SimulationState>(res);
  },

  async resumeSimulation() {
    const res = await fetch(`${API_BASE}/simulation/resume`, { method: 'POST' });
    return handleResponse<SimulationState>(res);
  },

  async stopSimulation() {
    const res = await fetch(`${API_BASE}/simulation/stop`, { method: 'POST' });
    return handleResponse<SimulationState>(res);
  },

  async resetSimulation() {
    const res = await fetch(`${API_BASE}/simulation/reset`, { method: 'POST' });
    return handleResponse<SimulationState>(res);
  },

  async stepSimulation(steps: number = 1) {
    const res = await fetch(`${API_BASE}/simulation/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps }),
    });
    return handleResponse<SimulationState>(res);
  },

  async setSimulationSpeed(speed_multiplier: number) {
    const res = await fetch(`${API_BASE}/simulation/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed_multiplier }),
    });
    return handleResponse<SimulationState>(res);
  },

  async addBlockage(x: number, y: number, name?: string) {
    const res = await fetch(`${API_BASE}/simulation/blockages/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, name }),
    });
    return handleResponse<SimulationState>(res);
  },

  async removeBlockage(x: number, y: number) {
    const res = await fetch(`${API_BASE}/simulation/blockages/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
    return handleResponse<SimulationState>(res);
  },

  async replanSimulation() {
    const res = await fetch(`${API_BASE}/simulation/replan`, { method: 'POST' });
    return handleResponse<MissionPlan>(res);
  },

  async exportWebots(map_data: MapData, plan: MissionPlan, target_speed_m_s: number = 1.0) {
    const res = await fetch(`${API_BASE}/adapters/webots/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map_data, plan, target_speed_m_s }),
    });
    return handleResponse<any>(res);
  },
};
