import { Component, signal, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow, ItemRow } from "../api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadComponent],
  template: `
    <div class="container">
      <div class="header">
        <button class="btn-secondary" (click)="back()">← Back</button>
        <h1>{{ eventName() ? eventName() + ': ' : '' }}Item Management</h1>
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
            <h2>{{ existingId() ? 'Update' : 'New' }} Item</h2>
            <div class="row">
              <label>Description</label>
              <input [(ngModel)]="itemDesc" placeholder="e.g. Wine Basket" />
            </div>
            <div class="row">
              <label>Type</label>
              <select [(ngModel)]="itemType">
                <option value="Live">Live</option>
                <option value="Not Live">Not Live</option>
              </select>
            </div>
            <div class="row">
              <label>Notes</label>
              <input [(ngModel)]="itemNotes" placeholder="Optional" />
            </div>
            <div class="actions">
              <button class="btn-primary" (click)="save()" [disabled]="busy() || !itemDesc">Save</button>
              <button class="btn-secondary" (click)="cancel()">Cancel</button>
            </div>
            <div class="ok" *ngIf="successMessage()">{{ successMessage() }}</div>
            <div class="error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
          </div>
          <div *ngIf="!selectedEventId()" class="info-card">
            Please select an event to manage items.
          </div>
        </div>

        <div class="card list-card" *ngIf="selectedEventId()">
          <h2>Items ({{ items().length }})</h2>
          <div class="scroll-area">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Desc</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let i of items()" (click)="select(i)" [class.selected]="existingId() === i.item_id">
                  <td>{{ i.item_type }}</td>
                  <td>{{ i.item_desc }}</td>
                  <td>
                    <button class="btn-danger btn-sm" (click)="delete($event, i.item_id)">Delete</button>
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
    input, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
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
export class ItemFormComponent implements OnInit {
  fixedEventId = signal<number | null>(null);
  selectedEventId = signal<number | null>(null);
  eventName = signal<string | null>(null);

  itemDesc = "";
  itemType: "Live" | "Not Live" = "Live";
  itemNotes = "";

  existingId = signal<number | null>(null);
  items = signal<ItemRow[]>([]);

  busy = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

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

  async onEventSelected(e: EventRow) {
    this.selectedEventId.set(e.event_id);
    this.eventName.set(e.event_desc);
    await this.refresh();
  }

  async refresh() {
    const id = this.selectedEventId();
    if (!id) return;
    try {
      const list = await firstValueFrom(this.api.listItems(id));
      this.items.set(list);
    } catch (e) {
      console.error(e);
    }
  }

  select(i: ItemRow) {
    this.itemDesc = i.item_desc;
    this.itemType = i.item_type;
    this.itemNotes = i.item_notes || "";
    this.existingId.set(i.item_id);
  }

  cancel() {
    this.itemDesc = "";
    this.itemNotes = "";
    this.existingId.set(null);
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  back() {
    if (this.fixedEventId()) {
      window.history.back();
    } else {
      this.router.navigate(["/admin"]);
    }
  }

  async save() {
    if (!this.selectedEventId()) return;
    this.busy.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    try {
      if (this.existingId()) {
        const res = await firstValueFrom(this.api.updateItem(this.existingId()!, {
          event_id: this.selectedEventId()!,
          item_type: this.itemType,
          item_desc: this.itemDesc,
          item_notes: this.itemNotes || null
        }));
        this.successMessage.set(`Updated item ${res.item_id}`);
        this.cancel();
        await this.refresh();
      } else {
        const res = await firstValueFrom(this.api.createItem({
          event_id: this.selectedEventId()!,
          item_type: this.itemType,
          item_desc: this.itemDesc,
          item_notes: this.itemNotes || null
        }));
        this.successMessage.set(`Item created! ID: ${res.item_id}`);
        this.cancel();
        await this.refresh();
      }
    } catch (e: any) {
      this.errorMessage.set(e?.message || "Error saving item");
    } finally {
      this.busy.set(false);
    }
  }

  async delete(ev: MouseEvent, id: number) {
    ev.stopPropagation();
    if (!confirm("Are you sure you want to delete this item?")) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteItem(id));
      if (this.existingId() === id) this.cancel();
      await this.refresh();
      this.successMessage.set("Deleted item.");
    } catch (e: any) {
      this.errorMessage.set(e?.message || "Error deleting item");
    } finally {
      this.busy.set(false);
    }
  }
}
