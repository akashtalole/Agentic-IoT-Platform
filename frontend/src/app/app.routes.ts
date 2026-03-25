import { Routes } from '@angular/router';
import { authGuard, operatorGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/components/layout.component').then((m) => m.LayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'devices',
        loadComponent: () => import('./features/devices/device-list.component').then((m) => m.DeviceListComponent),
      },
      {
        path: 'devices/:id',
        loadComponent: () => import('./features/devices/device-detail.component').then((m) => m.DeviceDetailComponent),
      },
      {
        path: 'agents',
        loadComponent: () => import('./features/agents/agent-panel.component').then((m) => m.AgentPanelComponent),
      },
      {
        path: 'telemetry',
        loadComponent: () => import('./features/telemetry/telemetry.component').then((m) => m.TelemetryComponent),
      },
      {
        path: 'decisions',
        loadComponent: () => import('./features/decisions/decisions.component').then((m) => m.DecisionsComponent),
      },
      {
        path: 'alerts',
        loadComponent: () => import('./features/alerts/alerts.component').then((m) => m.AlertsComponent),
      },
      {
        path: 'deployments',
        canActivate: [operatorGuard],
        loadComponent: () => import('./features/deployments/deployments.component').then((m) => m.DeploymentsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
