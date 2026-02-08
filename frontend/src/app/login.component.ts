import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="card">
        <h1>Sign in</h1>
        <p class="subtitle">Use your app credentials.</p>

        <form (ngSubmit)="onSubmit()" class="form">
          <div class="row">
            <label>Username</label>
            <input name="username" [(ngModel)]="username" autocomplete="username" />
          </div>

          <div class="row">
            <label>Password</label>
            <input
              name="password"
              [(ngModel)]="password"
              type="password"
              autocomplete="current-password"
            />
          </div>

          <div class="error" *ngIf="error()">{{ error() }}</div>

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <div class="hint">
          Demo users:
          <ul>
            <li><code>admin</code> / <code>admin</code></li>
            <li><code>user1</code>, <code>user2</code>, <code>user3</code> / <code>pass</code></li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .container { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card {
        width: 100%;
        max-width: 420px;
        background: white;
        border-radius: 14px;
        box-shadow: 0 10px 26px rgba(0,0,0,0.12);
        padding: 22px;
        color: #000;
      }
      h1 { margin: 0 0 6px; }
      .subtitle { margin: 0 0 18px; opacity: 0.8; }
      .form { display: grid; gap: 12px; }
      .row { display: grid; gap: 6px; }
      label { font-size: 12px; opacity: 0.75; }
      input {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,0.18);
      }
      button {
        margin-top: 6px;
        padding: 10px 14px;
        border-radius: 10px;
        border: none;
        background: #007bff;
        color: white;
        cursor: pointer;
      }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      .error {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(220, 53, 69, 0.35);
        background: rgba(220, 53, 69, 0.08);
      }
      .hint { margin-top: 14px; font-size: 12px; opacity: 0.85; }
      ul { margin: 8px 0 0; padding-left: 18px; }
      code { background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 6px; }
    `,
  ],
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private api: ApiService, private router: Router) {}

  async ngOnInit() {
    // If already logged in, redirect immediately.
    try {
      const s = await firstValueFrom(this.api.getSession());
      if (s.authenticated) {
        this.redirectBySession(s.user);
      }
    } catch {
      // ignore
    }
  }

  async onSubmit() {
    this.error.set(null);
    this.loading.set(true);
    try {
      const r = await firstValueFrom(this.api.login(this.username, this.password));
      this.redirectBySession(r.user);
    } catch (e: any) {
      this.error.set('Invalid username or password.');
    } finally {
      this.loading.set(false);
    }
  }

  private redirectBySession(user: any) {
    if (user?.role === 'admin') {
      this.router.navigate(['/admin']);
    } else if (user?.role === 'user') {
      this.router.navigate(['/user']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
