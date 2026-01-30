import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow, BidderRow } from "../api.types";

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, TypeaheadComponent],
    template: `
    <div class="card">
      <h2>Bidder Entry</h2>
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
          <label>First Name</label>
          <input [(ngModel)]="firstName" />
        </div>
        <div class="row">
          <label>Last Name</label>
          <input [(ngModel)]="lastName" />
        </div>
        <div class="row">
          <label>Email</label>
          <input [(ngModel)]="email" />
        </div>
        <div class="row">
          <label>Bidder #</label>
          <input [(ngModel)]="bidderNum" placeholder="Optional" />
        </div>
        <button (click)="save()" [disabled]="busy() || !firstName || !lastName">Add Bidder</button>
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
export class BidderFormComponent {
    selectedEventId = signal<number | null>(null);
    firstName = "";
    lastName = "";
    email = "";
    bidderNum = "";
    busy = signal(false);
    success = signal<string | null>(null);
    error = signal<string | null>(null);

    constructor(private api: ApiService) { }

    searchEvents = (q: string) => this.api.listEvents(q);
    eventFormatter = (e: EventRow) => e.event_desc;

    onEventSelected(e: EventRow) {
        this.selectedEventId.set(e.event_id);
    }

    async save() {
        if (!this.selectedEventId()) return;
        this.busy.set(true);
        this.success.set(null);
        this.error.set(null);
        try {
            const res = await firstValueFrom(this.api.createBidder({
                event_id: this.selectedEventId()!,
                bidder_first_name: this.firstName,
                bidder_last_name: this.lastName,
                bidder_email: this.email || null,
                bidder_num: this.bidderNum ? Number(this.bidderNum) : null
            }));
            this.success.set(`Created bidder ${res.bidder_id}`);
            this.firstName = "";
            this.lastName = "";
            this.email = "";
            this.bidderNum = "";
        } catch (e: any) {
            this.error.set(e?.message || "Error creating bidder");
        } finally {
            this.busy.set(false);
        }
    }
}
