import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Device, DeviceStatus } from '../../core/models';

@Component({
  selector: 'app-device-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatTableModule, MatCardModule, MatChipsModule,
    MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule,
  ],
  template: `
    <div class="page-header">
      <h1>Device Fleet</h1>
      <button mat-raised-button color="primary">
        <mat-icon>add</mat-icon> Register Device
      </button>
    </div>

    <mat-card>
      <mat-card-content>
        <div class="filters">
          <mat-form-field appearance="outline">
            <mat-label>Search</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [(ngModel)]="searchQuery" (ngModelChange)="onSearch()" placeholder="Name, location, ID..." />
          </mat-form-field>
        </div>

        <table mat-table [dataSource]="devices()" class="full-width">
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let device">
              <span class="status-dot" [class]="'status-' + device.status"></span>
              {{ device.status }}
            </td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Device</th>
            <td mat-cell *matCellDef="let device">
              <a [routerLink]="['/devices', device.id]" class="device-link">{{ device.name }}</a>
              <div class="device-id">{{ device.device_id }}</div>
            </td>
          </ng-container>

          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let device">{{ device.device_type }}</td>
          </ng-container>

          <ng-container matColumnDef="group">
            <th mat-header-cell *matHeaderCellDef>Group</th>
            <td mat-cell *matCellDef="let device">{{ device.group_name || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef>Location</th>
            <td mat-cell *matCellDef="let device">{{ device.location || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="heartbeat">
            <th mat-header-cell *matHeaderCellDef>Last Seen</th>
            <td mat-cell *matCellDef="let device">
              {{ device.last_heartbeat ? (device.last_heartbeat | date:'short') : 'Never' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let device">
              <button mat-icon-button [routerLink]="['/devices', device.id]" title="View">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 600; margin: 0; }
    .filters { margin-bottom: 16px; }
    .full-width { width: 100%; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .status-online { background: #4caf50; }
    .status-offline { background: #9e9e9e; }
    .status-error { background: #f44336; }
    .status-provisioning { background: #ff9800; }
    .device-link { font-weight: 600; text-decoration: none; color: #1565c0; }
    .device-id { font-size: 11px; color: #999; font-family: monospace; }
  `],
})
export class DeviceListComponent implements OnInit {
  devices = signal<Device[]>([]);
  searchQuery = '';
  displayedColumns = ['status', 'name', 'type', 'group', 'location', 'heartbeat', 'actions'];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    const params: Record<string, string> = {};
    if (this.searchQuery) params['search'] = this.searchQuery;
    this.api.getDevices(params).subscribe((res) => this.devices.set(res.results));
  }

  onSearch(): void {
    this.loadDevices();
  }
}
