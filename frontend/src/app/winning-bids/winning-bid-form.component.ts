import { Component, signal, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow, BidderRow, ItemRow, WinningBidRow } from "../api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadComponent],
  template: `
    <div class="container">
      <div class="header">
        <button class="btn-secondary" (click)="back()">← Back</button>
        <h1>{{ eventName() ? eventName() + ': ' : '' }}Winning Bid Management</h1>
      </div>

      <div class="grid">
        <div class="card form-card">
          <div class="row" *ngIf="!fixedEventId()">
            <label>Event</label>
            <app-typeahead
              [searchFn]="searchEvents"
              [formatter]="eventFormatter"
              placeholder="Select Event..."
              (selected)="onEventSelected($event)"
            ></app-typeahead>
          </div>

          <div *ngIf="selectedEventId()">
            <h2>{{ existingId() ? 'Update' : 'New' }} Winning Bid</h2>
            <div class="row">
              <label>Bidder</label>
              <app-typeahead
                [searchFn]="searchBidders"
                [formatter]="bidderFormatter"
                [initialValue]="initialBidder"
                placeholder="Search Bidder..."
                (selected)="onBidderSelected($event)"
              ></app-typeahead>
            </div>
            <div class="row">
              <label>Item</label>
              <app-typeahead
                [searchFn]="searchItems"
                [formatter]="itemFormatter"
                [initialValue]="initialItem"
                placeholder="Search Item..."
                (selected)="onItemSelected($event)"
              ></app-typeahead>
            </div>
            <div class="row">
              <label>Amount</label>
              <input [(ngModel)]="amount" type="number" />
            </div>
            <div class="actions">
              <button class="btn-primary" (click)="save()" [disabled]="busy() || !selectedBidderId() || !selectedItemId() || !amount">Save</button>
              <button class="btn-secondary" (click)="cancel()">Cancel</button>
            </div>
            <div class="ok" *ngIf="success()">{{ success() }}</div>
            <div class="error" *ngIf="error()">{{ error() }}</div>
          </div>
          <div *ngIf="!selectedEventId()" class="info-card">
            Please select an event to manage winning bids.
          </div>
        </div>

        <div class="card list-card" *ngIf="selectedEventId()">
          <h2>Winning Bids ({{ winningBids().length }})</h2>
          <div class="scroll-area">
            <table>
              <thead>
                <tr>
                  <th>Bidder</th>
                  <th>Item</th>
                  <th>Amt</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let wb of winningBids()" (click)="select(wb)" [class.selected]="existingId() === wb.winning_bid_id">
                  <td>{{ wb.bidder_first_name }} {{ wb.bidder_last_name }}</td>
                  <td>{{ wb.item_desc }}</td>
                  <td>{{ wb.winning_bid }}</td>
                  <td>
                    <button class="btn-danger btn-sm" (click)="delete($event, wb.winning_bid_id)">Delete</button>
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
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .row { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .actions { display: flex; gap: 10px; margin-top: 20px; }
    button { padding: 10px 20px; cursor: pointer; border-radius: 4px; border: none; font-weight: 500; }
    .btn-primary { background: #007bff; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .scroll-area { max-height: 500px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; }
    td { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }
    tr:hover td { background: #f8f9fa; }
    tr.selected td { background: #e7f1ff; }
    .ok { color: #28a745; margin-top: 10px; font-weight: bold; }
    .error { color: #dc3545; margin-top: 10px; font-weight: bold; }
    .info-card { padding: 40px; text-align: center; color: #666; font-style: italic; }
  `]
})
export class WinningBidFormComponent implements OnInit {
  fixedEventId = signal<number | null>(null);
  selectedEventId = signal<number | null>(null);
  eventName = signal<string | null>(null);

  selectedBidderId = signal<number | null>(null);
  selectedItemId = signal<number | null>(null);
  initialBidder: string | null = null;
  initialItem: string | null = null;

  amount = "";
  existingId = signal<number | null>(null);
  winningBids = signal<WinningBidRow[]>([]);

  busy = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit() {
    const id = this.route.snapshot.queryParamMap.get("event_id");
    if (id) {
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

  searchBidders = (q: string) => this.api.listBidders(this.selectedEventId()!, q);
  bidderFormatter = (b: BidderRow) => `${b.bidder_first_name} ${b.bidder_last_name} (${b.bidder_id})`;

  searchItems = (q: string) => this.api.listItems(this.selectedEventId()!, q);
  itemFormatter = (i: ItemRow) => i.item_desc;

  async onEventSelected(e: EventRow) {
    this.selectedEventId.set(e.event_id);
    this.eventName.set(e.event_desc);
    this.cancel();
    await this.refresh();
  }

  onBidderSelected(b: BidderRow) {
    this.selectedBidderId.set(b.bidder_id);
  }
  onItemSelected(i: ItemRow) {
    this.selectedItemId.set(i.item_id);
  }

  async refresh() {
    const id = this.selectedEventId();
    if (!id) return;
    try {
      const list = await firstValueFrom(this.api.listWinningBids(id));
      this.winningBids.set(list);
    } catch (e) {
      console.error(e);
    }
  }

  select(wb: WinningBidRow) {
    this.selectedBidderId.set(wb.bidder_id);
    this.selectedItemId.set(wb.item_id);
    this.amount = wb.winning_bid.toString();
    this.existingId.set(wb.winning_bid_id);
    this.initialBidder = `${wb.bidder_first_name} ${wb.bidder_last_name} (${wb.bidder_id})`;
    this.initialItem = wb.item_desc || "";
  }

  cancel() {
    this.selectedBidderId.set(null);
    this.selectedItemId.set(null);
    this.amount = "";
    this.existingId.set(null);
    this.initialBidder = null;
    this.initialItem = null;
    this.success.set(null);
    this.error.set(null);
  }

  back() {
    if (this.fixedEventId()) {
      window.history.back();
    } else {
      this.router.navigate(["/admin"]);
    }
  }

  async save() {
    if (!this.selectedEventId() || !this.selectedBidderId() || !this.selectedItemId()) return;
    this.busy.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      if (this.existingId()) {
        const res = await firstValueFrom(this.api.updateWinningBid(this.existingId()!, {
          event_id: this.selectedEventId()!,
          bidder_id: this.selectedBidderId()!,
          item_id: this.selectedItemId()!,
          winning_bid: Number(this.amount)
        }));
        this.success.set(`Updated winning bid ${res.winning_bid_id}`);
        this.cancel();
        await this.refresh();
      } else {
        const res = await firstValueFrom(this.api.createWinningBid({
          event_id: this.selectedEventId()!,
          bidder_id: this.selectedBidderId()!,
          item_id: this.selectedItemId()!,
          winning_bid: Number(this.amount)
        }));
        this.success.set(`Recorded winning bid ${res.winning_bid_id}`);
        this.cancel();
        await this.refresh();
      }
    } catch (e: any) {
      this.error.set(e?.message || "Error saving winning bid");
    } finally {
      this.busy.set(false);
    }
  }

  async delete(ev: MouseEvent, id: number) {
    ev.stopPropagation();
    if (!confirm("Are you sure you want to delete this winning bid?")) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteWinningBid(id));
      if (this.existingId() === id) this.cancel();
      await this.refresh();
      this.success.set("Deleted winning bid.");
    } catch (e: any) {
      this.error.set(e?.message || "Error deleting winning bid");
    } finally {
      this.busy.set(false);
    }
  }
}
