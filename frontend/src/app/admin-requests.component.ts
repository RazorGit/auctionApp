import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="badge">Admin</div>
      <h1>Join Requests</h1>
      <p class="subtitle">Approve or deny user requests to join auctions.</p>

      <div *ngIf="loading()" class="muted">Loading…</div>
      <div *ngIf="!loading() && !pending().length" class="muted">No pending requests.</div>

      <div class="list" *ngIf="!loading() && pending().length">
        <div class="row" *ngFor="let r of pending()">
          <div>
            <div class="title">{{ r.username }} → {{ r.event_desc }}</div>
            <div class="meta">Requested: {{ r.requested_at }}</div>
          </div>
          <div class="controls">
            <button class="primary" (click)="decide(r.membership_id, 'approved')">Approve</button>
            <button class="danger" (click)="decide(r.membership_id, 'denied')">Deny</button>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <h2>Manually add user to an auction</h2>
      <div class="card">
        <div class="row2">
          <label>Username</label>
          <input [(ngModel)]="username" placeholder="e.g. user1" />
        </div>
        <div class="row2">
          <label>Event ID</label>
          <input type="number" [(ngModel)]="eventId" min="1" />
        </div>
        <button class="primary" (click)="addUser()" [disabled]="!username || !eventId">Add / Approve</button>
        <div class="muted" *ngIf="msg()">{{ msg() }}</div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px 18px; max-width: 1000px; margin: 0 auto; color:#000; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:#333; color:#fff; font-size:12px; letter-spacing:0.6px; text-transform:uppercase; }
    .subtitle { margin-top: 0; opacity: 0.8; }
    .list { display:grid; gap: 12px; margin-top: 16px; }
    .row { display:flex; justify-content: space-between; gap: 14px; align-items:center; background:#fff; border-radius:12px; padding:14px 16px; box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
    .title { font-weight: 800; }
    .meta { font-size: 12px; opacity: 0.85; }
    .controls { display:flex; gap: 10px; }
    .primary { padding: 10px 12px; border-radius: 10px; border:none; background:#007bff; color:#fff; cursor:pointer; }
    .danger { padding: 10px 12px; border-radius: 10px; border:none; background:#dc3545; color:#fff; cursor:pointer; }
    .divider { height: 1px; background: rgba(0,0,0,0.08); margin: 18px 0; }
    .card { background:#fff; border-radius:12px; padding:14px 16px; box-shadow: 0 6px 16px rgba(0,0,0,0.06); max-width: 520px; }
    .row2 { display:grid; gap: 6px; margin-bottom: 10px; }
    label { font-size: 12px; opacity: 0.75; }
    input { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.18); }
    .muted { opacity: 0.75; margin-top: 10px; }
  `]
})
export class AdminRequestsComponent implements OnInit {
  pending = signal<any[]>([]);
  loading = signal(true);

  username = '';
  eventId: number | null = null;
  msg = signal<string | null>(null);

  constructor(private api: ApiService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.api.listPendingMemberships());
      this.pending.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  async decide(id: number, status: 'approved' | 'denied') {
    await firstValueFrom(this.api.decideMembership(id, status));
    await this.load();
  }

  async addUser() {
    this.msg.set(null);
    try {
      await firstValueFrom(this.api.adminAddMember(this.eventId!, this.username));
      this.msg.set('Member approved.');
    } catch {
      this.msg.set('Could not add member. Check username/event id.');
    }
  }
}

