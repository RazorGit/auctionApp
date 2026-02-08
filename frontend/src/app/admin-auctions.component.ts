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
      <h1>Auction Control</h1>
      <p class="subtitle">Start/stop auctions. Users can only bid when status is ongoing.</p>

      <div *ngIf="loading()" class="muted">Loading…</div>

      <div class="list" *ngIf="!loading()">
        <div class="row" *ngFor="let a of auctions()">
          <div>
            <div class="title">{{ a.event_desc }}</div>
            <div class="meta">Status: <b>{{ a.status }}</b></div>
            <div class="meta" *ngIf="a.starts_at">Started: {{ a.starts_at }}</div>
            <div class="meta" *ngIf="a.ends_at">Ends/Ended: {{ a.ends_at }}</div>
          </div>

          <div class="controls">
            <div class="inline">
              <label>Time limit (sec)</label>
              <input type="number" [(ngModel)]="timeLimit[a.event_id]" min="1" placeholder="e.g. 600" />
            </div>

            <button class="primary" (click)="start(a.event_id)" [disabled]="a.status === 'ongoing'">Start</button>
            <button class="danger" (click)="stop(a.event_id)" [disabled]="a.status !== 'ongoing'">Stop</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px 18px; max-width: 1000px; margin: 0 auto; color:#000; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:#333; color:#fff; font-size:12px; letter-spacing:0.6px; text-transform:uppercase; }
    .subtitle { margin-top: 0; opacity: 0.8; }
    .list { display:grid; gap: 12px; margin-top: 16px; }
    .row { display:flex; justify-content: space-between; gap: 14px; align-items:flex-start; background:#fff; border-radius:12px; padding:14px 16px; box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
    .title { font-weight: 800; }
    .meta { font-size: 12px; opacity: 0.85; }
    .controls { display:flex; gap: 10px; align-items:center; flex-wrap: wrap; justify-content:flex-end; }
    .inline { display:grid; gap: 4px; }
    label { font-size: 11px; opacity: 0.7; }
    input { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.18); width: 140px; }
    .primary { padding: 10px 12px; border-radius: 10px; border:none; background:#007bff; color:#fff; cursor:pointer; }
    .danger { padding: 10px 12px; border-radius: 10px; border:none; background:#dc3545; color:#fff; cursor:pointer; }
    button:disabled { opacity: 0.6; cursor:not-allowed; }
    .muted { opacity: 0.75; }
  `]
})
export class AdminAuctionsComponent implements OnInit {
  auctions = signal<any[]>([]);
  loading = signal(true);
  timeLimit: Record<number, number | null> = {};

  constructor(private api: ApiService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.api.listAuctions());
      this.auctions.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  async start(eventId: number) {
    const secs = this.timeLimit[eventId] ?? null;
    await firstValueFrom(this.api.startAuction(eventId, secs));
    await this.load();
  }

  async stop(eventId: number) {
    await firstValueFrom(this.api.stopAuction(eventId));
    await this.load();
  }
}

