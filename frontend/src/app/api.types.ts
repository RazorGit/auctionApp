export type EventRow = {
    event_id: number;
    event_locator: string;
    event_desc: string;
    event_date: string;
    event_tax_id: string | null;
};

export type BidderRow = {
    bidder_id: number;
    event_id: number;
    bidder_num: number | null;
    bidder_first_name: string;
    bidder_last_name: string;
    bidder_email: string | null;
    bidder_credit_card_token: string | null;
};

export type ItemRow = {
    item_id: number;
    event_id: number;
    item_type: "Live" | "Not Live";
    item_desc: string;
    item_notes: string | null;
};

export type WinningBidRow = {
    winning_bid_id: number;
    event_id: number;
    bidder_id: number;
    item_id: number;
    winning_bid: string; // pg returns numeric as string
    bidder_first_name?: string;
    bidder_last_name?: string;
    item_desc?: string;
};

export type SessionUser = {
    user_id: number;
    username: string;
    role: 'admin' | 'user';
    event_id: number | null;
    event_locator: string | null;
};

export type SessionResponse =
    | { authenticated: false }
    | { authenticated: true; user: SessionUser };

export type LoginResponse = { ok: true; user: SessionUser };
