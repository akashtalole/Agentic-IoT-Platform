import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Alert, HumanApprovalRequest, WsAlert, WsApprovalRequest } from '../../core/models';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatTabsModule, MatInputModule,
    MatFormFieldModule, MatDialogModule, MatBadgeModule,
  ],
  template: `
    <h1 class="page-title">Alerts & Approvals</h1>

    <mat-tab-group [selectedIndex]="activeTab()" (selectedIndexChange)="activeTab.set($event)">

      <!-- Alerts Tab -->
      <mat-tab>
        <ng-template mat-tab-label>
          <mat-icon>notifications</mat-icon>
          Alerts
          @if (unresolvedCount()) {
            <span class="tab-badge">{{ unresolvedCount() }}</span>
          }
        </ng-template>

        <div class="tab-content">
          <!-- Filter row -->
          <div class="filter-row">
            <button mat-stroked-button [class.active-filter]="alertFilter() === 'all'"
                    (click)="setAlertFilter('all')">All</button>
            <button mat-stroked-button [class.active-filter]="alertFilter() === 'critical'"
                    (click)="setAlertFilter('critical')">
              <span class="severity-dot severity-critical"></span> Critical
            </button>
            <button mat-stroked-button [class.active-filter]="alertFilter() === 'warning'"
                    (click)="setAlertFilter('warning')">
              <span class="severity-dot severity-warning"></span> Warning
            </button>
            <button mat-stroked-button [class.active-filter]="alertFilter() === 'info'"
                    (click)="setAlertFilter('info')">
              <span class="severity-dot severity-info"></span> Info
            </button>
            <div class="spacer"></div>
            <button mat-stroked-button [class.active-filter]="showResolved()"
                    (click)="showResolved.set(!showResolved()); loadAlerts()">
              <mat-icon>history</mat-icon> {{ showResolved() ? 'Hide' : 'Show' }} Resolved
            </button>
          </div>

          @for (alert of filteredAlerts(); track alert.id) {
            <mat-card class="alert-card" [class]="'severity-card-' + alert.severity">
              <mat-card-content>
                <div class="alert-header">
                  <div class="alert-meta">
                    <span class="severity-badge" [class]="'severity-' + alert.severity">
                      <mat-icon>{{ severityIcon(alert.severity) }}</mat-icon>
                      {{ alert.severity | uppercase }}
                    </span>
                    <span class="alert-device">{{ alert.device_name }}</span>
                    <span class="alert-time">{{ alert.created_at | date:'short' }}</span>
                  </div>
                  <div class="alert-actions">
                    @if (!alert.resolved_at) {
                      <button mat-stroked-button color="primary" (click)="resolveAlert(alert)">
                        <mat-icon>check_circle</mat-icon> Resolve
                      </button>
                    } @else {
                      <span class="resolved-badge">
                        <mat-icon>check</mat-icon> Resolved {{ alert.resolved_at | date:'short' }}
                      </span>
                    }
                  </div>
                </div>
                <p class="alert-message">{{ alert.message }}</p>
              </mat-card-content>
            </mat-card>
          }

          @if (!filteredAlerts().length) {
            <mat-card>
              <mat-card-content>
                <p class="empty-state">
                  <mat-icon>check_circle</mat-icon>
                  No alerts found.
                </p>
              </mat-card-content>
            </mat-card>
          }
        </div>
      </mat-tab>

      <!-- Human Approvals Tab -->
      <mat-tab>
        <ng-template mat-tab-label>
          <mat-icon>gavel</mat-icon>
          Pending Approvals
          @if (pendingApprovals().length) {
            <span class="tab-badge urgent">{{ pendingApprovals().length }}</span>
          }
        </ng-template>

        <div class="tab-content">
          @if (pendingApprovals().length) {
            <div class="approval-notice">
              <mat-icon>warning</mat-icon>
              <strong>{{ pendingApprovals().length }} action(s) require your approval before the agent can proceed.</strong>
            </div>
          }

          @for (req of pendingApprovals(); track req.id) {
            <mat-card class="approval-card">
              <mat-card-content>
                <div class="approval-header">
                  <div>
                    <span class="approval-device">{{ req.device_name }}</span>
                    <span class="approval-time">Requested {{ req.created_at | date:'short' }}</span>
                    @if (isExpiringSoon(req)) {
                      <span class="expiry-warning">
                        <mat-icon>timer</mat-icon> Expires {{ req.expires_at | date:'short' }}
                      </span>
                    }
                  </div>
                </div>

                <div class="approval-body">
                  <section>
                    <h4>Proposed Action</h4>
                    <p class="proposed-action">{{ req.proposed_action }}</p>
                  </section>
                  <section>
                    <h4>Reason</h4>
                    <p class="reason-text">{{ req.reason }}</p>
                  </section>
                </div>

                <div class="approval-response">
                  <mat-form-field appearance="outline" class="reason-field">
                    <mat-label>Response note (optional)</mat-label>
                    <input matInput [(ngModel)]="approvalNotes[req.id]" placeholder="Add a note..." />
                  </mat-form-field>
                  <div class="approval-btns">
                    <button mat-raised-button color="primary" (click)="respondApproval(req, 'approved')">
                      <mat-icon>check</mat-icon> Approve
                    </button>
                    <button mat-raised-button color="warn" (click)="respondApproval(req, 'rejected')">
                      <mat-icon>close</mat-icon> Reject
                    </button>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          }

          @if (!pendingApprovals().length) {
            <mat-card>
              <mat-card-content>
                <p class="empty-state">
                  <mat-icon>gavel</mat-icon>
                  No pending approvals.
                </p>
              </mat-card-content>
            </mat-card>
          }

          <!-- Approval history -->
          @if (approvalHistory().length) {
            <h3 class="section-title">Recent Decisions</h3>
            @for (req of approvalHistory(); track req.id) {
              <mat-card class="history-card">
                <mat-card-content>
                  <div class="history-row">
                    <span class="approval-device">{{ req.device_name }}</span>
                    <span class="history-action">{{ req.proposed_action }}</span>
                    <span class="history-status" [class]="'status-' + req.status">{{ req.status }}</span>
                    <span class="approval-time">{{ req.responded_at | date:'short' }}</span>
                  </div>
                </mat-card-content>
              </mat-card>
            }
          }
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
    .tab-content { padding: 20px 0; display: flex; flex-direction: column; gap: 12px; }
    .tab-badge { display: inline-flex; align-items: center; justify-content: center; background: #f44336; color: white; border-radius: 10px; min-width: 20px; height: 20px; font-size: 11px; font-weight: 700; padding: 0 5px; margin-left: 6px; }
    .tab-badge.urgent { background: #e65100; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .filter-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 4px; }
    .spacer { flex: 1; }
    .active-filter { background: #e3f2fd !important; border-color: #1565c0 !important; }

    .severity-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .severity-dot.severity-critical { background: #c62828; }
    .severity-dot.severity-warning { background: #f57f17; }
    .severity-dot.severity-info { background: #1565c0; }

    .alert-card { border-left: 4px solid #ccc; }
    .severity-card-critical { border-left-color: #c62828 !important; background: #fff8f8 !important; }
    .severity-card-warning { border-left-color: #f57f17 !important; background: #fffdf0 !important; }
    .severity-card-info { border-left-color: #1565c0 !important; }

    .alert-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .alert-meta { display: flex; align-items: center; gap: 12px; }
    .severity-badge { display: flex; align-items: center; gap: 4px; font-weight: 700; font-size: 12px; padding: 3px 8px; border-radius: 12px; }
    .severity-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .severity-critical { background: #ffebee; color: #c62828; }
    .severity-warning { background: #fff8e1; color: #f57f17; }
    .severity-info { background: #e3f2fd; color: #1565c0; }
    .alert-device { font-weight: 600; font-size: 14px; }
    .alert-time { font-size: 12px; color: #999; }
    .alert-message { margin: 0; line-height: 1.5; color: #333; }
    .alert-actions { flex-shrink: 0; }
    .resolved-badge { display: flex; align-items: center; gap: 4px; color: #2e7d32; font-size: 13px; }

    .approval-notice { display: flex; align-items: center; gap: 10px; background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 4px; font-weight: 600; color: #e65100; }
    .approval-notice mat-icon { color: #ff9800; }

    .approval-card { border: 2px solid #ff9800; }
    .approval-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .approval-device { font-weight: 700; font-size: 16px; display: block; }
    .approval-time { font-size: 12px; color: #999; display: block; margin-top: 2px; }
    .expiry-warning { display: flex; align-items: center; gap: 4px; color: #c62828; font-size: 12px; margin-top: 4px; }
    .expiry-warning mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .approval-body { margin-bottom: 16px; }
    section { margin-bottom: 12px; }
    h4 { font-weight: 700; color: #555; margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .proposed-action { font-size: 16px; font-weight: 600; color: #1a1a1a; margin: 0; }
    .reason-text { color: #444; line-height: 1.5; margin: 0; }
    .approval-response { display: flex; align-items: flex-end; gap: 16px; }
    .reason-field { flex: 1; }
    .approval-btns { display: flex; gap: 8px; margin-bottom: 22px; }

    .section-title { font-size: 16px; font-weight: 600; color: #666; margin: 8px 0 4px; }
    .history-card { opacity: 0.8; }
    .history-row { display: flex; align-items: center; gap: 16px; }
    .history-action { flex: 1; font-size: 13px; color: #444; }
    .history-status { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-rejected { background: #ffebee; color: #c62828; }
    .status-expired { background: #f5f5f5; color: #757575; }

    .empty-state { color: #999; font-style: italic; text-align: center; padding: 32px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.4; }
  `],
})
export class AlertsComponent implements OnInit, OnDestroy {
  alerts = signal<Alert[]>([]);
  pendingApprovals = signal<HumanApprovalRequest[]>([]);
  approvalHistory = signal<HumanApprovalRequest[]>([]);
  activeTab = signal(0);
  alertFilter = signal<'all' | 'critical' | 'warning' | 'info'>('all');
  showResolved = signal(false);
  approvalNotes: Record<number, string> = {};

