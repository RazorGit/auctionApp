import { Routes } from "@angular/router";
import { DashboardComponent } from "./app/dashboard.component";

export const routes: Routes = [
  { path: "", component: DashboardComponent },
  { path: "**", redirectTo: "" },
];

