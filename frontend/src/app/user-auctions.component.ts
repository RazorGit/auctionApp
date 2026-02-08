import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Register to a new auction</h1>
      <p class="subtitle">Request access to an auction. An admin must approve before you can bid.</p>

      <div *ngIf="loading()" class="muted">Loading…</div>
      <div *ngIf="!loading() && error()" class="error">{{ error() }}</div>

      <div class="list" *ngIf="!loading() && !error()">
        <div class="row" *ngFor="let a of auctions()">
          <div>
            <div class="title">{{ a.event_desc }}</div>
            <div class="meta">
              <span>Status: <b>{{ a.status }}</b></span>
              <span *ngIf="a.membership_status">Your request: <b>{{ a.membership_status }}</b></span>
            </div>
          </div>

          <button
            class="primary"
            (click)="requestJoin(a.event_id)"
            [disabled]="a.membership_status === 'pending' || a.membership_status === 'approved'"
          >
            {{ a.membership_status ? 'Requested' : 'Request to join' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px 18px; max-width: 900px; margin: 0 auto; color: #000; }
    .subtitle { margin-top: 0; opacity: 0.8; }
    .list { display: grid; gap: 12px; margin-top: 16px; }
    .row { display:flex; justify-content: space-between; gap: 14px; align-items:center; background:#fff; border-radius:12px; padding:14px 16px; box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
    .title { font-weight: 700; }
    .meta { display:flex; gap: 14px; font-size: 12px; opacity: 0.85; }
    .primary { padding: 10px 12px; border-radius: 10px; border:none; background:#007bff; color:#fff; cursor:pointer; }
    .primary:disabled { opacity:0.6; cursor:not-allowed; }
    .muted { opacity: 0.7; }
    .error { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(220,53,69,0.35); background: rgba(220,53,69,0.08); }
  `]
})
export class UserAuctionsComponent implements OnInit {
  auctions = signal<any[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private api: ApiService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listAuctions());
      this.auctions.set(rows);
    } catch {
      this.error.set('Could not load auctions.');
    } finally {
      this.loading.set(false);
    }
  }

  async requestJoin(eventId: number) {
    try {
      await firstValueFrom(this.api.requestMembership(eventId));
      await this.load();
    } catch {
      // ignore
    }
  }
}

