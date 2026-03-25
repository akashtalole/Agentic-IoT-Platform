import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../core/services/api.service';
import { Snapshot, Deployment, DeviceGroup } from '../../core/models';

@Component({
  selector: 'app-deployments',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatTabsModule, MatInputModule, MatFormFieldModule,
    MatSelectModule, MatTableModule, MatExpansionModule, MatProgressBarModule,
    MatDialogModule,
  ],
  template: `
    <h1 class="page-title">Snapshots & Deployments</h1>

    <mat-tab-group>

      <!-- Snapshots Tab -->
      <mat-tab label="Snapshots">
        <div class="tab-content">
          <div class="tab-header">
            <p class="tab-desc">A snapshot captures the current skill configuration and can be deployed to device groups.</p>
            <button mat-raised-button color="primary" (click)="showCreateSnapshot.set(true)">
              <mat-icon>add</mat-icon> New Snapshot
            </button>
          </div>

          <!-- Create Snapshot Panel -->
          @if (showCreateSnapshot()) {
            <mat-card class="create-card">
              <mat-card-header><mat-card-title>Create Snapshot</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="form-row">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Snapshot Name</mat-label>
                    <input matInput [(ngModel)]="newSnapshotName" placeholder="e.g. v2.1-temperature-alert" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description</mat-label>
                    <textarea matInput [(ngModel)]="newSnapshotDesc" rows="2"
                              placeholder="What changed in this snapshot..."></textarea>
                  </mat-form-field>
                </div>
              </mat-card-content>
              <mat-card-actions>
                <button mat-raised-button color="primary" (click)="createSnapshot()"
                        [disabled]="!newSnapshotName.trim()">
                  <mat-icon>save</mat-icon> Save Snapshot
                </button>
                <button mat-button (click)="showCreateSnapshot.set(false)">Cancel</button>
              </mat-card-actions>
            </mat-card>
          }

          <!-- Snapshot List -->
          @for (snap of snapshots(); track snap.id) {
            <mat-card class="snapshot-card">
              <mat-card-content>
                <div class="snapshot-row">
                  <div class="snapshot-info">
                    <div class="snapshot-name">
                      <mat-icon>camera</mat-icon>
                      {{ snap.name }}
                    </div>
                    <div class="snapshot-desc">{{ snap.description || 'No description.' }}</div>
                    <div class="snapshot-meta">
                      Created {{ snap.created_at | date:'medium' }}
                      @if (snap.created_by_name) { · by {{ snap.created_by_name }} }
                    </div>
                  </div>
                  <div class="snapshot-actions">
                    <button mat-raised-button color="primary" (click)="prepareDeployment(snap)">
                      <mat-icon>rocket_launch</mat-icon> Deploy
                    </button>
                  </div>
                </div>

                @if (snap.skills?.length) {
                  <div class="skills-chips">
                    @for (skill of snap.skills; track skill) {
                      <mat-chip>{{ skill }}</mat-chip>
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>
          }

          @if (!snapshots().length) {
            <mat-card>
              <mat-card-content>
                <p class="empty-state">
                  <mat-icon>camera_alt</mat-icon>
                  No snapshots yet. Create one to capture the current skill configuration.
                </p>
              </mat-card-content>
            </mat-card>
          }
        </div>
      </mat-tab>

      <!-- Deployments Tab -->
      <mat-tab label="Deployments">
        <div class="tab-content">

          <!-- Deploy Dialog (inline) -->
          @if (deployTarget()) {
            <mat-card class="deploy-card">
              <mat-card-header>
                <mat-card-title>Deploy Snapshot</mat-card-title>
                <mat-card-subtitle>{{ deployTarget()!.name }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Target Device Group</mat-label>
                  <mat-select [(ngModel)]="deployGroupId">
                    @for (g of deviceGroups(); track g.id) {
                      <mat-option [value]="g.id">{{ g.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </mat-card-content>
              <mat-card-actions>
                <button mat-raised-button color="primary" (click)="confirmDeploy()"
                        [disabled]="!deployGroupId">
                  <mat-icon>rocket_launch</mat-icon> Confirm Deploy
                </button>
                <button mat-button (click)="deployTarget.set(null)">Cancel</button>
              </mat-card-actions>
            </mat-card>
          }

          <!-- Deployment History -->
          <table mat-table [dataSource]="deployments()" class="deploy-table">

            <ng-container matColumnDef="snapshot">
              <th mat-header-cell *matHeaderCellDef>Snapshot</th>
              <td mat-cell *matCellDef="let d">
                <div class="cell-main">{{ d.snapshot_name }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="group">
              <th mat-header-cell *matHeaderCellDef>Device Group</th>
              <td mat-cell *matCellDef="let d">{{ d.group_name }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let d">
                <span class="deploy-status" [class]="'deploy-' + d.status">{{ d.status }}</span>
                @if (d.status === 'in_progress') {
                  <mat-progress-bar mode="indeterminate" class="deploy-progress" />
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="deployed_by">
              <th mat-header-cell *matHeaderCellDef>Deployed By</th>
              <td mat-cell *matCellDef="let d">{{ d.deployed_by_name || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="deployed_at">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let d">{{ d.deployed_at | date:'short' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let d">
                @if (d.status === 'completed' && d.rollback_snapshot_id) {
                  <button mat-icon-button title="Rollback" (click)="rollback(d)">
                    <mat-icon>undo</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="deployColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: deployColumns;"></tr>
          </table>

          @if (!deployments().length) {
            <mat-card class="mt-16">
              <mat-card-content>
                <p class="empty-state">
                  <mat-icon>history</mat-icon>
                  No deployments yet. Deploy a snapshot to a device group.
                </p>
              </mat-card-content>
            </mat-card>
          }
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
    .tab-content { padding: 20px 0; display: flex; flex-direction: column; gap: 16px; }
    .tab-header { display: flex; justify-content: space-between; align-items: center; }
    .tab-desc { color: #666; font-size: 14px; margin: 0; }

    .create-card { border: 2px dashed #1565c0; background: #f8fbff; }
    .form-row { display: flex; flex-direction: column; gap: 8px; }
    .full-width { width: 100%; }

    .snapshot-card { }
    .snapshot-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .snapshot-info { flex: 1; }
    .snapshot-name { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; margin-bottom: 4px; }
    .snapshot-name mat-icon { color: #1565c0; }
    .snapshot-desc { color: #555; font-size: 14px; margin-bottom: 6px; }
    .snapshot-meta { font-size: 12px; color: #999; }
    .snapshot-actions { flex-shrink: 0; margin-left: 16px; }
    .skills-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; border-top: 1px solid #f0f0f0; padding-top: 12px; }

    .deploy-card { border: 2px solid #ff9800; background: #fffbf0; margin-bottom: 8px; }

    .deploy-table { width: 100%; }
    .cell-main { font-weight: 600; }
    .deploy-status { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; }
    .deploy-pending { background: #fff8e1; color: #f57f17; }
    .deploy-in_progress { background: #e3f2fd; color: #1565c0; }
    .deploy-completed { background: #e8f5e9; color: #2e7d32; }
    .deploy-failed { background: #ffebee; color: #c62828; }
    .deploy-rolled_back { background: #f3e5f5; color: #6a1b9a; }
    .deploy-progress { margin-top: 4px; }

    .mt-16 { margin-top: 16px; }
    .empty-state { color: #999; font-style: italic; text-align: center; padding: 32px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.4; }
  `],
})
export class DeploymentsComponent implements OnInit {
  snapshots = signal<Snapshot[]>([]);
  deployments = signal<Deployment[]>([]);
  deviceGroups = signal<DeviceGroup[]>([]);

