import { z } from "zod";

export const EventCreate = z.object({
  event_desc: z.string().min(1).max(100).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  event_tax_id: z.string().max(16).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }).nullable().optional(),
});

export const BidderCreate = z.object({
  event_id: z.number().int().positive(),
  bidder_num: z.number().int().positive().nullable().optional(),
  bidder_first_name: z.string().min(1).max(100).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }),
  bidder_last_name: z.string().min(1).max(100).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }),
  bidder_email: z.string().email("Invalid email address - please use a proper email format (e.g., user@example.com or x@x.com)").refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }).nullable().optional(),
  bidder_credit_card_token: z.string().max(100).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }).nullable().optional(),
});

export const ItemCreate = z.object({
  event_id: z.number().int().positive(),
  item_type: z.enum(["Live", "Not Live"]),
  item_desc: z.string().min(1).max(100).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }),
  item_notes: z.string().max(100).refine(val => !val.includes('*'), { message: "Asterisk cannot be used" }).nullable().optional(),
});

export const WinningBidCreate = z.object({
  event_id: z.number().int().positive(),
  bidder_id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  winning_bid: z.number().nonnegative(),
});

export const MembershipRequestCreate = z.object({
  event_id: z.number().int().positive(),
});

export const MembershipDecision = z.object({
  status: z.enum(["approved", "denied"]),
});

export const AuctionStart = z.object({
  time_limit_seconds: z.number().int().positive().max(60 * 60 * 24).nullable().optional(),
});

export const AuctionStop = z.object({
  // allow admin to end early
  ended: z.literal(true).optional(),
});

export const BidCreate = z.object({
  event_id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  amount: z.number().positive(),
});

export const EventUpdate = EventCreate;
export const BidderUpdate = BidderCreate;
export const ItemUpdate = ItemCreate;
export const WinningBidUpdate = WinningBidCreate;
