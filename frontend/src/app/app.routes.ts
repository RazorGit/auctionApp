import { Routes } from "@angular/router";
import { adminGuard } from "./admin.guard";
import { authGuard } from "./auth.guard";

export const routes: Routes = [
    {
        path: "",
        loadComponent: () => import("./login.component").then(m => m.LoginComponent),
        pathMatch: "full",
    },
    {
        path: "admin",
        canMatch: [adminGuard],
        loadComponent: () => import("./admin-dashboard.component").then(m => m.AdminDashboardComponent),
    },
    {
        path: "user/:eventLocator",
        canMatch: [authGuard],
        loadComponent: () => import("./user-dashboard.component").then(m => m.UserDashboardComponent),
    },
    {
        path: "events",
        canMatch: [adminGuard],
        loadComponent: () => import("./events/event-form.component").then(m => m.EventFormComponent),
    },
    {
        path: "bidders",
        canMatch: [authGuard],
        loadComponent: () => import("./bidders/bidder-form.component").then(m => m.BidderFormComponent),
    },
    {
        path: "items",
        canMatch: [authGuard],
        loadComponent: () => import("./items/item-form.component").then(m => m.ItemFormComponent),
    },
    {
        path: "winning-bids",
        canMatch: [authGuard],
        loadComponent: () => import("./winning-bids/winning-bid-form.component").then(m => m.WinningBidFormComponent),
    },
    { path: "**", redirectTo: "" },
];
