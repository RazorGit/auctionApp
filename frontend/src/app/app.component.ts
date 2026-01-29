import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
    selector: "app-root",
    imports: [RouterOutlet],
    template: `
    <div class="container">
      <div class="nav">
        <div>
          <div style="font-weight:700">Auction Admin</div>
          <div style="font-size:12px; color: var(--muted)">Data entry + query</div>
        </div>
        <div class="links">
          <a class="pill" href="/">Dashboard</a>
          <a class="pill" href="/api/healthz" target="_blank" rel="noreferrer">API health</a>
        </div>
      </div>
      <router-outlet></router-outlet>
    </div>
  `
})
export class AppComponent {}

