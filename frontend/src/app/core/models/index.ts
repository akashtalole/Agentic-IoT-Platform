// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'operator' | 'viewer';
  team: string;
  avatar_url: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export type DeviceStatus = 'online' | 'offline' | 'error' | 'provisioning';
export type DeviceType = 'raspberry_pi' | 'jetson' | 'esp32' | 'industrial' | 'simulated' | 'other';

export interface DeviceGroup {
  id: number;
  name: string;
  description: string;
  device_count: number;
  created_at: string;
}

export interface Sensor {
  id: number;
  name: string;
  display_name: string;
  unit: string;
  data_type: string;
  last_value: unknown;
  last_updated: string;
}

export interface Actuator {
  id: number;
  name: string;
  display_name: string;
  actuator_type: string;
  state: Record<string, unknown>;
  last_command_at: string;
}

export interface Device {
  id: number;
  device_id: string;
  name: string;
  group: number | null;
  group_name: string;
  device_type: DeviceType;
  location: string;
  status: DeviceStatus;
  last_heartbeat: string;
  firmware_version: string;
  metadata: Record<string, unknown>;
  capabilities: unknown[];
  mqtt_topic_prefix: string;
  registered_at: string;
  updated_at: string;
  sensors?: Sensor[];
  actuators?: Actuator[];
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface SensorReading {
  id: number;
  device: number;
  sensor_name: string;
  value: number | null;
  raw_payload: unknown;
  timestamp: string;
  quality_flag: string;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface AgentSkill {
  id: number;
  name: string;
  description: string;
  version: string;
  model: string;
  system_prompt: string;
  tool_definitions: unknown[];
  max_tokens: number;
  enable_thinking: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceAgent {
  id: number;
  device: number;
  device_name: string;
  skill: number;
  skill_name: string;
  status: 'active' | 'paused' | 'error' | 'waiting_approval';
  last_run_at: string;
  config_overrides: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Decisions ───────────────────────────────────────────────────────────────

export type DecisionStatus = 'pending' | 'executed' | 'waiting_approval' | 'approved' | 'rejected' | 'error';

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  result: string;
}

export interface AgentDecision {
  id: number;
  device: number;
  device_name: string;
  agent: number;
  timestamp: string;
  sensor_context: Record<string, unknown>;
  reasoning_text: string;
  tool_calls: ToolCall[];
  action_taken: string;
  status: DecisionStatus;
  approved_by: number | null;
  approval_timestamp: string | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: number;
  device: number;
  device_name: string;
  decision: number | null;
  severity: AlertSeverity;
  message: string;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: number | null;
  created_at: string;
}

export interface HumanApprovalRequest {
  id: number;
  device: number;
  device_name: string;
  decision: number | null;
  proposed_action: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  responder: number | null;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// ─── Deployments ─────────────────────────────────────────────────────────────

export interface Snapshot {
  id: number;
  name: string;
  description: string;
  skills: string[];
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

export interface Deployment {
  id: number;
  snapshot: number;
  snapshot_name: string;
  device_group: number;
  group_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  deployed_at: string;
  deployed_by: number | null;
  deployed_by_name: string;
  rollback_snapshot_id: number | null;
}

// ─── WebSocket Messages ────────────────────────────────────────────────────────

export interface WsDeviceStatus {
  type: 'device_status';
  device_id: string;
  status: DeviceStatus;
}

export interface WsSensorReading {
  type: 'sensor_reading';
  device_id: string;
  sensor_name: string;
  value: number | null;
  timestamp: string;
}

export interface WsAgentDecision {
  type: 'agent_decision';
  decision_id: number;
  device_id: string;
  reasoning_text: string;
  action_taken: string;
  tool_calls_count: number;
  timestamp: string;
}

export interface WsAlert {
  type: 'alert';
  device_id: string;
  device_name: string;
  severity: AlertSeverity;
  message: string;
}

export interface WsApprovalRequest {
  type: 'approval_request';
  request_id: number;
  device_id: string;
  device_name: string;
  proposed_action: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

export type WsMessage = WsDeviceStatus | WsSensorReading | WsAgentDecision | WsAlert | WsApprovalRequest;

// ─── API Pagination ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
