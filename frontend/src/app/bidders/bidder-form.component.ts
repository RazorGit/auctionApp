import { Component, signal, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow, BidderRow } from "../api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadComponent],
  template: `
    <div class="container">
      <div class="header">
        <button class="btn-secondary" (click)="back()">← Back</button>
        <h1>{{ eventName() ? eventName() + ': ' : '' }}Bidder Management</h1>
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

          <div *ngIf="selectedEventId()">
            <h2>{{ existingId() ? 'Update' : 'New' }} Bidder</h2>
            <div class="row">
              <label class="required-label">First Name <span class="asterisk">*</span></label>
              <input [(ngModel)]="firstName" required />
            </div>
            <div class="row">
              <label class="required-label">Last Name <span class="asterisk">*</span></label>
              <input [(ngModel)]="lastName" required />
            </div>
            <div class="row">
              <label>Email</label>
              <input [(ngModel)]="email" />
            </div>
            <div class="row">
              <label>Bidder #</label>
              <input [(ngModel)]="bidderNum" placeholder="Optional" />
            </div>
            <div class="actions">
              <button class="btn-primary" (click)="save()" [disabled]="busy() || !firstName || !lastName">Save</button>
              <button class="btn-secondary" (click)="cancel()">Cancel</button>
            </div>
            <div class="ok" *ngIf="success()">{{ success() }}</div>
            <div class="error" *ngIf="error()">{{ error() }}</div>
          </div>
          <div *ngIf="!selectedEventId()" class="info-card">
            Please select an event to manage bidders.
          </div>
        </div>

        <div class="card list-card" *ngIf="selectedEventId()">
          <h2>Bidders ({{ bidders().length }})</h2>
          <div class="scroll-area">
            <table>
              <thead>
                <tr>
                  <th (click)="toggleSort('bidder_num')"># {{ sortColumn() === 'bidder_num' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th (click)="toggleSort('bidder_last_name')">Name {{ sortColumn() === 'bidder_last_name' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th (click)="toggleSort('bidder_email')">Email {{ sortColumn() === 'bidder_email' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let b of sortedBidders()" (click)="select(b)" [class.selected]="existingId() === b.bidder_id">
                  <td>{{ b.bidder_num ?? '—' }}</td>
                  <td>{{ b.bidder_first_name }} {{ b.bidder_last_name }}</td>
                  <td>{{ b.bidder_email ?? '—' }}</td>
                  <td>
                    <button class="btn-danger btn-sm" (click)="delete($event, b.bidder_id)">Delete</button>
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
    .card { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #000; }
    .row { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; color: #000; }
    input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; color: #000; background: white; }
    .actions { display: flex; gap: 10px; margin-top: 20px; }
    button { padding: 10px 20px; cursor: pointer; border-radius: 4px; border: none; font-weight: 500; }
    .btn-primary { background: #007bff; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .scroll-area { max-height: 500px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; cursor: pointer; user-select: none; }
    td { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }
    tr:hover td { background: #f8f9fa; }
    tr.selected td { background: #e7f1ff; }
    .ok { color: #28a745; margin-top: 10px; font-weight: bold; }
    .error { color: #dc3545; margin-top: 10px; font-weight: bold; }
    .info-card { padding: 40px; text-align: center; color: #000; font-style: italic; }
    .asterisk { color: #dc3545; }
    input:required:invalid { border-color: rgba(220, 53, 69, 0.5); }
    input:required:valid { border-color: rgba(40, 167, 69, 0.3); }
  `]
})
export class BidderFormComponent implements OnInit {
  fixedEventId = signal<number | null>(null);
  selectedEventId = signal<number | null>(null);
  eventName = signal<string | null>(null);

  firstName = "";
  lastName = "";
  email = "";
  bidderNum = "";
  existingId = signal<number | null>(null);
  bidders = signal<BidderRow[]>([]);
  sortColumn = signal<keyof BidderRow | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');

  sortedBidders = computed(() => {
    const data = [...this.bidders()];
    const col = this.sortColumn();
    const dir = this.sortDirection();
    if (!col) return data;

    return data.sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return dir === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal < bVal ? 1 : -1);
    });
  });

  busy = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

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
      // listEvents doesn't have getById, so we list and filter locally or use lookup
      // For now just list all and find (small number of events)
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
    try {
      const list = await firstValueFrom(this.api.listBidders(id));
      this.bidders.set(list);
    } catch (e) {
      console.error(e);
    }
  }

  select(b: BidderRow) {
    this.firstName = b.bidder_first_name;
    this.lastName = b.bidder_last_name;
    this.email = b.bidder_email || "";
    this.bidderNum = b.bidder_num?.toString() || "";
    this.existingId.set(b.bidder_id);
  }

  cancel() {
    this.firstName = "";
    this.lastName = "";
    this.email = "";
    this.bidderNum = "";
    this.existingId.set(null);
    this.success.set(null);
    this.error.set(null);
  }

  back() {
    if (this.fixedEventId()) {
      // Probably came from User Dashboard? Need to know locator.
      // Simplified: just go back in history.
      window.history.back();
    } else {
      this.router.navigate(["/admin"]);
    }
  }

  async save() {
    if (!this.selectedEventId()) return;
    this.busy.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      if (this.existingId()) {
        const res = await firstValueFrom(this.api.updateBidder(this.existingId()!, {
          event_id: this.selectedEventId()!,
          bidder_first_name: this.firstName,
          bidder_last_name: this.lastName,
          bidder_email: this.email || null,
          bidder_num: this.bidderNum ? Number(this.bidderNum) : null
        }));
        this.success.set(`Updated bidder ${res.bidder_id}`);
        this.cancel();
        await this.refresh();
      } else {
        const res = await firstValueFrom(this.api.createBidder({
          event_id: this.selectedEventId()!,
          bidder_first_name: this.firstName,
          bidder_last_name: this.lastName,
          bidder_email: this.email || null,
          bidder_num: this.bidderNum ? Number(this.bidderNum) : null
        }));
        this.success.set(`Created bidder ${res.bidder_id}`);
        this.cancel();
        await this.refresh();
      }
    } catch (e: any) {
      const errorMsg = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || "Error saving bidder";
      this.error.set(errorMsg);
    } finally {
      this.busy.set(false);
    }
  }

  async delete(ev: MouseEvent, id: number) {
    ev.stopPropagation();
    if (!confirm("Are you sure you want to delete this bidder?")) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteBidder(id));
      if (this.existingId() === id) this.cancel();
      await this.refresh();
      this.success.set("Deleted bidder.");
    } catch (e: any) {
      const errorMsg = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || "Error deleting bidder";
      this.error.set(errorMsg);
    } finally {
      this.busy.set(false);
    }
  }

  toggleSort(col: keyof BidderRow) {
    if (this.sortColumn() === col) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }
}
