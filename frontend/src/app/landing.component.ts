import { CommonModule } from "@angular/common";
import { Component, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";
import { EventRow } from "./api.types";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <h1>Auction Webapp</h1>
      <p class="subtitle">Choose a mode</p>

      <div class="grid">
        <a class="card" routerLink="/admin">
          <div class="badge">Admin</div>
          <h2>Admin Dashboard</h2>
          <p>Create events, manage bidders/items, and record winning bids.</p>
        </a>

        <div class="card">
          <div class="badge green">User</div>
          <h2>Event Dashboard</h2>
          <p>Select an event to open.</p>

          <div *ngIf="loading()" class="loading">Loading events…</div>

          <div *ngIf="!loading() && error()" class="error">
            {{ error() }}
          </div>

          <div *ngIf="!loading() && !error()" class="row">
            <label>Event</label>
            <select [(ngModel)]="selectedLocator">
              <option [ngValue]="''" disabled>Select an event…</option>
              <option *ngFor="let e of events()" [ngValue]="e.event_locator">
                {{ e.event_desc }} ({{ e.event_locator }})
              </option>
            </select>
          </div>

          <button (click)="goUser()" [disabled]="!canOpen()">Open</button>

          <div class="hint" *ngIf="!loading() && !error()">
            Tip: create events in <a routerLink="/events">Admin → Events</a>.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 48px 16px; max-width: 980px; margin: 0 auto; text-align: center; }
    h1 { margin: 0 0 8px; color: #000; }
    .subtitle { margin: 0 0 28px; color: #000; opacity: 0.85; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }

    .card {
      display: block;
      text-decoration: none;
      color: inherit;
      padding: 22px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.08);
      text-align: left;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      background: #333;
      color: white;
      border-radius: 999px;
      font-size: 12px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .badge.green { background: #28a745; }

    h2 { margin: 0 0 8px; color: #000; }
    p { margin: 0 0 16px; color: #000; opacity: 0.9; }

    .row { display: grid; gap: 6px; margin-top: 8px; }
    label { font-size: 12px; color: #000; opacity: 0.75; }

    select {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.15);
      background: white;
      color: #000;
    }

    button {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 10px;
      border: none;
      background: #007bff;
      color: white;
      cursor: pointer;
    }
    button[disabled] { opacity: 0.5; cursor: not-allowed; }

    .hint { margin-top: 10px; font-size: 12px; color: #000; opacity: 0.75; }
    .hint a { color: #007bff; text-decoration: none; }
    .loading { margin-top: 8px; font-size: 13px; color: #000; opacity: 0.75; }
    .error {
      margin-top: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(220, 53, 69, 0.35);
      background: rgba(220, 53, 69, 0.08);
      color: #000;
    }
  `],
})
export class LandingComponent implements OnInit {
  events = signal<EventRow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  selectedLocator = "";

  canOpen = computed(() => !this.loading() && !this.error() && !!this.selectedLocator);

  constructor(private api: ApiService) {}

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
        this.error.set("No events exist yet. Ask an admin to create one first.");
        this.selectedLocator = "";
        return;
      }

      // Default to first event for convenience.
      this.selectedLocator = rows[0].event_locator;
    } catch (e) {
      this.error.set("Could not load events. Please try again.");
      this.selectedLocator = "";
    } finally {
      this.loading.set(false);
    }
  }

  goUser() {
    if (!this.selectedLocator) return;
    window.location.href = `/user/${encodeURIComponent(this.selectedLocator)}`;
  }
}
