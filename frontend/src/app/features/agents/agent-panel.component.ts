import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { DeviceAgent, ToolCall } from '../../core/models';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

@Component({
  selector: 'app-agent-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatListModule,
    MatChipsModule, MatProgressSpinnerModule, MatExpansionModule,
  ],
  template: `
    <h1 class="page-title">Agent Control Panel</h1>

    <div class="panel-layout">
      <!-- Agent list sidebar -->
      <mat-card class="agent-list">
        <mat-card-header><mat-card-title>Device Agents</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (agent of agents(); track agent.id) {
            <div class="agent-item" [class.selected]="selectedAgent()?.id === agent.id"
                 (click)="selectAgent(agent)">
              <div class="agent-header">
                <span class="agent-device">{{ agent.device_name }}</span>
                <span class="agent-status-dot" [class]="'status-' + agent.status"></span>
              </div>
              <div class="agent-skill">{{ agent.skill_name }}</div>
              <div class="agent-last-run">
                {{ agent.last_run_at ? (agent.last_run_at | date:'short') : 'Never run' }}
              </div>
            </div>
          }
          @if (!agents().length) {
            <p class="empty-state">No device agents found.</p>
          }
        </mat-card-content>
      </mat-card>

      <!-- Chat interface -->
      @if (selectedAgent()) {
        <mat-card class="chat-panel">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>smart_toy</mat-icon>
              Agent: {{ selectedAgent()!.device_name }}
            </mat-card-title>
            <mat-card-subtitle>Skill: {{ selectedAgent()!.skill_name }} · Status:
              <span [class]="'status-text-' + selectedAgent()!.status">{{ selectedAgent()!.status }}</span>
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content class="chat-body">
            <div class="messages" #messagesEl>
              @if (!messages().length) {
                <div class="welcome-msg">
                  <mat-icon>chat</mat-icon>
                  <p>Send a natural language command to this device's agent.<br>
                  <em>Example: "What is the current temperature?" or "Turn off relay 1"</em></p>
                </div>
              }
              @for (msg of messages(); track msg.timestamp) {
                <div class="message" [class]="'role-' + msg.role">
                  <div class="message-role">
                    <mat-icon>{{ msg.role === 'user' ? 'person' : 'smart_toy' }}</mat-icon>
                    {{ msg.role === 'user' ? 'You' : 'Agent' }}
                  </div>
                  <div class="message-content">{{ msg.content }}</div>

                  @if (msg.toolCalls?.length) {
                    <mat-accordion class="tool-calls">
                      <mat-expansion-panel>
                        <mat-expansion-panel-header>
                          <mat-panel-title>
                            <mat-icon>build</mat-icon>
                            {{ msg.toolCalls!.length }} tool call(s)
                          </mat-panel-title>
                        </mat-expansion-panel-header>
                        @for (tc of msg.toolCalls; track tc.tool) {
                          <div class="tool-call-item">
                            <div class="tool-name">{{ tc.tool }}</div>
                            <pre class="tool-input">{{ tc.input | json }}</pre>
                            <div class="tool-result">→ {{ tc.result }}</div>
                          </div>
                        }
                      </mat-expansion-panel>
                    </mat-accordion>
                  }
                  <div class="message-time">{{ msg.timestamp | date:'HH:mm:ss' }}</div>
                </div>
              }

              @if (loading()) {
                <div class="thinking-indicator">
                  <mat-spinner diameter="20" />
                  <span>Agent is reasoning...</span>
                </div>
              }
            </div>
          </mat-card-content>

          <mat-card-actions class="chat-input">
            <mat-form-field appearance="outline" class="command-field">
              <mat-label>Send command to agent...</mat-label>
              <input matInput [(ngModel)]="command" (keydown.enter)="sendCommand()"
                     [disabled]="loading()" autocomplete="off" />
              <mat-icon matSuffix>send</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="sendCommand()"
                    [disabled]="!command.trim() || loading()">
              Send
            </button>
          </mat-card-actions>
        </mat-card>
      } @else {
        <mat-card class="chat-panel placeholder">
          <mat-card-content>
            <mat-icon>smart_toy</mat-icon>
            <p>Select a device agent from the list to start a conversation.</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
    .panel-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; height: calc(100vh - 160px); }
    .agent-list { overflow-y: auto; }
    .agent-item { padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; border: 1px solid #e0e0e0; transition: all 0.2s; }
    .agent-item:hover { background: #f5f5f5; }
    .agent-item.selected { border-color: #1565c0; background: #e3f2fd; }
    .agent-header { display: flex; justify-content: space-between; align-items: center; }
    .agent-device { font-weight: 600; font-size: 14px; }
    .agent-status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-active { background: #4caf50; }
    .status-paused { background: #ff9800; }
    .status-error { background: #f44336; }
    .status-waiting_approval { background: #9c27b0; }
    .agent-skill { font-size: 12px; color: #666; margin-top: 4px; }
    .agent-last-run { font-size: 11px; color: #999; margin-top: 2px; }
    .chat-panel { display: flex; flex-direction: column; height: 100%; }
    .chat-panel.placeholder { display: flex; align-items: center; justify-content: center; }
    .chat-panel.placeholder mat-card-content { text-align: center; color: #999; }
    .chat-panel.placeholder mat-icon { font-size: 64px; height: 64px; width: 64px; }
    .chat-body { flex: 1; overflow: hidden; }
    .messages { height: 100%; overflow-y: auto; padding: 0 4px; display: flex; flex-direction: column; gap: 12px; }
    .message { padding: 12px 16px; border-radius: 12px; max-width: 90%; }
    .role-user { background: #e3f2fd; align-self: flex-end; border-bottom-right-radius: 4px; }
    .role-assistant { background: #f3e5f5; align-self: flex-start; border-bottom-left-radius: 4px; }
    .message-role { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; margin-bottom: 6px; opacity: 0.7; }
    .message-content { white-space: pre-wrap; line-height: 1.5; }
    .message-time { font-size: 11px; color: #999; margin-top: 6px; text-align: right; }
    .thinking-indicator { display: flex; align-items: center; gap: 12px; padding: 12px; color: #666; font-style: italic; }
    .chat-input { display: flex; gap: 12px; align-items: flex-end; padding: 12px 16px; border-top: 1px solid #e0e0e0; }
    .command-field { flex: 1; }
    .welcome-msg { text-align: center; color: #999; padding: 40px; }
    .welcome-msg mat-icon { font-size: 48px; height: 48px; width: 48px; margin-bottom: 16px; }
    .tool-calls { margin-top: 12px; }
    .tool-call-item { margin-bottom: 8px; padding: 8px; background: #fafafa; border-radius: 4px; }
    .tool-name { font-weight: 700; font-size: 13px; color: #1565c0; }
    .tool-input { font-size: 11px; background: #f5f5f5; padding: 6px; border-radius: 4px; overflow: auto; }
    .tool-result { font-size: 12px; color: #388e3c; margin-top: 4px; }
    .status-text-active { color: #2e7d32; }
    .status-text-error { color: #c62828; }
    .status-text-paused { color: #e65100; }
    .empty-state { color: #999; font-style: italic; }
  `],
})
export class AgentPanelComponent implements OnInit, OnDestroy {
  agents = signal<DeviceAgent[]>([]);
  selectedAgent = signal<DeviceAgent | null>(null);
  messages = signal<ChatMessage[]>([]);
  command = '';
  loading = signal(false);

  private subs: Subscription[] = [];

  constructor(private api: ApiService, private ws: WebSocketService) {}

  ngOnInit(): void {
    this.api.getDeviceAgents().subscribe((res) => this.agents.set(res.results));
  }

  selectAgent(agent: DeviceAgent): void {
    this.selectedAgent.set(agent);
    this.messages.set([]);
  }

  sendCommand(): void {
    const cmd = this.command.trim();
    if (!cmd || !this.selectedAgent() || this.loading()) return;

    this.messages.update((prev) => [
      ...prev,
      { role: 'user', content: cmd, timestamp: new Date() },
    ]);
    this.command = '';
    this.loading.set(true);

    this.api.runAgentCommand(this.selectedAgent()!.id, cmd).subscribe({
      next: (res) => {
        this.messages.update((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.reasoning_text || 'Command processed.',
            toolCalls: res.tool_calls as ToolCall[],
            timestamp: new Date(),
          },
        ]);
        this.loading.set(false);
      },
      error: (err) => {
        this.messages.update((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${err.error?.detail || err.message}`, timestamp: new Date() },
        ]);
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
