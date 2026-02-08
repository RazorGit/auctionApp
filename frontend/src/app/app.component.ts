import { Component, OnInit, signal } from "@angular/core";
import { RouterOutlet, Router, NavigationEnd } from "@angular/router";
import { CommonModule } from "@angular/common";
import { filter } from "rxjs";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";
import { SessionUser } from "./api.types";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="topbar" *ngIf="user() as u">
      <div class="left">
        <b class="brand" (click)="goHomeByRole()">Auction Webapp</b>
        <span class="sep">|</span>
        <span>{{ u.username }}</span>
      </div>
      <button class="link" (click)="logoff()">Log off</button>
    </div>

    <router-outlet></router-outlet>
  `,
  styles: [`
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #fff;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      color: #000;
    }
    .left { display: flex; gap: 10px; align-items: center; }
    .brand { cursor: pointer; }
    .sep { opacity: 0.4; }
    .link { background: transparent; border: none; color: #007bff; cursor: pointer; }
  `]
})
export class AppComponent implements OnInit {
  user = signal<SessionUser | null>(null);

  constructor(private api: ApiService, private router: Router) { }

  async ngOnInit() {
    await this.refreshSession();

    // Keep the topbar in sync when navigation happens (e.g., after login redirect).
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        void this.refreshSession();
      });
  }

  private async refreshSession() {
    try {
      const s = await firstValueFrom(this.api.getSession());
      this.user.set(s.authenticated ? s.user : null);
    } catch {
      this.user.set(null);
    }
  }

  goHomeByRole() {
    const u = this.user();
    if (!u) return;
    if (u.role === 'admin') {
      this.router.navigate(['/admin']);
    } else if (u.role === 'user' && u.event_locator) {
      this.router.navigate([`/user/${u.event_locator}`]);
    }
  }

  async logoff() {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.user.set(null);
      this.router.navigate(["/"]);
    }
  }
}
