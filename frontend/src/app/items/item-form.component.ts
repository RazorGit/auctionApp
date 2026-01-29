import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { TypeaheadComponent } from "../typeahead/typeahead.component";
import { EventRow, ItemRow } from "../api.types";

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule, TypeaheadComponent],
    template: `
    <div class="card">
      <h2>Item Entry</h2>
      
      <div class="row">
        <label>Event (Select First)</label>
        <app-typeahead
          [searchFn]="searchEvents"
          [formatter]="eventFormatter"
          placeholder="Select Event..."
          (selected)="onEventSelected($event)"
        ></app-typeahead>
      </div>

      <div *ngIf="selectedEventId()">
        <div class="row">
          <label>Description (Search/Create)</label>
          <app-typeahead
             [searchFn]="searchItems"
             [formatter]="itemFormatter"
             placeholder="Item description..."
             (selected)="onItemSelected($event)"
             (queryChange)="onDescChange($event)"
          ></app-typeahead>
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
        
        <button (click)="save()" [disabled]="busy() || !isValid()">{{ existingId() ? 'Update' : 'Create' }}</button>
        
        <div class="ok" *ngIf="successMessage()">{{ successMessage() }}</div>
        <div class="error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
        <div class="info" *ngIf="existingId()">Record exists. Loaded data for update.</div>
      </div>
    </div>
  `,
    styles: [`
    .card { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 600px; margin: 20px auto; }
    .row { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, select { width: 100%; padding: 8px; box-sizing: border-box; }
    button { padding: 10px 20px; cursor: pointer; }
    .ok { color: green; margin-top: 10px; }
    .error { color: red; margin-top: 10px; }
  `]
})
export class ItemFormComponent {
    selectedEventId = signal<number | null>(null);

    itemDesc = "";
    itemType: "Live" | "Not Live" = "Live";
    itemNotes = "";

    existingId = signal<number | null>(null);
    busy = signal(false);
    successMessage = signal<string | null>(null);
    errorMessage = signal<string | null>(null);

    constructor(private api: ApiService) { }

    searchEvents = (query: string) => this.api.listEvents(query);
    eventFormatter = (e: EventRow) => e.event_desc;

    searchItems = (query: string) => this.api.listItems(this.selectedEventId()!, query);
    itemFormatter = (i: ItemRow) => i.item_desc;

    onEventSelected(e: EventRow) {
        this.selectedEventId.set(e.event_id);
        this.resetForm();
    }

    onItemSelected(i: ItemRow) {
        this.populateForm(i);
    }

    onDescChange(val: string) {
        this.itemDesc = val;
        this.existingId.set(null);
        this.checkExistence(val);
    }

    async checkExistence(val: string) {
        if (!this.selectedEventId() || !val || val.length < 2) return;
        try {
            const results = await firstValueFrom(this.api.listItems(this.selectedEventId()!, undefined, val));
            if (results && results.length > 0) {
                this.populateForm(results[0]);
            }
        } catch (e) { console.error(e); }
    }

    populateForm(i: ItemRow) {
        this.itemDesc = i.item_desc;
        this.itemType = i.item_type;
        this.itemNotes = i.item_notes || "";
        this.existingId.set(i.item_id);
    }

    resetForm() {
        this.itemDesc = "";
        this.itemNotes = "";
        this.existingId.set(null);
        this.successMessage.set(null);
        this.errorMessage.set(null);
    }

    isValid() {
        return this.selectedEventId() && this.itemDesc;
    }

    async save() {
        this.busy.set(true);
        this.successMessage.set(null);
        this.errorMessage.set(null);

        try {
            if (this.existingId()) {
                this.errorMessage.set("Update not implemented in backend.");
            } else {
                const res = await firstValueFrom(this.api.createItem({
                    event_id: this.selectedEventId()!,
                    item_type: this.itemType,
                    item_desc: this.itemDesc,
                    item_notes: this.itemNotes || null
                }));
                this.successMessage.set(`Item created! ID: ${res.item_id}`);
                this.existingId.set(res.item_id);
            }
        } catch (e: any) {
            this.errorMessage.set(e?.message || "Error saving item");
        } finally {
            this.busy.set(false);
        }
    }
}
