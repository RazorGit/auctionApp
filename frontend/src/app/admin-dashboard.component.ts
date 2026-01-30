import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div class="role-badge">Admin Mode</div>
      <h1>Admin Dashboard</h1>
      <div class="grid">
        <div class="card clickable" [routerLink]="['/events']">
          <h2>Events</h2>
          <p>Create and manage auction events.</p>
        </div>
        <div class="card clickable" [routerLink]="['/bidders']">
          <h2>Bidders</h2>
          <p>Manage bidders and registrations.</p>
        </div>
        <div class="card clickable" [routerLink]="['/items']">
          <h2>Items</h2>
          <p>Manage auction items and types.</p>
        </div>
        <div class="card clickable" [routerLink]="['/winning-bids']">
          <h2>Winning Bids</h2>
          <p>Record and view winning bids.</p>
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
    h1 { color: #333; margin-bottom: 30px; text-align: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .card { 
      padding: 24px; 
      background: white; 
      border-radius: 12px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
      transition: transform 0.2s, box-shadow 0.2s;
      text-align: center;
    }
    .card:hover { 
      transform: translateY(-5px); 
      box-shadow: 0 8px 12px rgba(0,0,0,0.1); 
    }
    .clickable { cursor: pointer; }
    h2 { color: #007bff; margin-bottom: 10px; }
    p { color: #666; font-size: 14px; }
  `]
})
export class AdminDashboardComponent { }
