import express from "express";
import cors from "cors";
import { z } from "zod";
import { query } from "./db.js";
import {
  BidderCreate, BidderUpdate,
  EventCreate, EventUpdate,
  ItemCreate, ItemUpdate,
  WinningBidCreate, WinningBidUpdate
} from "./validate.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || true,
    }),
  );

  app.get("/healthz", async (_req, res) => {
    try {
      await query("select 1 as ok");
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  function parseBody(schema, body) {
    const r = schema.safeParse(body);
    if (!r.success) {
      const details = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      const err = new Error("ValidationError");
      err.status = 400;
      err.details = details;
      throw err;
    }
    return r.data;
  }

  app.get("/events", async (req, res) => {
    const q = z
      .object({
        q: z.string().optional(),
        lookup: z.string().optional(),
      })
      .safeParse(req.query);

    if (!q.success) return res.status(400).json({ error: "Invalid query params" });
    const { q: search, lookup } = q.data;

    let sql = "select * from events";
    const params = [];

    if (lookup) {
      const cleanLookup = lookup.trim().toUpperCase();
      if (cleanLookup.length === 8 && /^[0-9A-F]+$/.test(cleanLookup)) {
        // MD5 hash-based locator match
        sql += " where event_locator = $1";
        params.push(cleanLookup);
      } else {
        // Fallback or legacy: sanitized description match
        sql += " where upper(replace(event_desc, ' ', '')) = upper(replace($1, ' ', ''))";
        params.push(lookup);
      }
    } else if (search) {
      sql += " where event_desc ilike $1";
      params.push(`%${search}%`);
    }

    sql += " order by event_date desc, event_id desc";

    const r = await query(sql, params);
    res.json(r.rows);
  });

  app.post("/events", async (req, res, next) => {
    try {
      const body = parseBody(EventCreate, req.body);
      const r = await query(
        `insert into events (event_desc, event_date, event_tax_id)
         values ($1, $2::date, $3)
         returning *`,
        [body.event_desc, body.event_date, body.event_tax_id ?? null],
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.put("/events/:id", async (req, res, next) => {
    try {
      const body = parseBody(EventUpdate, req.body);
      const r = await query(
        `update events set event_desc = $1, event_date = $2, event_tax_id = $3
         where event_id = $4
         returning *`,
        [body.event_desc, body.event_date, body.event_tax_id ?? null, req.params.id],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "NotFound" });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/events/:id", async (req, res, next) => {
    try {
      await query("delete from events where event_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/bidders", async (req, res) => {
    const parser = z.object({
      event_id: z.coerce.number().int().positive().optional(),
      q: z.string().optional(),
      // lookup fields
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
    });

    const parsed = parser.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

    const { event_id, q, first_name, last_name, email } = parsed.data;

    let sql = "select * from bidders where 1=1";
    const params = [];

    if (event_id) {
      params.push(event_id);
      sql += ` and event_id = $${params.length}`;
    }

    if (first_name && last_name && email) {
      // Strict match for record existence
      params.push(first_name, last_name, email);
      const p1 = params.length - 2;
      const p2 = params.length - 1;
      const p3 = params.length;
      sql += ` and upper(replace(bidder_first_name, ' ', '')) = upper(replace($${p1}, ' ', ''))
               and upper(replace(bidder_last_name, ' ', '')) = upper(replace($${p2}, ' ', ''))
               and upper(replace(bidder_email, ' ', '')) = upper(replace($${p3}, ' ', ''))`;
    } else if (q) {
      // Fuzzy search across name/email
      params.push(`%${q}%`);
      sql += ` and (
        bidder_first_name ilike $${params.length} or
        bidder_last_name ilike $${params.length} or
        bidder_email ilike $${params.length}
      )`;
    }

    sql += " order by bidder_num nulls last, bidder_id desc";

    const r = await query(sql, params);
    res.json(r.rows);
  });

  app.post("/bidders", async (req, res, next) => {
    try {
      const body = parseBody(BidderCreate, req.body);
      const r = await query(
        `insert into bidders
          (event_id, bidder_num, bidder_first_name, bidder_last_name, bidder_email, bidder_credit_card_token)
         values ($1,$2,$3,$4,$5,$6)
         returning *`,
        [
          body.event_id,
          body.bidder_num ?? null,
          body.bidder_first_name,
          body.bidder_last_name,
          body.bidder_email ?? null,
          body.bidder_credit_card_token ?? null,
        ],
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.put("/bidders/:id", async (req, res, next) => {
    try {
      const body = parseBody(BidderUpdate, req.body);
      const r = await query(
        `update bidders set
          event_id = $1, bidder_num = $2, bidder_first_name = $3,
          bidder_last_name = $4, bidder_email = $5, bidder_credit_card_token = $6
         where bidder_id = $7
         returning *`,
        [
          body.event_id,
          body.bidder_num ?? null,
          body.bidder_first_name,
          body.bidder_last_name,
          body.bidder_email ?? null,
          body.bidder_credit_card_token ?? null,
          req.params.id
        ],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "NotFound" });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/bidders/:id", async (req, res, next) => {
    try {
      await query("delete from bidders where bidder_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/items", async (req, res) => {
    const parser = z.object({
      event_id: z.coerce.number().int().positive().optional(),
      q: z.string().optional(),
      lookup: z.string().optional(), // item_desc strict match
    });
    const parsed = parser.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
    const { event_id, q, lookup } = parsed.data;

    let sql = "select * from items where 1=1";
    const params = [];

    if (event_id) {
      params.push(event_id);
      sql += ` and event_id = $${params.length}`;
    }

    if (lookup) {
      params.push(lookup);
      sql += ` and upper(replace(item_desc, ' ', '')) = upper(replace($${params.length}, ' ', ''))`;
    } else if (q) {
      params.push(`%${q}%`);
      sql += ` and (item_desc ilike $${params.length} or item_notes ilike $${params.length})`;
    }

    sql += " order by item_id desc";

    const r = await query(sql, params);
    res.json(r.rows);
  });

  app.post("/items", async (req, res, next) => {
    try {
      const body = parseBody(ItemCreate, req.body);
      const r = await query(
        `insert into items (event_id, item_type, item_desc, item_notes)
         values ($1,$2,$3,$4)
         returning *`,
        [body.event_id, body.item_type, body.item_desc, body.item_notes ?? null],
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.put("/items/:id", async (req, res, next) => {
    try {
      const body = parseBody(ItemUpdate, req.body);
      const r = await query(
        `update items set event_id = $1, item_type = $2, item_desc = $3, item_notes = $4
         where item_id = $5
         returning *`,
        [body.event_id, body.item_type, body.item_desc, body.item_notes ?? null, req.params.id],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "NotFound" });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/items/:id", async (req, res, next) => {
    try {
      await query("delete from items where item_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/winning-bids", async (req, res) => {
    const parsed = z.object({ event_id: z.coerce.number().int().positive().optional() }).safeParse(req.query);
    const eventId = parsed.success ? parsed.data.event_id : undefined;

    const r = await query(
      eventId
        ? `select wb.*, b.bidder_first_name, b.bidder_last_name, i.item_desc
           from winning_bids wb
           join bidders b on b.bidder_id = wb.bidder_id
           join items i on i.item_id = wb.item_id
           where wb.event_id = $1
           order by wb.winning_bid_id desc`
        : `select wb.*, b.bidder_first_name, b.bidder_last_name, i.item_desc
           from winning_bids wb
           join bidders b on b.bidder_id = wb.bidder_id
           join items i on i.item_id = wb.item_id
           order by wb.winning_bid_id desc`,
      eventId ? [eventId] : [],
    );
    res.json(r.rows);
  });

  app.post("/winning-bids", async (req, res, next) => {
    try {
      const body = parseBody(WinningBidCreate, req.body);
      const r = await query(
        `insert into winning_bids (event_id, bidder_id, item_id, winning_bid)
         values ($1,$2,$3,$4)
         returning *`,
        [body.event_id, body.bidder_id, body.item_id, body.winning_bid],
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.put("/winning-bids/:id", async (req, res, next) => {
    try {
      const body = parseBody(WinningBidUpdate, req.body);
      const r = await query(
        `update winning_bids set event_id = $1, bidder_id = $2, item_id = $3, winning_bid = $4
         where winning_bid_id = $5
         returning *`,
        [body.event_id, body.bidder_id, body.item_id, body.winning_bid, req.params.id],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "NotFound" });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/winning-bids/:id", async (req, res, next) => {
    try {
      await query("delete from winning_bids where winning_bid_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.use((err, _req, res, _next) => {
    const status = err?.status || 500;
    res.status(status).json({
      error: status === 500 ? "InternalServerError" : "BadRequest",
      message: err?.message || String(err),
      details: err?.details,
    });
  });

  return app;
}
