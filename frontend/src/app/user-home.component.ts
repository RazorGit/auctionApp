import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { UserBidComponent } from './user-bid.component';

@Component({
  standalone: true,
  selector: 'app-user-home',
  imports: [CommonModule, RouterModule, UserBidComponent],
  template: `
    <div class="container">
      <div class="badge">User</div>
      <h1>User Dashboard</h1>
      <p class="subtitle">Register for auctions and place bids once an auction starts.</p>

      <div class="grid">
        <a class="card" routerLink="/user/auctions">
          <h2>Register to a new auction</h2>
          <p>Browse upcoming auctions and request access.</p>
        </a>

        <a class="card" routerLink="/user/history">
          <h2>History of past auctions</h2>
          <p>View auctions you participated in (ended).</p>
        </a>
      </div>

      <div class="livewrap">
        <div class="livehead">
          <h2>Your approved auctions</h2>
          <div class="muted">If an auction is <b>ongoing</b>, you can bid right here.</div>
        </div>

        <div class="muted" *ngIf="loading()">Loading…</div>

        <div *ngIf="!loading() && !approvedLocators().length" class="empty card">
          <h3>No approved auctions yet</h3>
          <p>Go to <b>Register to a new auction</b> and request access. An admin must approve it before you can bid.</p>
        </div>

        <div class="bidgrid" *ngIf="!loading() && approvedLocators().length">
          <app-user-bid *ngFor="let loc of approvedLocators()" [eventLocator]="loc" [embedded]="true"></app-user-bid>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 30px 18px; max-width: 1100px; margin: 0 auto; color: #000; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:#28a745; color:#fff; font-size:12px; letter-spacing:0.6px; text-transform:uppercase; }
    h1 { margin: 12px 0 8px; }
    .subtitle { margin: 0 0 18px; opacity: 0.8; }

    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card { background:#fff; border-radius:14px; padding:18px; box-shadow: 0 6px 16px rgba(0,0,0,0.08); text-decoration:none; color:inherit; }

    .livewrap { margin-top: 18px; }
    .livehead { display:flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
    .muted { opacity: 0.75; }
    .empty.card { text-decoration: none; }

    .bidgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 14px; }
  `]
})
export class UserHomeComponent implements OnInit {
  loading = signal(true);
  approvedLocators = signal<string[]>([]);

  constructor(private api: ApiService) {}

  async ngOnInit() {
    await this.loadApproved();
  }

  async loadApproved() {
    this.loading.set(true);
    try {
      const memberships = await firstValueFrom(this.api.myMemberships());
      const approved = memberships
        .filter((m: any) => m.status === 'approved' && !!m.event_locator)
        .map((m: any) => m.event_locator);
      // de-dupe
      this.approvedLocators.set(Array.from(new Set(approved)));
    } finally {
      this.loading.set(false);
    }
  }
}
