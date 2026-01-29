import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow, BidderRow, ItemRow } from "../api.types";

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, TypeaheadComponent],
    template: `
    <div class="card">
      <h2>Record Winning Bid</h2>
      <div class="row">
        <label>Event</label>
        <app-typeahead
          [searchFn]="searchEvents"
          [formatter]="eventFormatter"
          placeholder="Select Event..."
          (selected)="onEventSelected($event)"
        ></app-typeahead>
      </div>

      <div *ngIf="selectedEventId()">
        <div class="row">
          <label>Bidder</label>
          <app-typeahead
            [searchFn]="searchBidders"
            [formatter]="bidderFormatter"
            placeholder="Search Bidder..."
            (selected)="onBidderSelected($event)"
          ></app-typeahead>
        </div>
        <div class="row">
          <label>Item</label>
          <app-typeahead
            [searchFn]="searchItems"
            [formatter]="itemFormatter"
            placeholder="Search Item..."
            (selected)="onItemSelected($event)"
          ></app-typeahead>
        </div>
        <div class="row">
          <label>Amount</label>
          <input [(ngModel)]="amount" type="number" />
        </div>
        <button (click)="save()" [disabled]="busy() || !selectedBidderId() || !selectedItemId() || !amount">Record Bid</button>
        <div class="ok" *ngIf="success()">{{ success() }}</div>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </div>
    </div>
  `,
    styles: [`
    .card { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 600px; margin: 20px auto; }
    .row { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input { width: 100%; padding: 8px; box-sizing: border-box; }
    button { padding: 10px 20px; cursor: pointer; }
    .ok { color: green; margin-top: 10px; }
    .error { color: red; margin-top: 10px; }
  `]
})
export class WinningBidFormComponent {
    selectedEventId = signal<number | null>(null);
    selectedBidderId = signal<number | null>(null);
    selectedItemId = signal<number | null>(null);
    amount = "";
    busy = signal(false);
    success = signal<string | null>(null);
    error = signal<string | null>(null);

    constructor(private api: ApiService) { }

    searchEvents = (q: string) => this.api.listEvents(q);
    eventFormatter = (e: EventRow) => e.event_desc;

    searchBidders = (q: string) => this.api.listBidders(this.selectedEventId()!, q);
    bidderFormatter = (b: BidderRow) => `${b.bidder_first_name} ${b.bidder_last_name} (${b.bidder_id})`;

    searchItems = (q: string) => this.api.listItems(this.selectedEventId()!, q);
    itemFormatter = (i: ItemRow) => i.item_desc;

    onEventSelected(e: EventRow) {
        this.selectedEventId.set(e.event_id);
    }
    onBidderSelected(b: BidderRow) {
        this.selectedBidderId.set(b.bidder_id);
    }
    onItemSelected(i: ItemRow) {
        this.selectedItemId.set(i.item_id);
    }

    async save() {
        if (!this.selectedEventId() || !this.selectedBidderId() || !this.selectedItemId()) return;
        this.busy.set(true);
        this.success.set(null);
        this.error.set(null);
        try {
            const res = await firstValueFrom(this.api.createWinningBid({
                event_id: this.selectedEventId()!,
                bidder_id: this.selectedBidderId()!,
                item_id: this.selectedItemId()!,
                winning_bid: Number(this.amount)
            }));
            this.success.set(`Recorded winning bid ${res.winning_bid_id}`);
            this.amount = "";
        } catch (e: any) {
            this.error.set(e?.message || "Error recording winning bid");
        } finally {
            this.busy.set(false);
        }
    }
}
