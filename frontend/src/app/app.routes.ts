import { Routes } from "@angular/router";

export const routes: Routes = [
    {
        path: "admin",
        loadComponent: () => import("./admin-dashboard.component").then(m => m.AdminDashboardComponent),
    },
    {
        path: "user/:eventLocator",
        loadComponent: () => import("./user-dashboard.component").then(m => m.UserDashboardComponent),
    },
    {
        path: "events",
        loadComponent: () => import("./events/event-form.component").then(m => m.EventFormComponent),
    },
    {
        path: "bidders",
        loadComponent: () => import("./bidders/bidder-form.component").then(m => m.BidderFormComponent),
    },
    {
        path: "items",
        loadComponent: () => import("./items/item-form.component").then(m => m.ItemFormComponent),
    },
    {
        path: "winning-bids",
        loadComponent: () => import("./winning-bids/winning-bid-form.component").then(m => m.WinningBidFormComponent),
    },
    { path: "", redirectTo: "admin", pathMatch: "full" },
    { path: "**", redirectTo: "admin" },
];
