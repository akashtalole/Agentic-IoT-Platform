import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AgentDecision, WsAgentDecision } from '../../core/models';

@Component({
  selector: 'app-decisions',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatExpansionModule, MatDialogModule,
  ],
  template: `
    <h1 class="page-title">Agent Decisions & Audit Trail</h1>

    <!-- Pending approvals banner -->
    @if (pendingApprovals().length) {
      <mat-card class="approval-banner">
        <mat-card-content>
          <mat-icon>gavel</mat-icon>
          <strong>{{ pendingApprovals().length }} decision(s) awaiting human approval</strong>
          @for (d of pendingApprovals(); track d.id) {
            <div class="approval-item">
              <span>{{ d.device_name }}: {{ d.action_taken }}</span>
              <div class="approval-actions">
                <button mat-raised-button color="primary" (click)="approve(d)">Approve</button>
                <button mat-raised-button color="warn" (click)="reject(d)">Reject</button>
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }

    <!-- Decisions table -->
    <mat-card>
      <mat-card-content>
        <mat-accordion multi>
          @for (d of decisions(); track d.id) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <div class="decision-row">
                    <span class="decision-device">{{ d.device_name }}</span>
                    <span class="decision-action">{{ d.action_taken }}</span>
                    <mat-chip [class]="'chip-' + d.status" size="small">{{ d.status }}</mat-chip>
                    <span class="decision-time">{{ d.timestamp | date:'short' }}</span>
                  </div>
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="decision-detail">
                <section>
                  <h4>Sensor Context</h4>
                  <pre>{{ d.sensor_context | json }}</pre>
                </section>
                <section>
                  <h4>Reasoning</h4>
                  <p class="reasoning-text">{{ d.reasoning_text || 'No reasoning recorded.' }}</p>
                </section>
                @if (d.tool_calls?.length) {
                  <section>
                    <h4>Tool Calls ({{ d.tool_calls.length }})</h4>
                    @for (tc of d.tool_calls; track tc.tool) {
                      <div class="tool-call">
                        <span class="tc-name">{{ tc.tool }}</span>
                        <pre class="tc-input">{{ tc.input | json }}</pre>
                        <div class="tc-result">→ {{ tc.result }}</div>
                      </div>
                    }
                  </section>
                }
                @if (d.status === 'waiting_approval') {
                  <div class="inline-approval">
                    <button mat-raised-button color="primary" (click)="approve(d)">
                      <mat-icon>check</mat-icon> Approve
                    </button>
                    <button mat-raised-button color="warn" (click)="reject(d)">
                      <mat-icon>close</mat-icon> Reject
                    </button>
                  </div>
                }
              </div>
            </mat-expansion-panel>
          }
        </mat-accordion>

        @if (!decisions().length) {
          <p class="empty-state">No decisions recorded yet.</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
    .approval-banner { background: #fff8e1; border-left: 4px solid #ff9800; margin-bottom: 16px; }
    .approval-banner mat-card-content { display: flex; flex-direction: column; gap: 10px; }
    .approval-banner mat-icon { color: #e65100; vertical-align: middle; margin-right: 8px; }
    .approval-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
    .approval-actions { display: flex; gap: 8px; }
    .decision-row { display: flex; align-items: center; gap: 12px; width: 100%; }
    .decision-device { font-weight: 700; min-width: 140px; }
    .decision-action { flex: 1; color: #444; font-size: 14px; }
    .decision-time { font-size: 12px; color: #999; white-space: nowrap; }
    .chip-executed { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .chip-waiting_approval { background: #fff8e1 !important; color: #e65100 !important; }
    .chip-error { background: #ffebee !important; color: #c62828 !important; }
    .chip-approved { background: #e3f2fd !important; color: #1565c0 !important; }
    .chip-rejected { background: #f3e5f5 !important; color: #6a1b9a !important; }
    .decision-detail { padding: 16px; }
    section { margin-bottom: 16px; }
    h4 { font-weight: 700; margin: 0 0 8px; color: #333; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow: auto; }
    .reasoning-text { line-height: 1.6; white-space: pre-wrap; }
    .tool-call { border-left: 3px solid #89b4fa; padding: 8px 12px; margin-bottom: 8px; background: #f8f8ff; border-radius: 0 4px 4px 0; }
    .tc-name { font-weight: 700; color: #1565c0; }
    .tc-input { font-size: 11px; margin: 4px 0; }
    .tc-result { font-size: 12px; color: #388e3c; }
    .inline-approval { display: flex; gap: 12px; margin-top: 16px; }
    .empty-state { color: #999; font-style: italic; padding: 24px 0; text-align: center; }
  `],
})
export class DecisionsComponent implements OnInit, OnDestroy {
  decisions = signal<AgentDecision[]>([]);
  pendingApprovals = signal<AgentDecision[]>([]);
  private subs: Subscription[] = [];

  constructor(private api: ApiService, private ws: WebSocketService) {}

  ngOnInit(): void {
    this.loadDecisions();
    this.subscribeWs();
  }

  private loadDecisions(): void {
    this.api.getDecisions({ ordering: '-timestamp' }).subscribe((res) => {
      this.decisions.set(res.results);
      this.pendingApprovals.set(res.results.filter((d) => d.status === 'waiting_approval'));
    });
  }

  private subscribeWs(): void {
    const sub = this.ws.connect('devices').subscribe((msg) => {
      if (msg.type === 'agent_decision') {
        this.loadDecisions();
      }
    });
    this.subs.push(sub);
  }

  approve(d: AgentDecision): void {
    this.api.approveDecision(d.id).subscribe(() => this.loadDecisions());
  }

  reject(d: AgentDecision): void {
    this.api.rejectDecision(d.id).subscribe(() => this.loadDecisions());
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
