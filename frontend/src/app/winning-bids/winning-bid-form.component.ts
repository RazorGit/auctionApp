import { Component, signal, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow } from "../api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadComponent],
  template: `
    <div class="container">
      <div class="header">
        <button class="btn-secondary" (click)="back()">← Back</button>
        <h1>{{ eventName() ? eventName() + ': ' : '' }}Bids History</h1>
      </div>

      <div class="grid">
        <div class="card form-card">
          <div class="row" *ngIf="!fixedEventId()">
            <label class="required-label">Event <span class="asterisk">*</span></label>
            <app-typeahead
              [searchFn]="searchEvents"
              [formatter]="eventFormatter"
              placeholder="Select Event..."
              (selected)="onEventSelected($event)"
              [required]="true"
            ></app-typeahead>
          </div>

          <div *ngIf="selectedEventId()" class="info">
            <div class="muted">
              This screen shows bid history only for <b>ended</b> auctions. Winning bids are highlighted.
            </div>

            <div class="error" *ngIf="error()">{{ error() }}</div>
            <div class="muted" *ngIf="loading()">Loading…</div>

            <div *ngIf="!loading() && !error() && !groups().length" class="muted">
              No bids found for this ended auction.
            </div>
          </div>
        </div>

        <div class="card list-card" *ngIf="selectedEventId()">
          <h2>Bid history</h2>

          <div class="group" *ngFor="let g of groups()">
            <div class="group-head">
              <div class="title">Item: {{ g.item_desc }}</div>
              <div class="meta">Item ID: {{ g.item_id }} • Bids: {{ g.bids.length }}</div>
            </div>

            <table *ngIf="g.bids.length">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let b of g.bids" [class.winner]="b.isWinner">
                  <td>{{ b.placed_at }}</td>
                  <td>{{ b.username }}</td>
                  <td><b>{{ b.amount }}</b></td>
                  <td>
                    <span *ngIf="b.isWinner" class="badge-win">WINNER</span>
                    <span *ngIf="!b.isWinner" class="badge-lose">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
    .card { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #000; }
    .row { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; color: #000; }

    .muted { opacity: 0.78; }
    .error { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(220, 53, 69, 0.35); background: rgba(220, 53, 69, 0.08); margin-top: 10px; }

    .group { border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; padding: 12px; margin: 12px 0; }
    .group-head { display:flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 10px; }
    .title { font-weight: 900; }
    .meta { font-size: 12px; opacity: 0.8; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; user-select: none; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #eee; }

    tr.winner td { background: rgba(40, 167, 69, 0.10); }
    .badge-win { display:inline-block; padding: 2px 8px; border-radius: 999px; background: rgba(40,167,69,0.15); border: 1px solid rgba(40,167,69,0.35); color: #1e7e34; font-weight: 900; font-size: 12px; }
    .badge-lose { opacity: 0.6; }

    .asterisk { color: #dc3545; }
  `]
})
export class WinningBidFormComponent implements OnInit {
  fixedEventId = signal<number | null>(null);
  selectedEventId = signal<number | null>(null);
  eventName = signal<string | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);

  rawBids = signal<any[]>([]);

  groups = computed(() => {
    const rows = this.rawBids();
    const byItem = new Map<number, any>();

    for (const r of rows) {
      const itemId = Number(r.item_id);
      if (!byItem.has(itemId)) {
        byItem.set(itemId, {
          item_id: itemId,
          item_desc: r.item_desc,
          winning_bid: r.winning_bid ?? null,
          bids: [] as any[],
        });
      }
      const g = byItem.get(itemId);
      g.winning_bid = g.winning_bid ?? r.winning_bid ?? null;
      g.bids.push({ ...r, isWinner: false });
    }

    for (const g of byItem.values()) {
      const win = g.winning_bid;
      if (win === null || win === undefined) continue;
      // Mark the bid that matches the recorded winning_bid for the item.
      const winner = g.bids.find((b: any) => String(b.amount) === String(win));
      if (winner) winner.isWinner = true;
    }

    return Array.from(byItem.values());
  });

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit() {
    const locator = this.route.snapshot.queryParamMap.get("event_locator");
    const id = this.route.snapshot.queryParamMap.get("event_id");

    if (locator) {
      try {
        const events = await firstValueFrom(this.api.listEvents(undefined, locator));
        if (events.length > 0) {
          const ev = events[0];
          this.fixedEventId.set(ev.event_id);
          this.selectedEventId.set(ev.event_id);
          this.eventName.set(ev.event_desc);
          await this.refresh();
        }
      } catch (e) { }
    } else if (id) {
      const eventId = Number(id);
      this.fixedEventId.set(eventId);
      this.selectedEventId.set(eventId);
      await this.loadEventInfo(eventId);
      await this.refresh();
    }
  }

  async loadEventInfo(id: number) {
    try {
      const events = await firstValueFrom(this.api.listEvents());
      const ev = events.find(e => e.event_id === id);
      if (ev) this.eventName.set(ev.event_desc);
    } catch (e) { }
  }

  searchEvents = (q: string) => this.api.listEvents(q);
  eventFormatter = (e: EventRow) => e.event_desc;

  async onEventSelected(e: EventRow) {
    this.selectedEventId.set(e.event_id);
    this.eventName.set(e.event_desc);
    await this.refresh();
  }

  async refresh() {
    const id = this.selectedEventId();
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);
    this.rawBids.set([]);

    try {
      const res = await firstValueFrom(this.api.adminBidHistory(id));
      this.rawBids.set(res.bids ?? []);
    } catch (e: any) {
      if (e?.status === 409) {
        this.error.set('This auction is not ended yet. Stop the auction first to view bid history.');
      } else {
        this.error.set('Could not load bid history.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    if (this.fixedEventId()) {
      window.history.back();
    } else {
      this.router.navigate(["/admin"]);
    }
  }
}
