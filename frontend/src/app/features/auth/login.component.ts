import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Agentic IoT Platform</mat-card-title>
          <mat-card-subtitle>Sign in to manage your IoT fleet</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onLogin()" #loginForm="ngForm">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="username" name="username" required autocomplete="username" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required autocomplete="current-password" />
            </mat-form-field>

            @if (error()) {
              <p class="error-message">{{ error() }}</p>
            }

            <button mat-raised-button color="primary" type="submit" class="full-width" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                Sign In
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a2e;
    }
    .login-card { width: 400px; padding: 16px; }
    .full-width { width: 100%; margin-bottom: 16px; }
    .error-message { color: #f44336; font-size: 14px; margin-bottom: 12px; }
  `],
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  onLogin(): void {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.detail || 'Invalid credentials');
        this.loading.set(false);
      },
    });
  }
}
