import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Past auctions</h1>
      <p class="subtitle">Auctions you participated in (approved memberships).</p>

      <div *ngIf="loading()" class="muted">Loading…</div>
      <div *ngIf="!loading() && !rows().length" class="muted">No past auctions yet.</div>

      <div class="list" *ngIf="!loading() && rows().length">
        <div class="row" *ngFor="let r of rows()">
          <div class="title">{{ r.event_desc }}</div>
          <div class="meta">Ended: {{ r.event_status }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px 18px; max-width: 900px; margin: 0 auto; color: #000; }
    .subtitle { margin-top: 0; opacity: 0.8; }
    .list { display: grid; gap: 12px; margin-top: 16px; }
    .row { background:#fff; border-radius:12px; padding:14px 16px; box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
    .title { font-weight: 700; }
    .meta { font-size: 12px; opacity: 0.85; }
    .muted { opacity: 0.7; }
  `]
})
export class UserHistoryComponent implements OnInit {
  rows = signal<any[]>([]);
  loading = signal(true);

  constructor(private api: ApiService) {}

  async ngOnInit() {
    this.loading.set(true);
    try {
      const memberships = await firstValueFrom(this.api.myMemberships());
      this.rows.set(memberships.filter((m: any) => m.status === 'approved' && m.event_status === 'ended'));
    } finally {
      this.loading.set(false);
    }
  }
}

