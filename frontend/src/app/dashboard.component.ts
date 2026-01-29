import { CommonModule } from "@angular/common";
import { Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";
import { BidderRow, EventRow, ItemRow, WinningBidRow } from "./api.types";

@Component({
    imports: [CommonModule, FormsModule],
    template: `
    <div class="grid">
      <div class="card">
        <h2>Events</h2>
        <div class="row">
          <label>Search</label>
          <input [(ngModel)]="eventSearch" placeholder="event description contains…" (keyup.enter)="refreshEvents()" />
        </div>
        <button (click)="refreshEvents()" [disabled]="busy()">Refresh</button>

        <div style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 14px;">
          <h2 style="margin-bottom: 6px;">Create event</h2>
          <div class="row">
            <label>Description</label>
            <input [(ngModel)]="newEventDesc" placeholder="e.g. Spring Charity Auction" />
          </div>
          <div class="row">
            <label>Date</label>
            <input [(ngModel)]="newEventDate" placeholder="YYYY-MM-DD" />
          </div>
          <div class="row">
            <label>Tax ID</label>
            <input [(ngModel)]="newEventTaxId" placeholder="optional" />
          </div>
          <button (click)="createEvent()" [disabled]="busy()">Create</button>
        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>
        <div class="ok" *ngIf="ok()">{{ ok() }}</div>

        <table *ngIf="events().length">
          <thead>
            <tr>
              <th>ID</th>
              <th>Locator</th>
              <th>Description</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let e of events()"
              (click)="selectEvent(e)"
              [style.cursor]="'pointer'"
              [style.background]="selectedEventId() === e.event_id ? 'rgba(110,168,254,0.10)' : 'transparent'"
            >
              <td>{{ e.event_id }}</td>
              <td>{{ e.event_locator }}</td>
              <td>{{ e.event_desc }}</td>
              <td>{{ e.event_date }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Selected event</h2>
        <div *ngIf="!selectedEventId()" style="color: var(--muted); font-size: 13px;">
          Click an event on the left to load bidders/items/winning bids.
        </div>
        <div *ngIf="selectedEventId()">
          <div class="pill" style="display:inline-block; margin-bottom: 10px;">
            event_id = <b>{{ selectedEventId() }}</b>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="card" style="padding: 12px;">
              <h2>Bidders</h2>
              <div class="row"><label>Bidder #</label><input [(ngModel)]="newBidderNum" placeholder="optional (int)" /></div>
              <div class="row"><label>First name</label><input [(ngModel)]="newBidderFirst" /></div>
              <div class="row"><label>Last name</label><input [(ngModel)]="newBidderLast" /></div>
              <div class="row"><label>Email</label><input [(ngModel)]="newBidderEmail" placeholder="optional" /></div>
              <button (click)="createBidder()" [disabled]="busy()">Add bidder</button>
              <table *ngIf="bidders().length">
                <thead><tr><th>ID</th><th>#</th><th>Name</th><th>Email</th></tr></thead>
                <tbody>
                  <tr *ngFor="let b of bidders()">
                    <td>{{ b.bidder_id }}</td>
                    <td>{{ b.bidder_num ?? "—" }}</td>
                    <td>{{ b.bidder_first_name }} {{ b.bidder_last_name }}</td>
                    <td>{{ b.bidder_email ?? "—" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="card" style="padding: 12px;">
              <h2>Items</h2>
              <div class="row">
                <label>Type</label>
                <select [(ngModel)]="newItemType">
                  <option value="Live">Live</option>
                  <option value="Not Live">Not Live</option>
                </select>
              </div>
              <div class="row"><label>Description</label><input [(ngModel)]="newItemDesc" /></div>
              <div class="row"><label>Notes</label><input [(ngModel)]="newItemNotes" placeholder="optional" /></div>
              <button (click)="createItem()" [disabled]="busy()">Add item</button>
              <table *ngIf="items().length">
                <thead><tr><th>ID</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  <tr *ngFor="let i of items()">
                    <td>{{ i.item_id }}</td>
                    <td>{{ i.item_type }}</td>
                    <td>{{ i.item_desc }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card" style="padding: 12px; margin-top: 12px;">
            <h2>Winning bids</h2>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
              <div>
                <label>Bidder</label>
                <select [(ngModel)]="newWinningBidderId">
                  <option [ngValue]="null">Select bidder…</option>
                  <option *ngFor="let b of bidders()" [ngValue]="b.bidder_id">
                    {{ b.bidder_id }} - {{ b.bidder_first_name }} {{ b.bidder_last_name }}
                  </option>
                </select>
              </div>
              <div>
                <label>Item</label>
                <select [(ngModel)]="newWinningItemId">
                  <option [ngValue]="null">Select item…</option>
                  <option *ngFor="let i of items()" [ngValue]="i.item_id">
                    {{ i.item_id }} - {{ i.item_desc }}
                  </option>
                </select>
              </div>
              <div>
                <label>Winning bid</label>
                <input [(ngModel)]="newWinningAmount" placeholder="e.g. 25.00" />
              </div>
              <div style="display:flex; align-items:flex-end;">
                <button (click)="createWinningBid()" [disabled]="busy()">Record</button>
              </div>
            </div>

            <table *ngIf="winningBids().length">
              <thead><tr><th>ID</th><th>Bidder</th><th>Item</th><th>Amount</th></tr></thead>
              <tbody>
                <tr *ngFor="let wb of winningBids()">
                  <td>{{ wb.winning_bid_id }}</td>
                  <td>{{ wb.bidder_first_name }} {{ wb.bidder_last_name }} ({{ wb.bidder_id }})</td>
                  <td>{{ wb.item_desc }} ({{ wb.item_id }})</td>
                  <td>{{ wb.winning_bid }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);

  events = signal<EventRow[]>([]);
  bidders = signal<BidderRow[]>([]);
  items = signal<ItemRow[]>([]);
  winningBids = signal<WinningBidRow[]>([]);

  selectedEventId = signal<number | null>(null);

  eventSearch = "";
  newEventDesc = "";
  newEventDate = "";
  newEventTaxId = "";

  newBidderNum = "";
  newBidderFirst = "";
  newBidderLast = "";
  newBidderEmail = "";

  newItemType: "Live" | "Not Live" = "Live";
  newItemDesc = "";
  newItemNotes = "";

  newWinningBidderId: number | null = null;
  newWinningItemId: number | null = null;
  newWinningAmount = "";

  constructor(private api: ApiService) {
    void this.refreshEvents();
  }

  async refreshEvents() {
    await this.run(async () => {
      this.events.set(await firstValueFrom(this.api.listEvents(this.eventSearch || undefined)));
    });
  }

  async selectEvent(e: EventRow) {
    this.selectedEventId.set(e.event_id);
    await this.refreshEventData();
  }

  async refreshEventData() {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    await this.run(async () => {
      const [b, i, w] = await Promise.all([
        firstValueFrom(this.api.listBidders(eventId)),
        firstValueFrom(this.api.listItems(eventId)),
        firstValueFrom(this.api.listWinningBids(eventId)),
      ]);
      this.bidders.set(b);
      this.items.set(i);
      this.winningBids.set(w);
    });
  }

  async createEvent() {
    await this.run(async () => {
      const created = await firstValueFrom(
        this.api.createEvent({
          event_desc: this.newEventDesc.trim(),
          event_date: this.newEventDate.trim(),
          event_tax_id: this.newEventTaxId.trim() ? this.newEventTaxId.trim() : null,
        }),
      );
      this.ok.set(`Created event ${created.event_id}`);
      this.newEventDesc = "";
      this.newEventDate = "";
      this.newEventTaxId = "";
      await this.refreshEvents();
    });
  }

  async createBidder() {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    await this.run(async () => {
      await firstValueFrom(
        this.api.createBidder({
          event_id: eventId,
          bidder_num: this.newBidderNum.trim() ? Number(this.newBidderNum) : null,
          bidder_first_name: this.newBidderFirst.trim(),
          bidder_last_name: this.newBidderLast.trim(),
          bidder_email: this.newBidderEmail.trim() ? this.newBidderEmail.trim() : null,
        }),
      );
      this.ok.set("Added bidder");
      this.newBidderNum = "";
      this.newBidderFirst = "";
      this.newBidderLast = "";
      this.newBidderEmail = "";
      await this.refreshEventData();
    });
  }

  async createItem() {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    await this.run(async () => {
      await firstValueFrom(
        this.api.createItem({
          event_id: eventId,
          item_type: this.newItemType,
          item_desc: this.newItemDesc.trim(),
          item_notes: this.newItemNotes.trim() ? this.newItemNotes.trim() : null,
        }),
      );
      this.ok.set("Added item");
      this.newItemDesc = "";
      this.newItemNotes = "";
      await this.refreshEventData();
    });
  }

  async createWinningBid() {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    if (!this.newWinningBidderId || !this.newWinningItemId) return;
    await this.run(async () => {
      await firstValueFrom(
        this.api.createWinningBid({
          event_id: eventId,
          bidder_id: this.newWinningBidderId!,
          item_id: this.newWinningItemId!,
          winning_bid: Number(this.newWinningAmount),
        }),
      );
      this.ok.set("Recorded winning bid");
      this.newWinningAmount = "";
      await this.refreshEventData();
    });
  }

  private async run(fn: () => Promise<void>) {
    this.error.set(null);
    this.ok.set(null);
    this.busy.set(true);
    try {
      await fn();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || String(e);
      const details = e?.error?.details ? JSON.stringify(e.error.details, null, 2) : "";
      this.error.set(details ? `${msg}\n${details}` : msg);
    } finally {
      this.busy.set(false);
    }
  }
}

