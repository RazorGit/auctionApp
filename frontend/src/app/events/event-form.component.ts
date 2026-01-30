import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { EventRow } from "../api.types";

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="card">
      <h2>New Event</h2>
      <div class="row">
        <label>Description</label>
        <input [(ngModel)]="desc" placeholder="e.g. Annual Gala" />
      </div>
      <div class="row">
        <label>Date</label>
        <input [(ngModel)]="date" placeholder="YYYY-MM-DD" />
      </div>
      <div class="row">
        <label>Tax ID</label>
        <input [(ngModel)]="taxId" placeholder="Optional" />
      </div>
      <button (click)="save()" [disabled]="busy() || !desc || !date">Create Event</button>
      <div class="ok" *ngIf="success()">{{ success() }}</div>
      <div class="error" *ngIf="error()">{{ error() }}</div>
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
export class EventFormComponent {
    desc = "";
    date = "";
    taxId = "";
    busy = signal(false);
    success = signal<string | null>(null);
    error = signal<string | null>(null);

    constructor(private api: ApiService) { }

    async save() {
        this.busy.set(true);
        this.success.set(null);
        this.error.set(null);
        try {
            const res = await firstValueFrom(this.api.createEvent({
                event_desc: this.desc,
                event_date: this.date,
                event_tax_id: this.taxId || null
            }));
            this.success.set(`Created event ${res.event_id}`);
            this.desc = "";
            this.date = "";
            this.taxId = "";
        } catch (e: any) {
            this.error.set(e?.message || "Error creating event");
        } finally {
            this.busy.set(false);
        }
    }
}
