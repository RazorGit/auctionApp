import { Component, signal, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";
import { EventRow } from "../api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="btn-secondary" (click)="back()">← Back</button>
        <h1>Event Management</h1>
      </div>

      <div class="grid">
        <div class="card form-card">
          <h2>{{ existingId() ? 'Update' : 'New' }} Event</h2>
          <div class="row">
            <label class="required-label">Description <span class="asterisk">*</span></label>
            <input [(ngModel)]="desc" placeholder="e.g. Annual Gala" required />
          </div>
          <div class="row">
            <label class="required-label">Date <span class="asterisk">*</span></label>
            <input [(ngModel)]="date" placeholder="YYYY-MM-DD" required />
          </div>
          <div class="row">
            <label>Tax ID</label>
            <input [(ngModel)]="taxId" placeholder="Optional" />
          </div>
          <div class="actions">
            <button class="btn-primary" (click)="save()" [disabled]="busy() || !desc || !date">Save</button>
            <button class="btn-secondary" (click)="cancel()">Cancel</button>
          </div>
          <div class="ok" *ngIf="success()">{{ success() }}</div>
          <div class="error" *ngIf="error()">{{ error() }}</div>
        </div>

        <div class="card list-card">
          <h2>Existing Events</h2>
          <div class="scroll-area">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Locator</th>
                  <th>Desc</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let e of events()" (click)="select(e)" [class.selected]="existingId() === e.event_id">
                  <td style="font-weight: bold;">{{ e.event_id }}</td>
                  <td><code>{{ e.event_locator }}</code></td>
                  <td>{{ e.event_desc }}</td>
                  <td>{{ e.event_date }}</td>
                  <td>
                    <button class="btn-danger btn-sm" (click)="delete($event, e.event_id)">Delete</button>
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
    .scroll-area { max-height: 400px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; }
    td { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }
    tr:hover td { background: #f8f9fa; }
    tr.selected td { background: #e7f1ff; }
    .ok { color: #28a745; margin-top: 10px; font-weight: bold; }
    .error { color: #dc3545; margin-top: 10px; font-weight: bold; }
    .asterisk { color: #dc3545; }
    input:required:invalid { border-color: rgba(220, 53, 69, 0.5); }
    input:required:valid { border-color: rgba(40, 167, 69, 0.3); }
  `]
})
export class EventFormComponent implements OnInit {
  desc = "";
  date = "";
  taxId = "";
  existingId = signal<number | null>(null);
  events = signal<EventRow[]>([]);
  busy = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    try {
      const list = await firstValueFrom(this.api.listEvents());
      this.events.set(list);
    } catch (e) {
      console.error(e);
    }
  }

  select(e: EventRow) {
    this.desc = e.event_desc;
    // Sanitize ISO date to YYYY-MM-DD for backend validation
    this.date = e.event_date ? e.event_date.split("T")[0] : "";
    this.taxId = e.event_tax_id || "";
    this.existingId.set(e.event_id);
  }

  cancel() {
    this.desc = "";
    this.date = "";
    this.taxId = "";
    this.existingId.set(null);
    this.success.set(null);
    this.error.set(null);
  }

  back() {
    this.router.navigate(["/admin"]);
  }

  async save() {
    this.busy.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      if (this.existingId()) {
        const res = await firstValueFrom(this.api.updateEvent(this.existingId()!, {
          event_desc: this.desc,
          event_date: this.date,
          event_tax_id: this.taxId || null
        }));
        this.success.set(`Updated event ${res.event_id}`);
        this.cancel();
        await this.refresh();
      } else {
        const res = await firstValueFrom(this.api.createEvent({
          event_desc: this.desc,
          event_date: this.date,
          event_tax_id: this.taxId || null
        }));
        this.success.set(`Created event ${res.event_id}`);
        this.cancel();
        await this.refresh();
      }
    } catch (e: any) {
      const errorMsg = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || "Error saving event";
      this.error.set(errorMsg);
    } finally {
      this.busy.set(false);
    }
  }

  async delete(ev: MouseEvent, id: number) {
    ev.stopPropagation();
    if (!confirm("Are you sure you want to delete this event?")) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteEvent(id));
      if (this.existingId() === id) this.cancel();
      await this.refresh();
      this.success.set("Deleted event.");
    } catch (e: any) {
      const errorMsg = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || "Error deleting event";
      this.error.set(errorMsg);
    } finally {
      this.busy.set(false);
    }
  }
}
