import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterModule, Router } from "@angular/router";
import { ApiService } from "./api.service";
import { firstValueFrom } from "rxjs";
import { EventRow } from "./api.types";

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div *ngIf="loading()" class="loading">Locating event...</div>
      
      <div *ngIf="!loading() && event()">
        <div class="role-badge">Event Dashboard</div>
        <h1>{{ event()?.event_desc }}</h1>
        <p class="subtitle">
          ID: {{ event()?.event_id }} | 
          Locator: <code>{{ event()?.event_locator }}</code> |
          Date: {{ event()?.event_date }}
        </p>
        
        <div class="grid">
          <div class="card clickable" [routerLink]="['/bidders']" [queryParams]="{ event_id: event()?.event_id }">
            <h2>Bidders</h2>
            <p>Register and manage bidders for this event.</p>
          </div>
          <div class="card clickable" [routerLink]="['/items']" [queryParams]="{ event_id: event()?.event_id }">
            <h2>Items</h2>
            <p>Manage items for this event.</p>
          </div>
          <div class="card clickable" [routerLink]="['/winning-bids']" [queryParams]="{ event_id: event()?.event_id }">
            <h2>Winning Bids</h2>
            <p>Record winning bids for this event.</p>
          </div>
        </div>
      </div>

      <div *ngIf="!loading() && !event()" class="error-card">
        <h1>Event Not Found</h1>
        <p>We couldn't find an event with the locator: <b>{{ locator }}</b></p>
        <button (click)="goHome()">Back to Admin</button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1000px; margin: 0 auto; text-align: center; }
    .role-badge { 
      display: inline-block; 
      padding: 4px 12px; 
      background: #28a745; 
      color: white; 
      border-radius: 20px; 
      font-size: 12px; 
      margin-bottom: 20px; 
      text-transform: uppercase; 
      letter-spacing: 1px;
    }
    h1 { color: #000; margin-bottom: 10px; }
    .subtitle { color: #000; margin-bottom: 40px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px; }
    .card { 
      padding: 30px; 
      background: white; 
      border-radius: 15px; 
      box-shadow: 0 4px 15px rgba(0,0,0,0.08); 
      transition: all 0.3s ease;
      color: #000;
    }
    .card:hover { 
      transform: translateY(-8px); 
      box-shadow: 0 12px 25px rgba(0,0,0,0.12); 
    }
    .clickable { cursor: pointer; }
    h2 { color: #28a745; margin-bottom: 15px; }
    p { color: #000; line-height: 1.5; }
    .loading { font-size: 1.2rem; color: #000; margin-top: 50px; }
    .error-card { padding: 40px; background: #fff5f5; border-radius: 12px; border: 1px solid #feb2b2; color: #000; }
    button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
  `]
})
export class UserDashboardComponent implements OnInit {
  locator: string | null = null;
  event = signal<EventRow | null>(null);
  loading = signal(true);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) { }

  async ngOnInit() {
    this.locator = this.route.snapshot.paramMap.get("eventLocator");
    if (this.locator) {
      await this.resolveEvent();
    } else {
      this.loading.set(false);
    }
  }

  async resolveEvent() {
    try {
      const results = await firstValueFrom(this.api.listEvents(undefined, this.locator!));
      if (results && results.length > 0) {
        this.event.set(results[0]);
      }
    } catch (e) {
      console.error("Error resolving event", e);
    } finally {
      this.loading.set(false);
    }
  }

  goHome() {
    this.router.navigate(["/admin"]);
  }
}
