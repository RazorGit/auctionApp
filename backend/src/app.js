import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
  app.use(cookieParser());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
    }),
  );

  const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";

  function setSessionCookie(res, session) {
    // Minimal, unsigned cookie-based session.
    // NOTE: Not secure for real apps; replace with signed cookies/JWT/bcrypt later.
    res.cookie(SESSION_COOKIE_NAME, Buffer.from(JSON.stringify(session), "utf8").toString("base64"), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  }

  function getSession(req) {
    const raw = req.cookies?.[SESSION_COOKIE_NAME];
    if (!raw) return null;
    try {
      const json = Buffer.from(String(raw), "base64").toString("utf8");
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function requireAuth(req, res, next) {
    const s = getSession(req);
    if (!s?.user_id) return res.status(401).json({ error: "Unauthorized" });
    req.session = s;
    next();
  }

  function requireRole(role) {
    return (req, res, next) => {
      const s = req.session ?? getSession(req);
      if (!s?.user_id) return res.status(401).json({ error: "Unauthorized" });
      req.session = s;
      if (s.role !== role) return res.status(403).json({ error: "Forbidden" });
      next();
    };
  }

  async function getEventByLocator(locator) {
    const r = await query("select * from events where event_locator = $1", [locator]);
    return r.rows[0] ?? null;
  }

  // -------------------------
  // Auth endpoints
  // -------------------------
  app.get("/auth/session", (req, res) => {
    const s = getSession(req);
    if (!s?.user_id) return res.json({ authenticated: false });
    res.json({ authenticated: true, user: s });
  });

  app.post("/auth/login", async (req, res, next) => {
    try {
      const parsed = z
        .object({ username: z.string().min(1), password: z.string().min(1) })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "BadRequest" });

      const { username, password } = parsed.data;
      const r = await query(
        "select user_id, username, password_b64, role, event_id from users where username = $1",
        [username],
      );
      const u = r.rows[0];
      if (!u) return res.status(401).json({ error: "InvalidCredentials" });

      const suppliedB64 = Buffer.from(password, "utf8").toString("base64");
      if (String(u.password_b64) !== suppliedB64) return res.status(401).json({ error: "InvalidCredentials" });

      let event_locator = null;
      if (u.role === "user") {
        const er = await query("select event_locator from events where event_id = $1", [u.event_id]);
        event_locator = er.rows[0]?.event_locator ?? null;
      }

      const session = {
        user_id: u.user_id,
        username: u.username,
        role: u.role,
        event_id: u.event_id,
        event_locator,
      };

      setSessionCookie(res, session);
      res.json({ ok: true, user: session });
    } catch (e) {
      next(e);
    }
  });

  app.post("/auth/logout", (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

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

  app.get("/events", requireAuth, async (req, res) => {
    const s = req.session;

    // Users can only see their assigned event.
    if (s.role === "user") {
      const r = await query("select * from events where event_id = $1", [s.event_id]);
      return res.json(r.rows);
    }

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

  app.post("/events", requireRole("admin"), async (req, res, next) => {
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

  app.put("/events/:id", requireRole("admin"), async (req, res, next) => {
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

  app.delete("/events/:id", requireRole("admin"), async (req, res, next) => {
    try {
      await query("delete from events where event_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/bidders", requireAuth, async (req, res) => {
    const s = req.session;

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

    const effectiveEventId = s.role === "user" ? s.event_id : event_id;

    let sql = "select * from bidders where 1=1";
    const params = [];

    if (effectiveEventId) {
      params.push(effectiveEventId);
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

  app.post("/bidders", requireAuth, async (req, res, next) => {
    // Users can only create within their event.
    try {
      const s = req.session;
      const body = parseBody(BidderCreate, req.body);
      if (s.role === "user" && body.event_id !== s.event_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

  app.put("/bidders/:id", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(BidderUpdate, req.body);
      if (s.role === "user" && body.event_id !== s.event_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

  app.delete("/bidders/:id", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      if (s.role === "user") {
        const check = await query("select event_id from bidders where bidder_id = $1", [req.params.id]);
        const row = check.rows[0];
        if (!row || row.event_id !== s.event_id) return res.status(403).json({ error: "Forbidden" });
      }
      await query("delete from bidders where bidder_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/items", requireAuth, async (req, res) => {
    const s = req.session;

    const parser = z.object({
      event_id: z.coerce.number().int().positive().optional(),
      q: z.string().optional(),
      lookup: z.string().optional(), // item_desc strict match
    });
    const parsed = parser.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
    const { event_id, q, lookup } = parsed.data;

    const effectiveEventId = s.role === "user" ? s.event_id : event_id;

    let sql = "select * from items where 1=1";
    const params = [];

    if (effectiveEventId) {
      params.push(effectiveEventId);
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

  app.post("/items", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(ItemCreate, req.body);
      if (s.role === "user" && body.event_id !== s.event_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

  app.put("/items/:id", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(ItemUpdate, req.body);
      if (s.role === "user" && body.event_id !== s.event_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

  app.delete("/items/:id", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      if (s.role === "user") {
        const check = await query("select event_id from items where item_id = $1", [req.params.id]);
        const row = check.rows[0];
        if (!row || row.event_id !== s.event_id) return res.status(403).json({ error: "Forbidden" });
      }
      await query("delete from items where item_id = $1", [req.params.id]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/winning-bids", requireAuth, async (req, res) => {
    const s = req.session;

    const parsed = z.object({ event_id: z.coerce.number().int().positive().optional() }).safeParse(req.query);
    const requestedEventId = parsed.success ? parsed.data.event_id : undefined;

    const effectiveEventId = s.role === "user" ? s.event_id : requestedEventId;

    const r = await query(
      effectiveEventId
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
      effectiveEventId ? [effectiveEventId] : [],
    );
    res.json(r.rows);
  });

  app.post("/winning-bids", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(WinningBidCreate, req.body);
      if (s.role === "user" && body.event_id !== s.event_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

  app.put("/winning-bids/:id", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(WinningBidUpdate, req.body);
      if (s.role === "user" && body.event_id !== s.event_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

  app.delete("/winning-bids/:id", requireAuth, async (req, res, next) => {
    try {
      const s = req.session;
      if (s.role === "user") {
        const check = await query("select event_id from winning_bids where winning_bid_id = $1", [req.params.id]);
        const row = check.rows[0];
        if (!row || row.event_id !== s.event_id) return res.status(403).json({ error: "Forbidden" });
      }
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
