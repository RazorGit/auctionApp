import { Component, OnInit, computed, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";
import { EventRow } from "./api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div class="role-badge">Admin Mode</div>
      <h1>Admin Dashboard</h1>

      <div class="grid">
        <a class="card clickable" routerLink="/events">
          <h2>Events</h2>
          <p>Create and manage auction events (including start/stop controls).</p>
        </a>

        <a class="card clickable" routerLink="/bidders">
          <h2>Bidders</h2>
          <p>Manage bidders and registrations.</p>
          <div class="hint">Create users, approve join requests, and assign bidders to auctions.</div>
        </a>

        <div class="card">
          <h2>Items</h2>
          <p>Manage auction items and types.</p>

          <div class="loading" *ngIf="loading()">Loading events…</div>
          <div class="error" *ngIf="!loading() && error()">{{ error() }}</div>

          <div class="row" *ngIf="!loading() && !error()">
            <label>Event</label>
            <select [(ngModel)]="selectedItemLocator">
              <option *ngFor="let e of events()" [ngValue]="e.event_locator">
                {{ e.event_desc }} ({{ e.event_locator }})
              </option>
            </select>
            <button class="btn-primary" (click)="openItems()" [disabled]="!selectedItemLocator">Open</button>
          </div>
        </div>

        <div class="card">
          <h2>Winning Bids</h2>
          <p>Record and view winning bids.</p>

          <div class="loading" *ngIf="loading()">Loading events…</div>
          <div class="error" *ngIf="!loading() && error()">{{ error() }}</div>

          <div class="row" *ngIf="!loading() && !error()">
            <label>Event</label>
            <select [(ngModel)]="selectedWinningLocator">
              <option *ngFor="let e of events()" [ngValue]="e.event_locator">
                {{ e.event_desc }} ({{ e.event_locator }})
              </option>
            </select>
            <button class="btn-primary" (click)="openWinningBids()" [disabled]="!selectedWinningLocator">Open</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1000px; margin: 0 auto; }
    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #333;
      color: white;
      border-radius: 20px;
      font-size: 12px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    h1 { color: #000; margin-bottom: 30px; text-align: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }

    .card {
      padding: 24px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      transition: transform 0.2s, box-shadow 0.2s;
      text-align: left;
      color: #000;
      text-decoration: none;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 12px rgba(0,0,0,0.1);
    }
    .clickable { cursor: pointer; }

    h2 { color: #007bff; margin-bottom: 10px; }
    p { color: #000; font-size: 14px; margin: 0 0 12px; }

    .row { display: grid; gap: 8px; }
    label { font-size: 12px; color: #000; opacity: 0.75; }
    select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px; background: white; color: #000; }

    .btn-primary { padding: 10px 14px; border-radius: 8px; border: none; background: #007bff; color: white; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .loading { font-size: 13px; opacity: 0.75; }
    .error { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(220, 53, 69, 0.35); background: rgba(220, 53, 69, 0.08); }
  `]
})
export class AdminDashboardComponent implements OnInit {
  events = signal<EventRow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  selectedItemLocator = "";
  selectedWinningLocator = "";

  constructor(private api: ApiService, private router: Router) { }

  async ngOnInit() {
    await this.loadEvents();
  }

  private async loadEvents() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const rows = await firstValueFrom(this.api.listEvents());
      this.events.set(rows);

      if (!rows.length) {
        this.error.set("No events exist yet. Create one first.");
        this.selectedItemLocator = "";
        return;
      }

      this.selectedItemLocator = rows[0].event_locator;
      this.selectedWinningLocator = rows[0].event_locator;
    } catch (e) {
      this.error.set("Could not load events. Please try again.");
      this.selectedItemLocator = "";
      this.selectedWinningLocator = "";
    } finally {
      this.loading.set(false);
    }
  }

  openItems() {
    if (!this.selectedItemLocator) return;
    this.router.navigate(["/items"], { queryParams: { event_locator: this.selectedItemLocator } });
  }

  openWinningBids() {
    if (!this.selectedWinningLocator) return;
    this.router.navigate(["/winning-bids"], { queryParams: { event_locator: this.selectedWinningLocator } });
  }
}
