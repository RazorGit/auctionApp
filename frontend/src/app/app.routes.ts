import { Routes } from "@angular/router";

export const routes: Routes = [
    {
        path: "",
        loadComponent: () => import("./dashboard.component").then(m => m.DashboardComponent),
    },
    {
        path: "events/new",
        loadComponent: () => import("./events/event-form.component").then(m => m.EventFormComponent),
    },
    {
        path: "bidders/new",
        loadComponent: () => import("./bidders/bidder-form.component").then(m => m.BidderFormComponent),
    },
    {
        path: "items/new",
        loadComponent: () => import("./items/item-form.component").then(m => m.ItemFormComponent),
    },
    {
        path: "winning-bids/new",
        loadComponent: () => import("./winning-bids/winning-bid-form.component").then(m => m.WinningBidFormComponent),
    },
    { path: "**", redirectTo: "" },
];
