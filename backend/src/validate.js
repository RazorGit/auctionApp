import { z } from "zod";

export const EventCreate = z.object({
  event_desc: z.string().min(1).max(100),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  event_tax_id: z.string().max(16).nullable().optional(),
});

export const BidderCreate = z.object({
  event_id: z.number().int().positive(),
  bidder_num: z.number().int().positive().nullable().optional(),
  bidder_first_name: z.string().min(1).max(100),
  bidder_last_name: z.string().min(1).max(100),
  bidder_email: z.string().email().nullable().optional(),
  bidder_credit_card_token: z.string().max(100).nullable().optional(),
});

export const ItemCreate = z.object({
  event_id: z.number().int().positive(),
  item_type: z.enum(["Live", "Not Live"]),
  item_desc: z.string().min(1).max(100),
  item_notes: z.string().max(100).nullable().optional(),
});

export const WinningBidCreate = z.object({
  event_id: z.number().int().positive(),
  bidder_id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  winning_bid: z.number().nonnegative(),
});

export const EventUpdate = EventCreate;
export const BidderUpdate = BidderCreate;
export const ItemUpdate = ItemCreate;
export const WinningBidUpdate = WinningBidCreate;

