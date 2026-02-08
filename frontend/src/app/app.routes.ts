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
        path: "user",
        canMatch: [authGuard],
        loadComponent: () => import("./user-dashboard.component").then(m => m.UserDashboardComponent),
    },
    {
        path: "user/auctions",
        canMatch: [authGuard],
        loadComponent: () => import("./user-auctions.component").then(m => m.UserAuctionsComponent),
    },
    {
        path: "user/history",
        canMatch: [authGuard],
        loadComponent: () => import("./user-history.component").then(m => m.UserHistoryComponent),
    },
    {
        path: "user/auction/:eventLocator/bid",
        canMatch: [authGuard],
        loadComponent: () => import("./user-bid.component").then(m => m.UserBidComponent),
    },

    // legacy route kept for backwards compatibility
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
