import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BidderRow, EventRow, ItemRow, WinningBidRow, LoginResponse, SessionResponse } from "./api.types";

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
}
