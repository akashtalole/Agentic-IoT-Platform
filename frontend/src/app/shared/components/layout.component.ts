import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatBadgeModule,
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav mode="side" opened class="sidenav">
        <div class="logo">
          <mat-icon>hub</mat-icon>
          <span>Agentic IoT</span>
        </div>

        <mat-nav-list>
          @for (item of navItems; track item.path) {
            <a mat-list-item [routerLink]="item.path" routerLinkActive="active">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>

        <div class="sidenav-footer">
          <div class="user-info">
            <mat-icon>account_circle</mat-icon>
            <div>
              <div class="username">{{ currentUser()?.username }}</div>
              <div class="role">{{ currentUser()?.role }}</div>
            </div>
          </div>
          <button mat-icon-button (click)="logout()" title="Logout">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <span class="toolbar-spacer"></span>
          <button mat-icon-button routerLink="/alerts">
            <mat-icon>notifications</mat-icon>
          </button>
        </mat-toolbar>
        <div class="content-area">
          <router-outlet />
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container { height: 100vh; }
    .sidenav { width: 240px; background: #1e1e2e; color: #cdd6f4; }
    .logo { display: flex; align-items: center; gap: 12px; padding: 20px 16px; font-size: 18px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1); }
    mat-nav-list a.active { background: rgba(137, 180, 250, 0.15); color: #89b4fa; }
    .sidenav-footer { position: absolute; bottom: 0; width: 100%; padding: 12px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); }
    .user-info { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .username { font-weight: 600; }
    .role { opacity: 0.7; text-transform: capitalize; }
    .toolbar-spacer { flex: 1; }
    .content-area { padding: 24px; background: #f5f5f5; min-height: calc(100vh - 64px); }
  `],
})
export class LayoutComponent {
  currentUser = computed(() => this.auth.currentUser());

  navItems = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/devices', icon: 'devices', label: 'Devices' },
    { path: '/agents', icon: 'smart_toy', label: 'Agents' },
    { path: '/telemetry', icon: 'timeline', label: 'Telemetry' },
    { path: '/decisions', icon: 'fact_check', label: 'Decisions' },
    { path: '/alerts', icon: 'notifications_active', label: 'Alerts' },
    { path: '/deployments', icon: 'rocket_launch', label: 'Deployments' },
  ];

  constructor(private auth: AuthService) {}

  logout(): void {
    this.auth.logout();
  }
}
