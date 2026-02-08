import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BidderRow, EventRow, ItemRow, WinningBidRow, LoginResponse, SessionResponse } from "./api.types";
import { firstValueFrom } from "rxjs";

@Injectable({ providedIn: "root" })
export class ApiService {
    // Nginx proxies /api -> api:3000 (docker-compose)
    private base = "/api";

    constructor(private http: HttpClient) { }

    getSession() {
        return this.http.get<SessionResponse>(`${this.base}/auth/session`, { withCredentials: true });
    }

    login(username: string, password: string) {
        return this.http.post<LoginResponse>(
            `${this.base}/auth/login`,
            { username, password },
            { withCredentials: true },
        );
    }

    logout() {
        return this.http.post<{ ok: true }>(`${this.base}/auth/logout`, {}, { withCredentials: true });
    }

    listEvents(q?: string, lookup?: string) {
        let params = new HttpParams();
        if (q) params = params.set("q", q);
        if (lookup) params = params.set("lookup", lookup);
        return this.http.get<EventRow[]>(`${this.base}/events`, { params, withCredentials: true });
    }

    createEvent(payload: { event_desc: string; event_date: string; event_tax_id?: string | null }) {
        return this.http.post<EventRow>(`${this.base}/events`, payload, { withCredentials: true });
    }

    updateEvent(id: number, payload: { event_desc: string; event_date: string; event_tax_id?: string | null }) {
        return this.http.put<EventRow>(`${this.base}/events/${id}`, payload, { withCredentials: true });
    }

    listBidders(
        eventId?: number,
        q?: string,
        lookup?: { first_name: string; last_name: string; email: string },
    ) {
        let params = new HttpParams();
        if (eventId) params = params.set("event_id", String(eventId));
        if (q) params = params.set("q", q);
        if (lookup) {
            params = params.set("first_name", lookup.first_name);
            params = params.set("last_name", lookup.last_name);
            params = params.set("email", lookup.email);
        }
        return this.http.get<BidderRow[]>(`${this.base}/bidders`, { params, withCredentials: true });
    }

    createBidder(payload: {
        event_id: number;
        bidder_num?: number | null;
        bidder_first_name: string;
        bidder_last_name: string;
        bidder_email?: string | null;
        bidder_credit_card_token?: string | null;
    }) {
        return this.http.post<BidderRow>(`${this.base}/bidders`, payload, { withCredentials: true });
    }

    updateBidder(id: number, payload: {
        event_id: number;
        bidder_num?: number | null;
        bidder_first_name: string;
        bidder_last_name: string;
        bidder_email?: string | null;
        bidder_credit_card_token?: string | null;
    }) {
        return this.http.put<BidderRow>(`${this.base}/bidders/${id}`, payload, { withCredentials: true });
    }

    listItems(eventId?: number, q?: string, lookup?: string) {
        let params = new HttpParams();
        if (eventId) params = params.set("event_id", String(eventId));
        if (q) params = params.set("q", q);
        if (lookup) params = params.set("lookup", lookup);
        return this.http.get<ItemRow[]>(`${this.base}/items`, { params, withCredentials: true });
    }

    createItem(payload: { event_id: number; item_type: "Live" | "Not Live"; item_desc: string; item_notes?: string | null }) {
        return this.http.post<ItemRow>(`${this.base}/items`, payload, { withCredentials: true });
    }

    updateItem(id: number, payload: { event_id: number; item_type: "Live" | "Not Live"; item_desc: string; item_notes?: string | null }) {
        return this.http.put<ItemRow>(`${this.base}/items/${id}`, payload, { withCredentials: true });
    }

    listWinningBids(eventId?: number) {
        const params = eventId ? new HttpParams().set("event_id", String(eventId)) : undefined;
        return this.http.get<WinningBidRow[]>(`${this.base}/winning-bids`, { params, withCredentials: true });
    }

    createWinningBid(payload: { event_id: number; bidder_id: number; item_id: number; winning_bid: number }) {
        return this.http.post<WinningBidRow>(`${this.base}/winning-bids`, payload, { withCredentials: true });
    }

    updateWinningBid(id: number, payload: { event_id: number; bidder_id: number; item_id: number; winning_bid: number }) {
        return this.http.put<WinningBidRow>(`${this.base}/winning-bids/${id}`, payload, { withCredentials: true });
    }

    listAuctions(status?: 'scheduled' | 'ongoing' | 'ended') {
        let params = new HttpParams();
        if (status) params = params.set('status', status);
        return this.http.get<any[]>(`${this.base}/auctions`, { params, withCredentials: true });
    }

    getAuctionByLocator(locator: string) {
        const params = new HttpParams().set('lookup', locator);
        // backend /events already supports lookup; for users it will return only their assigned event.
        return this.http.get<any[]>(`${this.base}/events`, { params, withCredentials: true });
    }

    myMemberships() {
        return this.http.get<any[]>(`${this.base}/memberships/me`, { withCredentials: true });
    }

    requestMembership(eventId: number) {
        return this.http.post<any>(`${this.base}/memberships`, { event_id: eventId }, { withCredentials: true });
    }

    listPendingMemberships() {
        return this.http.get<any[]>(`${this.base}/admin/memberships/pending`, { withCredentials: true });
    }

    decideMembership(membershipId: number, status: 'approved' | 'denied') {
        return this.http.post<any>(`${this.base}/admin/memberships/${membershipId}/decide`, { status }, { withCredentials: true });
    }

    adminAddMember(eventId: number, username: string) {
        return this.http.post<any>(`${this.base}/admin/auctions/${eventId}/members`, { username }, { withCredentials: true });
    }

    startAuction(eventId: number, timeLimitSeconds: number | null) {
        return this.http.post<any>(`${this.base}/admin/auctions/${eventId}/start`, { time_limit_seconds: timeLimitSeconds }, { withCredentials: true });
    }

    stopAuction(eventId: number) {
        return this.http.post<any>(`${this.base}/admin/auctions/${eventId}/stop`, {}, { withCredentials: true });
    }

    listBids(eventId: number, itemId?: number) {
        let params = new HttpParams().set('event_id', String(eventId));
        if (itemId) params = params.set('item_id', String(itemId));
        return this.http.get<any[]>(`${this.base}/bids`, { params, withCredentials: true });
    }

    placeBid(eventId: number, itemId: number, amount: number) {
        return this.http.post<any>(`${this.base}/bids`, { event_id: eventId, item_id: itemId, amount }, { withCredentials: true });
    }

    deleteEvent(id: number) {
        return this.http.delete<void>(`${this.base}/events/${id}`, { withCredentials: true });
    }

    deleteBidder(id: number) {
        return this.http.delete<void>(`${this.base}/bidders/${id}`, { withCredentials: true });
    }

    deleteItem(id: number) {
        return this.http.delete<void>(`${this.base}/items/${id}`, { withCredentials: true });
    }

    deleteWinningBid(id: number) {
        return this.http.delete<void>(`${this.base}/winning-bids/${id}`, { withCredentials: true });
    }

    listUsers() {
        return this.http.get<any[]>(`${this.base}/admin/users`, { withCredentials: true });
    }

    createUser(username: string, password: string = 'pass') {
        return this.http.post<any>(`${this.base}/admin/users`, { username, password }, { withCredentials: true });
    }

    approvedMemberships() {
        return this.http.get<any[]>(`${this.base}/admin/memberships/approved`, { withCredentials: true });
    }

    adminBidHistory(eventId: number) {
        const params = new HttpParams().set('event_id', String(eventId));
        return this.http.get<any>(`${this.base}/admin/bids/history`, { params, withCredentials: true });
    }
}
