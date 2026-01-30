import { Component } from "@angular/core";
import { RouterOutlet, RouterLink } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="container">
      <div class="nav">
        <div>
          <div style="font-weight:700">Auction Admin</div>
          <div style="font-size:12px; color: var(--muted)">Data entry + query</div>
        </div>
        <div class="links">
          <a class="pill" routerLink="/">Dashboard</a>
          <a class="pill" routerLink="/events/new">New Event</a>
          <a class="pill" routerLink="/bidders/new">New Bidder</a>
          <a class="pill" routerLink="/items/new">New Item</a>
          <a class="pill" routerLink="/winning-bids/new">New WinBid</a>
        </div>
      </div>
      <router-outlet></router-outlet>
    </div>
  `
})
export class AppComponent { }