  private subs: Subscription[] = [];

  constructor(private api: ApiService, private ws: WebSocketService) {}

  ngOnInit(): void {
    this.loadAlerts();
    this.loadApprovals();
    this.subscribeWs();
  }

  loadAlerts(): void {
    const params: Record<string, string> = {};
    if (!this.showResolved()) params['resolved'] = 'false';
    this.api.getAlerts(params).subscribe((res) => this.alerts.set(res.results));
  }

  private loadApprovals(): void {
    this.api.getPendingApprovals().subscribe((res) => {
      this.pendingApprovals.set(res.results.filter((r) => r.status === 'pending'));
      this.approvalHistory.set(res.results.filter((r) => r.status !== 'pending'));
    });
  }

  private subscribeWs(): void {
    const sub = this.ws.connect('alerts').subscribe((msg) => {
      if (msg.type === 'new_alert') {
        this.loadAlerts();
      } else if (msg.type === 'approval_request') {
        this.loadApprovals();
        // Switch to approvals tab to draw operator attention
        this.activeTab.set(1);
      }
    });
    this.subs.push(sub);
  }

  filteredAlerts(): Alert[] {
    const filter = this.alertFilter();
    const all = this.alerts();
    return filter === 'all' ? all : all.filter((a) => a.severity === filter);
  }

  unresolvedCount(): number {
    return this.alerts().filter((a) => !a.resolved_at).length;
  }

  setAlertFilter(f: 'all' | 'critical' | 'warning' | 'info'): void {
    this.alertFilter.set(f);
  }

  resolveAlert(alert: Alert): void {
    this.api.resolveAlert(alert.id).subscribe(() => this.loadAlerts());
  }

  respondApproval(req: HumanApprovalRequest, action: 'approved' | 'rejected'): void {
    const note = this.approvalNotes[req.id] || '';
    this.api.respondApproval(req.id, action, note).subscribe(() => {
      delete this.approvalNotes[req.id];
      this.loadApprovals();
    });
  }

  isExpiringSoon(req: HumanApprovalRequest): boolean {
    if (!req.expires_at) return false;
    return new Date(req.expires_at).getTime() - Date.now() < 30 * 60 * 1000; // 30 min
  }

  severityIcon(severity: string): string {
    return { critical: 'error', warning: 'warning', info: 'info' }[severity] ?? 'notifications';
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
