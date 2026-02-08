import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  selector: 'app-user-home',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <div class="badge">User</div>
      <h1>User Dashboard</h1>
      <p class="subtitle">Register for auctions and place bids once an auction starts.</p>

      <div class="grid">
        <a class="card" routerLink="/user/auctions">
          <h2>1) Register to a new auction</h2>
          <p>Browse upcoming auctions and request access.</p>
        </a>

        <a class="card" routerLink="/user/history">
          <h2>2) History of past auctions</h2>
          <p>View auctions you participated in (ended).</p>
        </a>

        <div class="card" *ngIf="activeEventLocator() as loc; else noActive">
          <h2>Place a bid</h2>
          <p *ngIf="activeEventStatus() === 'ongoing'">Your active auction is running. You can bid now.</p>
          <p *ngIf="activeEventStatus() !== 'ongoing'">Bidding will be available once the auction starts.</p>
          <button class="primary" (click)="goBid(loc)" [disabled]="activeEventStatus() !== 'ongoing'">Open bidding</button>
        </div>

        <ng-template #noActive>
          <div class="card">
            <h2>Place a bid</h2>
            <p>No active approved auction yet. Request to join one first.</p>
            <button class="primary" disabled>Open bidding</button>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 30px 18px; max-width: 1000px; margin: 0 auto; color: #000; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:#28a745; color:#fff; font-size:12px; letter-spacing:0.6px; text-transform:uppercase; }
    h1 { margin: 12px 0 8px; }
    .subtitle { margin: 0 0 18px; opacity: 0.8; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card { background:#fff; border-radius:14px; padding:18px; box-shadow: 0 6px 16px rgba(0,0,0,0.08); text-decoration:none; color:inherit; }
    .primary { margin-top: 10px; padding: 10px 12px; border-radius: 10px; border:none; background:#007bff; color:#fff; cursor:pointer; }
    .primary:disabled { opacity: 0.6; cursor:not-allowed; }
  `]
})
export class UserHomeComponent implements OnInit {
  auctions = signal<any[]>([]);

  activeEventLocator = signal<string | null>(null);
  activeEventStatus = signal<'scheduled' | 'ongoing' | 'ended' | null>(null);

  constructor(private api: ApiService, private router: Router) {}

  async ngOnInit() {
    // Find an approved membership and use it as the "active" auction for the simple UX.
    try {
      const memberships = await firstValueFrom(this.api.myMemberships());
      const approved = memberships.find((m: any) => m.status === 'approved');
      if (approved?.event_locator) {
        this.activeEventLocator.set(approved.event_locator);
        this.activeEventStatus.set(approved.event_status);
      }
    } catch {
      // ignore for now
    }
  }

  goBid(locator: string) {
    this.router.navigate([`/user/auction/${locator}/bid`]);
  }
}
