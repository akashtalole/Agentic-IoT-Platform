import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { retryWhen, tap, delayWhen } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { WsMessage } from '../models';

export type WsEndpoint = 'devices' | 'alerts' | `devices/${string}` | `agents/${string}`;

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private sockets = new Map<string, WebSocket>();
  private subjects = new Map<string, Subject<WsMessage>>();

  connect(endpoint: WsEndpoint): Observable<WsMessage> {
    if (!this.subjects.has(endpoint)) {
      this.subjects.set(endpoint, new Subject<WsMessage>());
      this.createSocket(endpoint);
    }
    return this.subjects.get(endpoint)!.asObservable();
  }

  private createSocket(endpoint: WsEndpoint): void {
    const token = localStorage.getItem('access_token');
    const url = `${environment.wsUrl}/ws/${endpoint}/`;
    const socket = new WebSocket(url);
    this.sockets.set(endpoint, socket);

    socket.onopen = () => console.log(`WS connected: ${endpoint}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        this.subjects.get(endpoint)?.next(data);
      } catch {
        console.warn('WS: failed to parse message', event.data);
      }
    };

    socket.onerror = (err) => console.error(`WS error on ${endpoint}:`, err);

    socket.onclose = () => {
      console.warn(`WS closed: ${endpoint}. Reconnecting in 3s...`);
      // Auto-reconnect
      setTimeout(() => {
        if (this.subjects.has(endpoint)) {
          this.createSocket(endpoint);
        }
      }, 3000);
    };
  }

  send(endpoint: WsEndpoint, data: unknown): void {
    const socket = this.sockets.get(endpoint);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  disconnect(endpoint: WsEndpoint): void {
    this.sockets.get(endpoint)?.close();
    this.sockets.delete(endpoint);
    this.subjects.get(endpoint)?.complete();
    this.subjects.delete(endpoint);
  }

  ngOnDestroy(): void {
    this.sockets.forEach((socket) => socket.close());
    this.subjects.forEach((subject) => subject.complete());
  }
}
