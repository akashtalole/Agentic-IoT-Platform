import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Alert, Device, WsAgentDecision, WsAlert, WsMessage } from '../../core/models';

interface KPI { label: string; value: string | number; icon: string; color: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatChipsModule, MatTableModule, RouterLink],
  template: `
    <h1 class="page-title">Fleet Dashboard</h1>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      @for (kpi of kpis(); track kpi.label) {
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-icon" [style.color]="kpi.color">
              <mat-icon>{{ kpi.icon }}</mat-icon>
            </div>
            <div class="kpi-value">{{ kpi.value }}</div>
            <div class="kpi-label">{{ kpi.label }}</div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <div class="grid-2col">
      <!-- Recent Decisions Feed -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>fact_check</mat-icon> Recent Agent Decisions
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (recentDecisions().length === 0) {
            <p class="empty-state">No decisions yet. Waiting for agent activity...</p>
          }
          @for (d of recentDecisions(); track d.decision_id) {
            <div class="decision-item">
              <div class="decision-header">
                <span class="device-name">{{ d.device_id }}</span>
                <span class="decision-time">{{ d.timestamp | date:'HH:mm:ss' }}</span>
              </div>
              <div class="action-taken">{{ d.action_taken }}</div>
              <div class="reasoning-preview">{{ d.reasoning_text }}</div>
              <div class="tool-count">{{ d.tool_calls_count }} tool calls</div>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- Active Alerts -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>notifications_active</mat-icon> Active Alerts
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (activeAlerts().length === 0) {
            <p class="empty-state">No active alerts.</p>
          }
          @for (alert of activeAlerts(); track alert.id) {
            <div class="alert-item" [class]="'severity-' + alert.severity">
              <mat-icon>{{ severityIcon(alert.severity) }}</mat-icon>
              <div class="alert-body">
                <div class="alert-device">{{ alert.device_name }}</div>
                <div class="alert-message">{{ alert.message }}</div>
              </div>
              <mat-chip [color]="severityColor(alert.severity)" highlighted>
                {{ alert.severity }}
              </mat-chip>
            </div>
          }
          <a mat-button routerLink="/alerts">View all alerts →</a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card mat-card-content { text-align: center; padding: 16px; }
    .kpi-icon mat-icon { font-size: 36px; height: 36px; width: 36px; }
    .kpi-value { font-size: 32px; font-weight: 700; margin: 8px 0; }
    .kpi-label { font-size: 13px; color: #666; }
    .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .empty-state { color: #999; font-size: 14px; padding: 16px 0; }
    .decision-item { border-left: 3px solid #89b4fa; padding: 8px 12px; margin-bottom: 12px; background: #f8f8ff; border-radius: 0 4px 4px 0; }
    .decision-header { display: flex; justify-content: space-between; font-size: 12px; color: #666; }
    .action-taken { font-weight: 600; margin: 4px 0; }
    .reasoning-preview { font-size: 13px; color: #444; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tool-count { font-size: 12px; color: #999; margin-top: 4px; }
    .alert-item { display: flex; align-items: center; gap: 12px; padding: 10px; margin-bottom: 8px; border-radius: 4px; }
    .severity-critical { background: #ffebee; }
    .severity-warning { background: #fff8e1; }
    .severity-info { background: #e3f2fd; }
    .alert-device { font-weight: 600; font-size: 13px; }
    .alert-message { font-size: 13px; color: #444; }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  kpis = signal<KPI[]>([]);
  recentDecisions = signal<WsAgentDecision[]>([]);
  activeAlerts = signal<Alert[]>([]);

  private subs: Subscription[] = [];

  constructor(private api: ApiService, private ws: WebSocketService) {}

  ngOnInit(): void {
    this.loadData();
    this.connectWebSocket();
  }

  private loadData(): void {
    this.api.getDevices().subscribe((res) => {
      const online = res.results.filter((d) => d.status === 'online').length;
      const total = res.count;
      this.updateKPIs(online, total);
    });

    this.api.getAlerts({ is_resolved: 'false' }).subscribe((res) => {
      this.activeAlerts.set(res.results.slice(0, 5));
    });
  }

  private updateKPIs(online: number, total: number): void {
    this.kpis.set([
      { label: 'Online Devices', value: online, icon: 'devices', color: '#4caf50' },
      { label: 'Total Devices', value: total, icon: 'router', color: '#2196f3' },
      { label: 'Active Alerts', value: this.activeAlerts().length, icon: 'warning', color: '#ff9800' },
      { label: 'Decisions Today', value: '—', icon: 'smart_toy', color: '#9c27b0' },
    ]);
  }

  private connectWebSocket(): void {
    const sub = this.ws.connect('devices').subscribe((msg: WsMessage) => {
      if (msg.type === 'agent_decision') {
        const d = msg as WsAgentDecision;
        this.recentDecisions.update((prev) => [d, ...prev].slice(0, 10));
      }
      if (msg.type === 'alert') {
        this.loadData();
      }
    });
    this.subs.push(sub);
  }

  severityIcon(severity: string): string {
    return { critical: 'error', warning: 'warning', info: 'info' }[severity] ?? 'info';
  }

  severityColor(severity: string): 'warn' | 'accent' | 'primary' {
    return { critical: 'warn', warning: 'accent', info: 'primary' }[severity] as any ?? 'primary';
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
