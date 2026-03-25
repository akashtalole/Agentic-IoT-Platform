import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTokens, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl;

  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    const token = this.getAccessToken();
    if (token) {
      this.fetchProfile().subscribe({
        error: () => this.logout(),
      });
    }
  }

  login(username: string, password: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.API}/auth/login/`, { username, password }).pipe(
      tap((tokens) => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        this.fetchProfile().subscribe();
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<{ access: string }> {
    const refresh = localStorage.getItem('refresh_token');
    return this.http.post<{ access: string }>(`${this.API}/auth/refresh/`, { refresh }).pipe(
      tap((res) => localStorage.setItem('access_token', res.access))
    );
  }

  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${this.API}/auth/me/`).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  hasRole(role: 'admin' | 'operator' | 'viewer'): boolean {
    const user = this.currentUser();
    if (!user) return false;
    const hierarchy = { admin: 3, operator: 2, viewer: 1 };
    return hierarchy[user.role] >= hierarchy[role];
  }
}