  showCreateSnapshot = signal(false);
  deployTarget = signal<Snapshot | null>(null);

  newSnapshotName = '';
  newSnapshotDesc = '';
  deployGroupId: number | null = null;

  deployColumns = ['snapshot', 'group', 'status', 'deployed_by', 'deployed_at', 'actions'];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getSnapshots().subscribe((res) => this.snapshots.set(res.results));
    this.api.getDeployments().subscribe((res) => this.deployments.set(res.results));
    this.api.getDeviceGroups().subscribe((res) => this.deviceGroups.set(res.results));
  }

  createSnapshot(): void {
    const payload = { name: this.newSnapshotName.trim(), description: this.newSnapshotDesc.trim() };
    this.api.createSnapshot(payload).subscribe((snap) => {
      this.snapshots.update((prev) => [snap, ...prev]);
      this.newSnapshotName = '';
      this.newSnapshotDesc = '';
      this.showCreateSnapshot.set(false);
    });
  }

  prepareDeployment(snap: Snapshot): void {
    this.deployTarget.set(snap);
    this.deployGroupId = null;
  }

  confirmDeploy(): void {
    const snap = this.deployTarget();
    if (!snap || !this.deployGroupId) return;

    this.api.createDeployment({ snapshot: snap.id, device_group: this.deployGroupId }).subscribe((dep) => {
      this.deployments.update((prev) => [dep, ...prev]);
      this.deployTarget.set(null);
    });
  }

  rollback(dep: Deployment): void {
    if (!dep.rollback_snapshot_id) return;
    this.api.createDeployment({
      snapshot: dep.rollback_snapshot_id,
      device_group: dep.device_group,
    }).subscribe((newDep) => {
      this.deployments.update((prev) => [newDep, ...prev]);
    });
  }
}
