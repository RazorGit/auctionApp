import express from "express";
import cors from "cors";
import { z } from "zod";
import { query } from "./db.js";
import { BidderCreate, EventCreate, ItemCreate, WinningBidCreate } from "./validate.js";

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
    const q = z.object({ q: z.string().optional() }).safeParse(req.query);
    const search = q.success ? q.data.q : undefined;

    const sql = search
      ? "select * from events where event_desc ilike $1 order by event_date desc, event_id desc"
      : "select * from events order by event_date desc, event_id desc";
    const params = search ? [`%${search}%`] : [];
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

  app.get("/bidders", async (req, res) => {
    const parsed = z.object({ event_id: z.coerce.number().int().positive().optional() }).safeParse(req.query);
    const eventId = parsed.success ? parsed.data.event_id : undefined;

    const r = await query(
      eventId
        ? "select * from bidders where event_id=$1 order by bidder_num nulls last, bidder_id desc"
        : "select * from bidders order by bidder_id desc",
      eventId ? [eventId] : [],
    );
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

  app.get("/items", async (req, res) => {
    const parsed = z.object({ event_id: z.coerce.number().int().positive().optional() }).safeParse(req.query);
    const eventId = parsed.success ? parsed.data.event_id : undefined;

    const r = await query(
      eventId ? "select * from items where event_id=$1 order by item_id desc" : "select * from items order by item_id desc",
      eventId ? [eventId] : [],
    );
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

