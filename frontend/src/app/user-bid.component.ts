import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  selector: 'app-user-bid',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container" [class.embedded]="embedded">
      <h1 *ngIf="!embedded">Place bids</h1>
      <div class="muted" *ngIf="loading()">Loading…</div>

      <div *ngIf="!loading() && error()" class="error">{{ error() }}</div>

      <div *ngIf="!loading() && event()" class="card">
        <div class="title">{{ event()?.event_desc }}</div>
        <div class="meta">Status: <b>{{ event()?.status }}</b></div>

        <div class="warn" *ngIf="event()?.status !== 'ongoing'">
          Bidding is disabled until the admin starts the auction.
        </div>

        <div class="row">
          <label>Item</label>
          <select [(ngModel)]="selectedItemId">
            <option [ngValue]="0" disabled>Select an item…</option>
            <option *ngFor="let i of items()" [ngValue]="i.item_id">{{ i.item_desc }}</option>
          </select>
        </div>

        <div class="row">
          <label>Amount</label>
          <input type="number" [(ngModel)]="amount" min="1" step="0.01" />
        </div>

        <button class="primary" (click)="placeBid()" [disabled]="event()?.status !== 'ongoing' || !selectedItemId || amount <= 0">Place bid</button>

        <div class="divider"></div>
        <h3>Latest bids</h3>
        <div class="muted" *ngIf="!bids().length">No bids yet.</div>
        <div class="bid" *ngFor="let b of bids()">
          <b>{{ b.username }}</b> bid <b>{{ b.amount }}</b> on <span>{{ b.item_desc }}</span>
          <span class="time">{{ b.placed_at }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px 18px; max-width: 900px; margin: 0 auto; color:#000; }
    .container.embedded { padding: 0; max-width: unset; }
    .card { background:#fff; border-radius:14px; padding:18px; box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
    .title { font-weight: 800; font-size: 18px; }
    .meta { font-size: 12px; opacity: 0.8; margin-bottom: 14px; }
    .warn { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,193,7,0.6); background: rgba(255,193,7,0.15); margin-bottom: 12px; }
    .row { display:grid; gap: 6px; margin: 10px 0; }
    label { font-size: 12px; opacity: 0.75; }
    select, input { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.18); }
    .primary { margin-top: 10px; padding: 10px 12px; border-radius: 10px; border:none; background:#007bff; color:#fff; cursor:pointer; }
    .primary:disabled { opacity: 0.6; cursor:not-allowed; }
    .divider { height: 1px; background: rgba(0,0,0,0.08); margin: 16px 0; }
    .bid { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
    .time { display:block; font-size: 11px; opacity: 0.65; }
    .muted { opacity: 0.75; }
    .error { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(220,53,69,0.35); background: rgba(220,53,69,0.08); }
  `]
})
export class UserBidComponent implements OnInit {
  @Input() eventLocator: string | null = null;
  @Input() embedded = false;

  locator = '';
  loading = signal(true);
  error = signal<string | null>(null);

  event = signal<any | null>(null);
  items = signal<any[]>([]);
  bids = signal<any[]>([]);

  selectedItemId = 0;
  amount = 1;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  async ngOnInit() {
    this.locator = this.eventLocator ?? (this.route.snapshot.paramMap.get('eventLocator') || '');
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const evRows = await firstValueFrom(this.api.getAuctionByLocator(this.locator));
      const ev = evRows?.[0];
      if (!ev) throw new Error('NotFound');

      this.event.set(ev);
      const items = await firstValueFrom(this.api.listItems(ev.event_id));
      this.items.set(items);
      this.selectedItemId = items[0]?.item_id ?? 0;
      await this.refreshBids();
    } catch (e: any) {
      this.error.set('Could not load auction or you are not approved for it yet.');
    } finally {
      this.loading.set(false);
    }
  }

  async refreshBids() {
    const ev = this.event();
    if (!ev) return;
    const rows = await firstValueFrom(this.api.listBids(ev.event_id));
    this.bids.set(rows);
  }

  async placeBid() {
    const ev = this.event();
    if (!ev) return;
    try {
      await firstValueFrom(this.api.placeBid(ev.event_id, this.selectedItemId, this.amount));
      await this.refreshBids();
    } catch (e: any) {
      this.error.set('Could not place bid. Ensure the auction is ongoing and your membership is approved.');
    }
  }
}
