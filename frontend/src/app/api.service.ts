import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BidderRow, EventRow, ItemRow, WinningBidRow } from "./api.types";

@Injectable({ providedIn: "root" })
export class ApiService {
  // Nginx proxies /api -> api:3000 (docker-compose)
  private base = "/api";

  constructor(private http: HttpClient) {}

  listEvents(q?: string) {
    const params = q ? new HttpParams().set("q", q) : undefined;
    return this.http.get<EventRow[]>(`${this.base}/events`, { params });
  }

  createEvent(payload: { event_desc: string; event_date: string; event_tax_id?: string | null }) {
    return this.http.post<EventRow>(`${this.base}/events`, payload);
  }

  listBidders(eventId?: number) {
    const params = eventId ? new HttpParams().set("event_id", String(eventId)) : undefined;
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

  listItems(eventId?: number) {
    const params = eventId ? new HttpParams().set("event_id", String(eventId)) : undefined;
    return this.http.get<ItemRow[]>(`${this.base}/items`, { params });
  }

  createItem(payload: { event_id: number; item_type: "Live" | "Not Live"; item_desc: string; item_notes?: string | null }) {
    return this.http.post<ItemRow>(`${this.base}/items`, payload);
  }

  listWinningBids(eventId?: number) {
    const params = eventId ? new HttpParams().set("event_id", String(eventId)) : undefined;
    return this.http.get<WinningBidRow[]>(`${this.base}/winning-bids`, { params });
  }

  createWinningBid(payload: { event_id: number; bidder_id: number; item_id: number; winning_bid: number }) {
    return this.http.post<WinningBidRow>(`${this.base}/winning-bids`, payload);
  }
}

