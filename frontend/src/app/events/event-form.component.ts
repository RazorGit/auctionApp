import { Component, signal, computed, OnInit } from "@angular/core";
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

      <div class="live" *ngIf="success() || error()">
        <div class="live-badge">LIVE</div>
        <div class="live-body">
          <div class="live-title">Auction Control Feed</div>
          <div class="live-msg ok" *ngIf="success()">{{ success() }}</div>
          <div class="live-msg err" *ngIf="error()">{{ error() }}</div>
        </div>
        <button class="live-close" (click)="clearNotifications()">Dismiss</button>
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
            <input type="date" [(ngModel)]="date" required />
          </div>
          <div class="row">
            <label>Tax ID</label>
            <input [(ngModel)]="taxId" placeholder="Optional" />
          </div>
          <div class="actions">
            <button class="btn-primary" (click)="save()" [disabled]="busy() || !desc || !date">Save</button>
            <button class="btn-secondary" (click)="cancel()">Cancel</button>
          </div>
        </div>

        <div class="card list-card">
          <h2>Existing Events</h2>
          <div class="scroll-area">
            <table>
              <thead>
                <tr>
                  <th (click)="toggleSort('event_id')">ID {{ sortColumn() === 'event_id' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th (click)="toggleSort('event_locator')">Locator {{ sortColumn() === 'event_locator' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th (click)="toggleSort('event_desc')">Desc {{ sortColumn() === 'event_desc' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th (click)="toggleSort('event_date')">Date {{ sortColumn() === 'event_date' ? (sortDirection() === 'asc' ? '↑' : '↓') : '' }}</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let e of sortedEvents()" (click)="select(e)" [class.selected]="existingId() === e.event_id">
                  <td style="font-weight: bold;">{{ e.event_id }}</td>
                  <td><code>{{ e.event_locator }}</code></td>
                  <td>{{ e.event_desc }}</td>
                  <td>{{ e.event_date }}</td>
                  <td><b>{{ getStatus(e) }}</b></td>
                  <td>
                    <button
                      class="btn-danger btn-sm"
                      (click)="delete($event, e.event_id)"
                      [disabled]="getStatus(e) === 'ongoing'"
                      [title]="getStatus(e) === 'ongoing' ? 'Cannot delete an ongoing event' : 'Delete event'"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card auction-controls">
        <h2>Auction Controls</h2>
        <p class="muted">Start/stop auctions and set a time limit. Users can bid only while an auction is <b>ongoing</b>.</p>

        <div class="controls-grid">
          <div class="control-row" *ngFor="let e of sortedEvents()">
            <div class="info">
              <div class="title">{{ e.event_desc }}</div>
              <div class="meta">
                ID: {{ e.event_id }} | Locator: <code>{{ e.event_locator }}</code> | Status: <b>{{ getStatus(e) }}</b>
              </div>
              <div class="meta" *ngIf="getStartsAt(e)">Started: {{ getStartsAt(e) }}</div>
              <div class="meta" *ngIf="getEndsAt(e)">Ends/Ended: {{ getEndsAt(e) }}</div>
            </div>

            <div class="actions2">
              <div class="row-inline">
                <label>Time limit (sec)</label>
                <input type="number" min="1" placeholder="e.g. 600" [(ngModel)]="timeLimit[e.event_id]" />
              </div>
              <button class="btn-primary" (click)="startAuction(e.event_id)" [disabled]="busy() || getStatus(e) === 'ongoing'">Start</button>
              <button class="btn-secondary" (click)="stopAuction(e.event_id)" [disabled]="busy() || getStatus(e) !== 'ongoing'">Stop</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }

    .live {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 18px;
      background: linear-gradient(90deg, rgba(255,0,98,0.08), rgba(0,123,255,0.08));
      border: 1px solid rgba(0,0,0,0.10);
      color: #000;
      box-shadow: 0 6px 16px rgba(0,0,0,0.06);
    }
    .live-badge {
      font-weight: 900;
      letter-spacing: 1px;
      font-size: 12px;
      color: white;
      padding: 6px 10px;
      border-radius: 999px;
      background: #ff0062;
    }
    .live-body { flex: 1; min-width: 0; }
    .live-title { font-weight: 800; margin-bottom: 2px; }
    .live-msg { font-size: 13px; }
    .live-msg.ok { color: #1e7e34; font-weight: 700; }
    .live-msg.err { color: #dc3545; font-weight: 700; }
    .live-close {
      border: none;
      background: rgba(0,0,0,0.06);
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
    }

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
    th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; cursor: pointer; user-select: none; }
    td { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }
    tr:hover td { background: #f8f9fa; }
    tr.selected td { background: #e7f1ff; }
    .ok { color: #28a745; margin-top: 10px; font-weight: bold; }
    .error { color: #dc3545; margin-top: 10px; font-weight: bold; }
    .asterisk { color: #dc3545; }
    input:required:invalid { border-color: rgba(220, 53, 69, 0.5); }
    input:required:valid { border-color: rgba(40, 167, 69, 0.3); }

    .auction-controls { margin-top: 20px; }
    .muted { opacity: 0.8; margin-top: 0; }
    .controls-grid { display: grid; gap: 12px; margin-top: 16px; }
    .control-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 12px; }
    .info { flex: 1; }
    .title { font-weight: 800; }
    .meta { font-size: 12px; opacity: 0.85; margin-top: 2px; }
    .actions2 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .row-inline { display: grid; gap: 4px; }
    .row-inline label { font-size: 11px; opacity: 0.7; margin: 0; }
    .row-inline input { width: 140px; }
  `]
})
export class EventFormComponent implements OnInit {
  desc = "";
  date = "";
  taxId = "";
  existingId = signal<number | null>(null);
  events = signal<EventRow[]>([]);
  sortColumn = signal<keyof EventRow | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');
  timeLimit: Record<number, number | null> = {};

  sortedEvents = computed(() => {
    const data = [...this.events()];
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

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit() {
    this.date = this.getTodayLocalDate();
    void this.refresh();
  }

  private getTodayLocalDate(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  async refresh() {
    try {
      const list = await firstValueFrom(this.api.listAuctions());
      this.events.set(list as any);
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

  clearNotifications() {
    this.success.set(null);
    this.error.set(null);
  }

  cancel() {
    this.desc = "";
    this.date = this.getTodayLocalDate();
    this.taxId = "";
    this.existingId.set(null);
    this.clearNotifications();
  }

  back() {
    this.router.navigate(["/admin"]);
  }

  async save() {
    this.busy.set(true);
    this.clearNotifications();
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

  toggleSort(col: keyof EventRow) {
    if (this.sortColumn() === col) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  async startAuction(eventId: number) {
    try {
      const secs = this.timeLimit[eventId] ?? null;
      await firstValueFrom(this.api.startAuction(eventId, secs));
      await this.refresh();
      this.success.set('Auction started.');
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Could not start auction');
    }
  }

  async stopAuction(eventId: number) {
    try {
      await firstValueFrom(this.api.stopAuction(eventId));
      await this.refresh();
      this.success.set('Auction stopped.');
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Could not stop auction');
    }
  }

  getStatus(e: EventRow): string {
    return (e as any).status ?? 'scheduled';
  }

  getStartsAt(e: EventRow): string | null {
    return (e as any).starts_at ?? null;
  }

  getEndsAt(e: EventRow): string | null {
    return (e as any).ends_at ?? null;
  }
}
