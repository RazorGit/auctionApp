import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BidderRow, EventRow, ItemRow, WinningBidRow } from "./api.types";

@Injectable({ providedIn: "root" })
export class ApiService {
    // Nginx proxies /api -> api:3000 (docker-compose)
    private base = "/api";

    constructor(private http: HttpClient) { }

    listEvents(q?: string, lookup?: string) {
        let params = new HttpParams();
        if (q) params = params.set("q", q);
        if (lookup) params = params.set("lookup", lookup);
        return this.http.get<EventRow[]>(`${this.base}/events`, { params });
    }

    createEvent(payload: { event_desc: string; event_date: string; event_tax_id?: string | null }) {
        return this.http.post<EventRow>(`${this.base}/events`, payload);
    }

    updateEvent(id: number, payload: { event_desc: string; event_date: string; event_tax_id?: string | null }) {
        return this.http.put<EventRow>(`${this.base}/events/${id}`, payload);
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
        return this.http.get<BidderRow[]>(`${this.base}/bidders`, { params });
    }

    createBidder(payload: {
        event_id: number;
        bidder_num?: number | null;
        bidder_first_name: string;
        bidder_last_name: string;
        bidder_email?: string | null;
        bidder_credit_card_token?: string | null;
    }) {
        return this.http.post<BidderRow>(`${this.base}/bidders`, payload);
    }

    updateBidder(id: number, payload: {
        event_id: number;
        bidder_num?: number | null;
        bidder_first_name: string;
        bidder_last_name: string;
        bidder_email?: string | null;
        bidder_credit_card_token?: string | null;
    }) {
        return this.http.put<BidderRow>(`${this.base}/bidders/${id}`, payload);
    }

    listItems(eventId?: number, q?: string, lookup?: string) {
        let params = new HttpParams();
        if (eventId) params = params.set("event_id", String(eventId));
        if (q) params = params.set("q", q);
        if (lookup) params = params.set("lookup", lookup);
        return this.http.get<ItemRow[]>(`${this.base}/items`, { params });
    }

    createItem(payload: { event_id: number; item_type: "Live" | "Not Live"; item_desc: string; item_notes?: string | null }) {
        return this.http.post<ItemRow>(`${this.base}/items`, payload);
    }

    updateItem(id: number, payload: { event_id: number; item_type: "Live" | "Not Live"; item_desc: string; item_notes?: string | null }) {
        return this.http.put<ItemRow>(`${this.base}/items/${id}`, payload);
    }

    listWinningBids(eventId?: number) {
        const params = eventId ? new HttpParams().set("event_id", String(eventId)) : undefined;
        return this.http.get<WinningBidRow[]>(`${this.base}/winning-bids`, { params });
    }

    createWinningBid(payload: { event_id: number; bidder_id: number; item_id: number; winning_bid: number }) {
        return this.http.post<WinningBidRow>(`${this.base}/winning-bids`, payload);
    }

    updateWinningBid(id: number, payload: { event_id: number; bidder_id: number; item_id: number; winning_bid: number }) {
        return this.http.put<WinningBidRow>(`${this.base}/winning-bids/${id}`, payload);
    }

    deleteEvent(id: number) {
        return this.http.delete<void>(`${this.base}/events/${id}`);
    }

    deleteBidder(id: number) {
        return this.http.delete<void>(`${this.base}/bidders/${id}`);
    }

    deleteItem(id: number) {
        return this.http.delete<void>(`${this.base}/items/${id}`);
    }

    deleteWinningBid(id: number) {
        return this.http.delete<void>(`${this.base}/winning-bids/${id}`);
    }
}
