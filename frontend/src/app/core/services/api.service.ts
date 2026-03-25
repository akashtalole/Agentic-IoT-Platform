import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AgentDecision, AgentSkill, Alert, Deployment, Device, DeviceAgent,
  DeviceGroup, HumanApprovalRequest, PaginatedResponse, SensorReading, Snapshot
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly BASE = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private url(path: string): string {
    return `${this.BASE}/${path}`;
  }

  // ─── Devices ────────────────────────────────────────────────────────────────

  getDevices(params?: Record<string, string>): Observable<PaginatedResponse<Device>> {
    return this.http.get<PaginatedResponse<Device>>(this.url('devices/'), { params });
  }

  getDevice(id: number): Observable<Device> {
    return this.http.get<Device>(this.url(`devices/${id}/`));
  }

  createDevice(data: Partial<Device>): Observable<Device> {
    return this.http.post<Device>(this.url('devices/'), data);
  }

  updateDevice(id: number, data: Partial<Device>): Observable<Device> {
    return this.http.patch<Device>(this.url(`devices/${id}/`), data);
  }

  deleteDevice(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`devices/${id}/`));
  }

  getDeviceGroups(): Observable<PaginatedResponse<DeviceGroup>> {
    return this.http.get<PaginatedResponse<DeviceGroup>>(this.url('device-groups/'));
  }

  // ─── Telemetry ─────────────────────────────────────────────────────────────

  getDeviceTelemetry(
    deviceId: string,
    params?: { sensor?: string; from?: string; to?: string }
  ): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(this.url(`devices/${deviceId}/telemetry/`), { params });
  }

  // ─── Agents ────────────────────────────────────────────────────────────────

  getAgentSkills(): Observable<PaginatedResponse<AgentSkill>> {
    return this.http.get<PaginatedResponse<AgentSkill>>(this.url('agent-skills/'));
  }

  createAgentSkill(data: Partial<AgentSkill>): Observable<AgentSkill> {
    return this.http.post<AgentSkill>(this.url('agent-skills/'), data);
  }

  updateAgentSkill(id: number, data: Partial<AgentSkill>): Observable<AgentSkill> {
    return this.http.patch<AgentSkill>(this.url(`agent-skills/${id}/`), data);
  }

  getDeviceAgents(): Observable<PaginatedResponse<DeviceAgent>> {
    return this.http.get<PaginatedResponse<DeviceAgent>>(this.url('agents/'));
  }

  runAgentCommand(agentId: number, command: string): Observable<{ reasoning_text: string; tool_calls: unknown[]; status: string }> {
    return this.http.post<any>(this.url(`agents/${agentId}/command/`), { command });
  }

  triggerAgentRun(agentId: number, sensorContext: Record<string, unknown> = {}): Observable<{ task_id: string; status: string }> {
    return this.http.post<any>(this.url(`agents/${agentId}/run/`), { sensor_context: sensorContext });
  }

  // ─── Decisions ─────────────────────────────────────────────────────────────

  getDecisions(params?: Record<string, string>): Observable<PaginatedResponse<AgentDecision>> {
    return this.http.get<PaginatedResponse<AgentDecision>>(this.url('decisions/'), { params });
  }

  getDecision(id: number): Observable<AgentDecision> {
    return this.http.get<AgentDecision>(this.url(`decisions/${id}/`));
  }

  approveDecision(id: number): Observable<AgentDecision> {
    return this.http.post<AgentDecision>(this.url(`decisions/${id}/approve/`), {});
  }

  rejectDecision(id: number): Observable<AgentDecision> {
    return this.http.post<AgentDecision>(this.url(`decisions/${id}/reject/`), {});
  }

  getAuditLog(params?: Record<string, string>): Observable<PaginatedResponse<unknown>> {
    return this.http.get<PaginatedResponse<unknown>>(this.url('audit-log/'), { params });
  }

  // ─── Alerts ────────────────────────────────────────────────────────────────

  getAlerts(params?: Record<string, string>): Observable<PaginatedResponse<Alert>> {
    return this.http.get<PaginatedResponse<Alert>>(this.url('alerts/'), { params });
  }

  resolveAlert(id: number): Observable<Alert> {
    return this.http.patch<Alert>(this.url(`alerts/${id}/resolve/`), {});
  }

  getPendingApprovals(): Observable<PaginatedResponse<HumanApprovalRequest>> {
    return this.http.get<PaginatedResponse<HumanApprovalRequest>>(this.url('approvals/'));
  }

  respondApproval(id: number, status: 'approved' | 'rejected', note = ''): Observable<HumanApprovalRequest> {
    return this.http.post<HumanApprovalRequest>(this.url(`approvals/${id}/respond/`), { status, note });
  }

  // ─── Snapshots & Deployments ────────────────────────────────────────────────

  getSnapshots(): Observable<PaginatedResponse<Snapshot>> {
    return this.http.get<PaginatedResponse<Snapshot>>(this.url('snapshots/'));
  }

  createSnapshot(data: { name: string; description: string }): Observable<Snapshot> {
    return this.http.post<Snapshot>(this.url('snapshots/'), data);
  }

  getDeployments(): Observable<PaginatedResponse<Deployment>> {
    return this.http.get<PaginatedResponse<Deployment>>(this.url('deployments/'));
  }

  createDeployment(data: { snapshot: number; device_group: number }): Observable<Deployment> {
    return this.http.post<Deployment>(this.url('deployments/'), data);
  }
}
