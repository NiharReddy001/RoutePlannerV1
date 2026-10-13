export interface GridPoint {
  x: number;
  y: number;
}

export type ZoneType =
  | 'restricted'
  | 'standard_patrol'
  | 'extra_patrol'
  | 'high_priority_inspection'
  | 'low_priority'
  | 'one_time_inspection'
  | 'temporary_blockage';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  cells: GridPoint[];
  priority: number;
  required_visits: number;
  color?: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  position: GridPoint;
  order?: number;
  mandatory: boolean;
}

export interface UnderlayImage {
  filename?: string;
  data_url?: string;
  opacity: number;
  scale: number;
  offset_x: number;
  offset_y: number;
}

export interface MapData {
  id: string;
  name: string;
  schema_version: string;
  width: number;
  height: number;
  resolution: number;
  walls: GridPoint[];
  zones: Zone[];
  robot_start: GridPoint;
  charging_dock: GridPoint;
  checkpoints: Checkpoint[];
  underlay?: UnderlayImage;
}

export type RobotStatus =
  | 'idle'
  | 'navigating'
  | 'patrolling'
  | 'returning_to_dock'
  | 'docked'
  | 'paused'
  | 'out_of_battery'
  | 'blocked';

export interface RobotConfig {
  battery_capacity_pct: number;
  consumption_per_meter: number;
  safety_reserve_pct: number;
  speed_m_s: number;
  charging_rate_pct_s: number;
  clearance_cells: number;
  allow_diagonal: boolean;
}

export interface RobotPose {
  position: GridPoint;
  heading_deg: number;
}

export interface RobotTelemetry {
  pose: RobotPose;
  battery_pct: number;
  status: RobotStatus;
  is_charging: boolean;
  is_docked: boolean;
  distance_traveled_m: number;
  current_step_index: number;
  total_steps: number;
}

export interface MissionConfig {
  fixed_checkpoint_order: boolean;
  required_checkpoints: string[];
  required_patrol_coverage_pct: number;
  extra_patrol_multiplier: number;
  priority_weights: Record<string, number>;
  enforce_return_to_dock: boolean;
}

export type TaskType =
  | 'checkpoint'
  | 'high_priority_inspection'
  | 'standard_patrol'
  | 'extra_patrol'
  | 'one_time_inspection'
  | 'low_priority'
  | 'return_to_dock';

export interface MissionTask {
  id: string;
  task_type: TaskType;
  target_position: GridPoint;
  target_name: string;
  zone_id?: string;
  priority: number;
  required_visits: number;
  completed_visits: number;
  is_completed: boolean;
  is_unreachable: boolean;
  unreachable_reason?: string;
}

export interface RouteLeg {
  leg_index: number;
  from_point: GridPoint;
  to_point: GridPoint;
  path: GridPoint[];
  distance_m: number;
  task_id?: string;
  task_type: TaskType;
  description: string;
}

export interface MissionPlan {
  plan_id: string;
  algorithm_name: string;
  is_feasible: boolean;
  waypoints: GridPoint[];
  legs: RouteLeg[];
  tasks: MissionTask[];
  total_distance_m: number;
  estimated_duration_s: number;
  estimated_battery_used_pct: number;
  estimated_final_battery_pct: number;
  planning_time_ms: number;
  coverage_percentage: number;
  dock_reachable: boolean;
  warnings: string[];
  unreachable_tasks: string[];
  created_at: string;
}

export interface SimulationEvent {
  id: string;
  timestamp: string;
  event_type: string;
  message: string;
  details?: Record<string, string>;
}

export interface SimulationState {
  is_running: boolean;
  is_paused: boolean;
  is_completed: boolean;
  status: RobotStatus;
  current_waypoint_index: number;
  total_waypoints: number;
  current_pose: RobotPose;
  battery_pct: number;
  is_charging: boolean;
  is_docked: boolean;
  distance_traveled_m: number;
  simulation_speed: number;
  completed_task_ids: Record<string, number>;
  visited_cells: GridPoint[];
  recent_events: SimulationEvent[];
}

export type ToolMode =
  | 'select'
  | 'wall'
  | 'eraser'
  | 'zone_rect'
  | 'checkpoint'
  | 'robot_start'
  | 'dock'
  | 'blockage'
  | 'pan';
