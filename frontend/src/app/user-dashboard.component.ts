import { Component } from "@angular/core";
import { UserHomeComponent } from "./user-home.component";

@Component({
  standalone: true,
  imports: [UserHomeComponent],
  template: `<app-user-home></app-user-home>`,
})
export class UserDashboardComponent {}
