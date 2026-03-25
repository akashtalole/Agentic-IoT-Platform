import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgxEchartsModule, NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { Device, SensorReading } from '../../core/models';

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatIconModule, NgxEchartsModule,
  ],
  providers: [
    { provide: NGX_ECHARTS_CONFIG, useValue: { echarts: () => import('echarts') } },
  ],
  template: `
    <h1 class="page-title">Telemetry</h1>

    <mat-card class="filters-card">
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Device</mat-label>
            <mat-select [(ngModel)]="selectedDeviceId" (ngModelChange)="onDeviceChange()">
              @for (d of devices(); track d.id) {
                <mat-option [value]="d.device_id">{{ d.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Sensor</mat-label>
            <mat-select [(ngModel)]="selectedSensor" (ngModelChange)="loadReadings()">
              <mat-option value="">All sensors</mat-option>
              @for (s of sensors(); track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Time window</mat-label>
            <mat-select [(ngModel)]="timeWindow" (ngModelChange)="loadReadings()">
              <mat-option value="1h">Last 1 hour</mat-option>
              <mat-option value="6h">Last 6 hours</mat-option>
              <mat-option value="24h">Last 24 hours</mat-option>
              <mat-option value="7d">Last 7 days</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-icon-button (click)="loadReadings()" title="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    @if (chartOptions()) {
      <mat-card class="chart-card">
        <mat-card-content>
          <div echarts [options]="chartOptions()!" class="chart"></div>
        </mat-card-content>
      </mat-card>
    } @else if (selectedDeviceId) {
      <mat-card>
        <mat-card-content>
          <p class="empty-state">No telemetry data found for the selected filters.</p>
        </mat-card-content>
      </mat-card>
    } @else {
      <mat-card>
        <mat-card-content>
          <p class="empty-state">Select a device to view its telemetry.</p>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
    .filters-card { margin-bottom: 16px; }
    .filter-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    mat-form-field { min-width: 200px; }
    .chart-card { }
    .chart { height: 400px; width: 100%; }
    .empty-state { color: #999; font-style: italic; padding: 24px 0; text-align: center; }
  `],
})
export class TelemetryComponent implements OnInit {
  devices = signal<Device[]>([]);
  sensors = signal<string[]>([]);
  chartOptions = signal<object | null>(null);

  selectedDeviceId = '';
  selectedSensor = '';
  timeWindow = '1h';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getDevices().subscribe((res) => this.devices.set(res.results));
  }

  onDeviceChange(): void {
    this.sensors.set([]);
    this.selectedSensor = '';
    if (!this.selectedDeviceId) return;

    const device = this.devices().find((d) => d.device_id === this.selectedDeviceId);
    if (device?.sensors) {
      this.sensors.set(device.sensors.map((s) => s.name));
    }
    this.loadReadings();
  }

  loadReadings(): void {
    if (!this.selectedDeviceId) return;

    const now = new Date();
    const from = new Date(now.getTime() - this.windowMs());
    const params: Record<string, string> = {
      from: from.toISOString(),
      to: now.toISOString(),
    };
    if (this.selectedSensor) params['sensor'] = this.selectedSensor;

    this.api.getDeviceTelemetry(this.selectedDeviceId, params).subscribe((readings) => {
      this.buildChart(readings);
    });
  }

  private windowMs(): number {
    const map: Record<string, number> = { '1h': 3600e3, '6h': 6 * 3600e3, '24h': 24 * 3600e3, '7d': 7 * 24 * 3600e3 };
    return map[this.timeWindow] ?? 3600e3;
  }

  private buildChart(readings: SensorReading[]): void {
    if (!readings.length) { this.chartOptions.set(null); return; }

    // Group by sensor name
    const bySensor: Record<string, { time: string; value: number | null }[]> = {};
    for (const r of readings) {
      if (!bySensor[r.sensor_name]) bySensor[r.sensor_name] = [];
      bySensor[r.sensor_name].push({ time: r.timestamp, value: r.value });
    }

    const series = Object.entries(bySensor).map(([name, data]) => ({
      name,
      type: 'line',
      smooth: true,
      data: data.sort((a, b) => a.time.localeCompare(b.time)).map((d) => [d.time, d.value]),
      emphasis: { focus: 'series' },
    }));

    this.chartOptions.set({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { top: 10 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'time', boundaryGap: false },
      yAxis: { type: 'value' },
      series,
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100 }],
    });
  }
}
