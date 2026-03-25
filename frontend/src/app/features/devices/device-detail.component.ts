import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Device, SensorReading, WsSensorReading } from '../../core/models';

@Component({
  selector: 'app-device-detail',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatTabsModule, MatIconModule,
    MatChipsModule, MatButtonModule, MatProgressBarModule,
  ],
  template: `
    @if (device()) {
      <div class="page-header">
        <div>
          <h1>{{ device()!.name }}</h1>
          <span class="device-uuid">{{ device()!.device_id }}</span>
        </div>
        <div class="status-badge" [class]="'status-' + device()!.status">
          <span class="status-dot"></span>{{ device()!.status }}
        </div>
      </div>

      <mat-tab-group>

        <!-- Overview Tab -->
        <mat-tab label="Overview">
          <div class="tab-content">
            <div class="info-grid">
              <mat-card>
                <mat-card-header><mat-card-title>Device Info</mat-card-title></mat-card-header>
                <mat-card-content>
                  <dl class="info-list">
                    <dt>Type</dt><dd>{{ device()!.device_type }}</dd>
                    <dt>Location</dt><dd>{{ device()!.location || '—' }}</dd>
                    <dt>Group</dt><dd>{{ device()!.group_name || '—' }}</dd>
                    <dt>Firmware</dt><dd>{{ device()!.firmware_version || '—' }}</dd>
                    <dt>Last Seen</dt>
                    <dd>{{ device()!.last_heartbeat ? (device()!.last_heartbeat | date:'medium') : 'Never' }}</dd>
                  </dl>
                </mat-card-content>
              </mat-card>

              <mat-card>
                <mat-card-header><mat-card-title>Live Sensors</mat-card-title></mat-card-header>
                <mat-card-content>
                  @for (sensor of device()!.sensors; track sensor.id) {
                    <div class="sensor-row">
                      <div class="sensor-name">
                        <mat-icon>sensors</mat-icon>
                        {{ sensor.display_name || sensor.name }}
                      </div>
                      <div class="sensor-value">
                        {{ liveSensorValues()[sensor.name] ?? sensor.last_value ?? '—' }}
                        <span class="sensor-unit">{{ sensor.unit }}</span>
                      </div>
                    </div>
                  }
                  @if (!device()!.sensors?.length) {
                    <p class="empty-state">No sensors registered.</p>
                  }
                </mat-card-content>
              </mat-card>
            </div>

            <!-- Actuators -->
            <mat-card class="mt-16">
              <mat-card-header><mat-card-title>Actuators</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="actuator-grid">
                  @for (actuator of device()!.actuators; track actuator.id) {
                    <div class="actuator-card">
                      <mat-icon>settings_remote</mat-icon>
                      <div class="actuator-name">{{ actuator.display_name || actuator.name }}</div>
                      <div class="actuator-state">{{ actuator.state | json }}</div>
                    </div>
                  }
                  @if (!device()!.actuators?.length) {
                    <p class="empty-state">No actuators registered.</p>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Telemetry Tab -->
        <mat-tab label="Telemetry">
          <div class="tab-content">
            <mat-card>
              <mat-card-header><mat-card-title>Recent Readings (last 100)</mat-card-title></mat-card-header>
              <mat-card-content>
                <table class="readings-table">
                  <thead>
                    <tr><th>Time</th><th>Sensor</th><th>Value</th><th>Quality</th></tr>
                  </thead>
                  <tbody>
                    @for (r of readings(); track r.id) {
                      <tr>
                        <td>{{ r.timestamp | date:'HH:mm:ss' }}</td>
                        <td>{{ r.sensor_name }}</td>
                        <td>{{ r.value ?? (r.raw_payload | json) }}</td>
                        <td>
                          <span class="quality-badge quality-{{ r.quality_flag }}">{{ r.quality_flag }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Agent Tab -->
        <mat-tab label="Agent">
          <div class="tab-content">
            <mat-card>
              <mat-card-header><mat-card-title>Agent Status</mat-card-title></mat-card-header>
              <mat-card-content>
                <p class="empty-state">Navigate to <strong>Agents</strong> to manage and chat with this device's agent.</p>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

      </mat-tab-group>
    } @else {
      <mat-progress-bar mode="indeterminate" />
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .device-uuid { font-family: monospace; font-size: 12px; color: #999; }
    .status-badge { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; text-transform: capitalize; }
    .status-online { background: #e8f5e9; color: #2e7d32; }
    .status-offline { background: #f5f5f5; color: #616161; }
    .status-error { background: #ffebee; color: #c62828; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .tab-content { padding: 20px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-list { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; }
    dt { font-weight: 600; color: #555; }
    dd { margin: 0; }
    .sensor-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .sensor-name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .sensor-value { font-size: 18px; font-weight: 700; color: #1565c0; }
    .sensor-unit { font-size: 12px; color: #999; margin-left: 4px; }
    .actuator-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .actuator-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; text-align: center; }
    .actuator-name { font-weight: 600; margin: 8px 0 4px; }
    .actuator-state { font-size: 12px; color: #999; }
    .empty-state { color: #999; font-style: italic; }
    .mt-16 { margin-top: 16px; }
    .readings-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .readings-table th { text-align: left; padding: 8px; border-bottom: 2px solid #e0e0e0; font-weight: 600; }
    .readings-table td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    .quality-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .quality-good { background: #e8f5e9; color: #2e7d32; }
    .quality-uncertain { background: #fff8e1; color: #f57f17; }
    .quality-bad { background: #ffebee; color: #c62828; }
  `],
})
export class DeviceDetailComponent implements OnInit, OnDestroy {
  device = signal<Device | null>(null);
  readings = signal<SensorReading[]>([]);
  liveSensorValues = signal<Record<string, unknown>>({});

  private deviceId!: number;
  private subs: Subscription[] = [];

  constructor(private route: ActivatedRoute, private api: ApiService, private ws: WebSocketService) {}

  ngOnInit(): void {
    this.deviceId = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getDevice(this.deviceId).subscribe((d) => {
      this.device.set(d);
      this.loadTelemetry(d.device_id);
      this.connectWs(d.device_id);
    });
  }

  private loadTelemetry(deviceUuid: string): void {
    this.api.getDeviceTelemetry(deviceUuid).subscribe((r) => this.readings.set(r));
  }

  private connectWs(deviceUuid: string): void {
    const endpoint = `devices/${deviceUuid}` as const;
    const sub = this.ws.connect(endpoint).subscribe((msg) => {
      if (msg.type === 'sensor_reading') {
        const m = msg as WsSensorReading;
        this.liveSensorValues.update((prev) => ({ ...prev, [m.sensor_name]: m.value }));
        this.readings.update((prev) => [
          { id: Date.now(), device: this.deviceId, sensor_name: m.sensor_name, value: m.value, raw_payload: null, timestamp: m.timestamp, quality_flag: 'good' },
          ...prev.slice(0, 99),
        ]);
      }
    });
    this.subs.push(sub);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
