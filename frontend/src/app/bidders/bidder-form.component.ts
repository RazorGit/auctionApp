import { Component, signal, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ApiService } from "../api.service";
import { firstValueFrom } from "rxjs";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="btn-secondary" (click)="back()">← Back</button>
        <h1>Bidder Management</h1>
      </div>

      <div class="grid">
        <div class="card form-card">
          <h2>New Bidder (App User)</h2>
          <p class="muted">Creates a new login with default password <code>pass</code>.</p>

          <div class="row">
            <label class="required-label">Username <span class="asterisk">*</span></label>
            <input [(ngModel)]="newUsername" placeholder="e.g. bidder_jane" required />
          </div>

          <div class="actions">
            <button class="btn-primary" (click)="createUser()" [disabled]="busy() || !newUsername">Create</button>
            <button class="btn-secondary" (click)="resetNewUser()">Reset</button>
          </div>

          <div class="ok" *ngIf="success()">{{ success() }}</div>
          <div class="error" *ngIf="error()">{{ error() }}</div>

          <div class="divider"></div>

          <h2>Manually add bidder to an auction</h2>
          <div class="row">
            <label>User</label>
            <select [(ngModel)]="manualUserId">
              <option [ngValue]="null">Select user…</option>
              <option *ngFor="let u of users()" [ngValue]="u.user_id">{{ u.username }}</option>
            </select>
          </div>
          <div class="row">
            <label>Event</label>
            <select [(ngModel)]="manualEventId">
              <option [ngValue]="null">Select event…</option>
              <option *ngFor="let e of events()" [ngValue]="e.event_id">{{ e.event_desc }} ({{ e.event_id }})</option>
            </select>
          </div>
          <button class="btn-primary" (click)="manualAdd()" [disabled]="busy() || !manualUserId || !manualEventId">Add / Approve</button>

          <div class="divider"></div>

          <h2>Join Requests</h2>
          <p class="muted">Approve or deny user requests to join auctions.</p>

          <div *ngIf="loadingPending()" class="muted">Loading…</div>
          <div *ngIf="!loadingPending() && !pending().length" class="muted">No pending requests.</div>

          <div class="list" *ngIf="!loadingPending() && pending().length">
            <div class="row-line" *ngFor="let r of pending()">
              <div>
                <div class="title2">{{ r.username }} → {{ r.event_desc }}</div>
                <div class="meta">Requested: {{ r.requested_at }}</div>
              </div>
              <div class="controls">
                <button class="btn-primary btn-sm" (click)="decide(r.membership_id, 'approved')" [disabled]="busy()">Approve</button>
                <button class="btn-danger btn-sm" (click)="decide(r.membership_id, 'denied')" [disabled]="busy()">Deny</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card list-card">
          <h2>Bidders ({{ accepted().length }})</h2>
          <p class="muted">Accepted bidders are users approved for at least one auction.</p>

          <div class="scroll-area">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of accepted()">
                  <td>{{ a.username }}</td>
                  <td>{{ a.event_desc }}</td>
                  <td><b>{{ a.status }}</b></td>
                  <td>{{ a.requested_at }}</td>
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
    input, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; color: #000; background: white; }
    .actions { display: flex; gap: 10px; margin-top: 10px; }
    button { padding: 10px 20px; cursor: pointer; border-radius: 4px; border: none; font-weight: 500; }
    .btn-primary { background: #007bff; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-sm { padding: 6px 10px; font-size: 12px; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .scroll-area { max-height: 500px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; user-select: none; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
    .ok { color: #28a745; margin-top: 10px; font-weight: bold; }
    .error { color: #dc3545; margin-top: 10px; font-weight: bold; }
    .asterisk { color: #dc3545; }
    .muted { opacity: 0.8; font-size: 13px; margin-top: 0; }
    .divider { height: 1px; background: rgba(0,0,0,0.08); margin: 16px 0; }
    code { background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 6px; }

    .list { display: grid; gap: 10px; margin-top: 10px; }
    .row-line { display:flex; justify-content: space-between; gap: 12px; align-items:center; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 10px 12px; }
    .title2 { font-weight: 800; }
    .meta { font-size: 12px; opacity: 0.85; }
    .controls { display:flex; gap: 8px; }
  `]
})
export class BidderFormComponent implements OnInit {
  busy = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  newUsername = '';

  users = signal<any[]>([]);
  events = signal<any[]>([]);

  manualUserId: number | null = null;
  manualEventId: number | null = null;

  pending = signal<any[]>([]);
  loadingPending = signal(true);

  accepted = signal<any[]>([]);

  constructor(
    private api: ApiService,
    private router: Router
  ) { }

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll() {
    this.busy.set(true);
    this.success.set(null);
    this.error.set(null);

    try {
      const [users, auctions, pending, approved] = await Promise.all([
        firstValueFrom(this.api.listUsers()),
        firstValueFrom(this.api.listAuctions()),
        firstValueFrom(this.api.listPendingMemberships()),
        firstValueFrom(this.api.approvedMemberships()),
      ]);

      this.users.set(users);
      this.events.set(auctions);
      this.pending.set(pending);
      this.accepted.set(approved);
      this.loadingPending.set(false);
    } catch (e) {
      this.error.set('Could not load bidder data.');
    } finally {
      this.busy.set(false);
    }
  }

  resetNewUser() {
    this.newUsername = '';
  }

  async createUser() {
    this.busy.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.createUser(this.newUsername, 'pass'));
      this.success.set(`Created user ${this.newUsername} (password: pass)`);
      this.resetNewUser();
      await this.loadAll();
    } catch (e: any) {
      if (e?.status === 409 || e?.error?.error === 'UsernameAlreadyExists') {
        this.error.set('Username already exists.');
      } else {
        this.error.set('Could not create user.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  async decide(id: number, status: 'approved' | 'denied') {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.decideMembership(id, status));
      this.success.set(`Request ${status}.`);
      await this.loadAll();
    } catch {
      this.error.set('Could not update request.');
    } finally {
      this.busy.set(false);
    }
  }

  async manualAdd() {
    if (!this.manualUserId || !this.manualEventId) return;
    const user = this.users().find(u => u.user_id === this.manualUserId);
    if (!user) return;

    this.busy.set(true);
    try {
      await firstValueFrom(this.api.adminAddMember(this.manualEventId, user.username));
      this.success.set('Member approved.');
      await this.loadAll();
    } catch {
      this.error.set('Could not add member.');
    } finally {
      this.busy.set(false);
    }
  }

  back() {
    this.router.navigate(["/admin"]);
  }
}
