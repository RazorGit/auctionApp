import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { query } from "./db.js";
import {
  BidderCreate, BidderUpdate,
  EventCreate, EventUpdate,
  ItemCreate, ItemUpdate,
  WinningBidCreate, WinningBidUpdate,
  MembershipRequestCreate,
  MembershipDecision,
  AuctionStart,
  BidCreate
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

  function isAuctionOngoing(eventRow) {
    if (!eventRow) return false;
    if (eventRow.status !== 'ongoing') return false;
    if (eventRow.ends_at) {
      const ends = new Date(eventRow.ends_at);
      if (Number.isFinite(ends.getTime()) && Date.now() > ends.getTime()) return false;
    }
    return true;
  }

  async function getEventById(eventId) {
    const r = await query("select * from events where event_id = $1", [eventId]);
    return r.rows[0] ?? null;
  }

  async function requireApprovedMembership(userId, eventId) {
    const r = await query(
      "select status from event_memberships where user_id = $1 and event_id = $2",
      [userId, eventId],
    );
    const row = r.rows[0];
    return row?.status === 'approved';
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

    const q = z
      .object({
        q: z.string().optional(),
        lookup: z.string().optional(),
      })
      .safeParse(req.query);

    if (!q.success) return res.status(400).json({ error: "Invalid query params" });
    const { q: search, lookup } = q.data;

    // Users can only see events they have approved memberships for.
    if (s.role === "user") {
      if (lookup) {
        // User is trying to access a specific event by locator.
        // Check if they have an approved membership for it.
        const cleanLookup = lookup.trim().toUpperCase();
        let eventSql = "select * from events where 1=1";
        const eventParams = [];

        if (cleanLookup.length === 8 && /^[0-9A-F]+$/.test(cleanLookup)) {
          eventSql += " and event_locator = $1";
          eventParams.push(cleanLookup);
        } else {
          eventSql += " and upper(replace(event_desc, ' ', '')) = upper(replace($1, ' ', ''))";
          eventParams.push(lookup);
        }

        const eventResult = await query(eventSql, eventParams);
        const event = eventResult.rows[0];

        if (!event) {
          return res.json([]);
        }

        // Check membership
        const memberResult = await query(
          "select status from event_memberships where user_id = $1 and event_id = $2",
          [s.user_id, event.event_id],
        );
        const membership = memberResult.rows[0];

        if (membership?.status === 'approved') {
          return res.json([event]);
        } else {
          return res.status(403).json({ error: "You are not approved for this event" });
        }
      } else if (search) {
        // User search: filter to only their approved events
        const r = await query(
          `select e.* from events e
           join event_memberships m on e.event_id = m.event_id
           where m.user_id = $1 and m.status = 'approved' and e.event_desc ilike $2
           order by e.event_date desc, e.event_id desc`,
          [s.user_id, `%${search}%`],
        );
        return res.json(r.rows);
      } else {
        // No lookup/search: return all approved events for user
        const r = await query(
          `select e.* from events e
           join event_memberships m on e.event_id = m.event_id
           where m.user_id = $1 and m.status = 'approved'
           order by e.event_date desc, e.event_id desc`,
          [s.user_id],
        );
        return res.json(r.rows);
      }
    }

    // Admin can see all events
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

  // -------------------------
  // Auction discovery
  // -------------------------
  app.get("/auctions", requireAuth, async (req, res) => {
    const s = req.session;

    const filter = z.object({
      status: z.enum(['scheduled', 'ongoing', 'ended']).optional(),
    }).safeParse(req.query);

    const status = filter.success ? filter.data.status : undefined;

    if (s.role === 'admin') {
      const r = await query(
        status ? "select * from events where status = $1 order by event_date desc, event_id desc" : "select * from events order by event_date desc, event_id desc",
        status ? [status] : [],
      );
      return res.json(r.rows);
    }

    // Users: show all auctions, but with membership status.
    const r = await query(
      `select e.*, m.status as membership_status
       from events e
       left join event_memberships m
         on m.event_id = e.event_id and m.user_id = $1
       ${status ? "where e.status = $2" : ""}
       order by e.event_date desc, e.event_id desc`,
      status ? [s.user_id, status] : [s.user_id],
    );

    res.json(r.rows);
  });

  // -------------------------
  // Membership requests (user)
  // -------------------------
  app.get("/memberships/me", requireAuth, async (req, res) => {
    const s = req.session;
    const r = await query(
      `select m.*, e.event_desc, e.event_date, e.event_locator, e.status as event_status
       from event_memberships m
       join events e on e.event_id = m.event_id
       where m.user_id = $1
       order by m.requested_at desc`,
      [s.user_id],
    );
    res.json(r.rows);
  });

  app.post("/memberships", requireRole("user"), async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(MembershipRequestCreate, req.body);

      const existing = await query(
        "select * from event_memberships where user_id = $1 and event_id = $2",
        [s.user_id, body.event_id],
      );
      if (existing.rows.length) {
        return res.status(200).json(existing.rows[0]);
      }

      const r = await query(
        `insert into event_memberships (event_id, user_id, status)
         values ($1,$2,'pending')
         returning *`,
        [body.event_id, s.user_id],
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  // -------------------------
  // Membership approvals (admin)
  // -------------------------
  app.get("/admin/memberships/pending", requireRole("admin"), async (_req, res) => {
    const r = await query(
      `select m.*, u.username, e.event_desc, e.event_date, e.event_locator
       from event_memberships m
       join users u on u.user_id = m.user_id
       join events e on e.event_id = m.event_id
       where m.status = 'pending'
       order by m.requested_at asc`,
      [],
    );
    res.json(r.rows);
  });

  app.post("/admin/memberships/:id/decide", requireRole("admin"), async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(MembershipDecision, req.body);

      const r = await query(
        `update event_memberships
         set status = $1, decided_at = now(), decided_by_user_id = $2
         where membership_id = $3
         returning *`,
        [body.status, s.user_id, req.params.id],
      );
      if (!r.rows.length) return res.status(404).json({ error: 'NotFound' });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.get("/admin/memberships/approved", requireRole("admin"), async (_req, res, next) => {
    try {
      const r = await query(
        `select m.*, u.username, e.event_desc, e.event_date, e.event_locator
         from event_memberships m
         join users u on u.user_id = m.user_id
         join events e on e.event_id = m.event_id
         where m.status = 'approved'
         order by m.decided_at desc nulls last, m.requested_at desc`,
        [],
      );
      res.json(r.rows);
    } catch (e) {
      next(e);
    }
  });

  // Manually add user to auction (admin)
  app.post("/admin/auctions/:eventId/members", requireRole("admin"), async (req, res, next) => {
    try {
      const s = req.session;
      const parsed = z.object({ username: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'BadRequest' });
      const { username } = parsed.data;

      const ur = await query("select user_id from users where username = $1", [username]);
      const u = ur.rows[0];
      if (!u) return res.status(404).json({ error: 'UserNotFound' });

      const eventId = Number(req.params.eventId);

      const existing = await query(
        "select * from event_memberships where user_id = $1 and event_id = $2",
        [u.user_id, eventId],
      );

      if (existing.rows.length) {
        const updated = await query(
          `update event_memberships set status = 'approved', decided_at = now(), decided_by_user_id = $1
           where membership_id = $2 returning *`,
          [s.user_id, existing.rows[0].membership_id],
        );
        return res.json(updated.rows[0]);
      }

      const r = await query(
        `insert into event_memberships (event_id, user_id, status, decided_at, decided_by_user_id)
         values ($1,$2,'approved', now(), $3)
         returning *`,
        [eventId, u.user_id, s.user_id],
      );

      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  // -------------------------
  // Auction controls (admin)
  // -------------------------
  app.post("/admin/auctions/:id/start", requireRole("admin"), async (req, res, next) => {
    try {
      const body = parseBody(AuctionStart, req.body);
      const eventId = Number(req.params.id);

      const seconds = body.time_limit_seconds ?? null;
      const r = await query(
        `update events
         set status = 'ongoing',
             starts_at = now(),
             time_limit_seconds = $1,
             ends_at = case when $1::int is null then null else (now() + ($1::text || ' seconds')::interval) end
         where event_id = $2
         returning *`,
        [seconds, eventId],
      );
      if (!r.rows.length) return res.status(404).json({ error: 'NotFound' });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.post("/admin/auctions/:id/stop", requireRole("admin"), async (req, res, next) => {
    try {
      const eventId = Number(req.params.id);
      const r = await query(
        `update events
         set status = 'ended', ends_at = now()
         where event_id = $1
         returning *`,
        [eventId],
      );
      if (!r.rows.length) return res.status(404).json({ error: 'NotFound' });
      res.json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  // -------------------------
  // Bids (users place bids; admin can browse)
  // -------------------------
  app.get("/bids", requireAuth, async (req, res) => {
    const s = req.session;

    const parsed = z.object({
      event_id: z.coerce.number().int().positive(),
      item_id: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
    }).safeParse(req.query);

    if (!parsed.success) return res.status(400).json({ error: 'BadRequest' });

    const { event_id, item_id } = parsed.data;
    const limit = parsed.data.limit ?? 50;

    if (s.role === 'user') {
      const ok = await requireApprovedMembership(s.user_id, event_id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    }

    const params = [event_id];
    let sql = `select b.*, u.username, i.item_desc
               from bids b
               join users u on u.user_id = b.user_id
               join items i on i.item_id = b.item_id
               where b.event_id = $1`;
    if (item_id) {
      params.push(item_id);
      sql += ` and b.item_id = $2`;
    }
    params.push(limit);
    sql += ` order by b.placed_at desc limit $${params.length}`;

    const r = await query(sql, params);
    res.json(r.rows);
  });

  app.post("/bids", requireRole("user"), async (req, res, next) => {
    try {
      const s = req.session;
      const body = parseBody(BidCreate, req.body);

      const ok = await requireApprovedMembership(s.user_id, body.event_id);
      if (!ok) return res.status(403).json({ error: 'MembershipNotApproved' });

      const eventRow = await getEventById(body.event_id);
      if (!isAuctionOngoing(eventRow)) {
        return res.status(409).json({ error: 'AuctionNotOngoing' });
      }

      // Item must belong to event
      const ir = await query("select item_id from items where item_id = $1 and event_id = $2", [body.item_id, body.event_id]);
      if (!ir.rows.length) return res.status(400).json({ error: 'InvalidItem' });

      const r = await query(
        `insert into bids (event_id, item_id, user_id, amount)
         values ($1,$2,$3,$4)
         returning *`,
        [body.event_id, body.item_id, s.user_id, body.amount],
      );

      res.status(201).json(r.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  // -------------------------
  // Admin: Users ("bidders" as app logins)
  // -------------------------
  app.get("/admin/users", requireRole("admin"), async (_req, res, next) => {
    try {
      const r = await query(
        "select user_id, username, role, event_id from users where role = 'user' order by user_id desc",
        [],
      );
      res.json(r.rows);
    } catch (e) {
      next(e);
    }
  });

  app.post("/admin/users", requireRole("admin"), async (req, res, next) => {
    try {
      const parsed = z.object({
        username: z.string().min(1).max(50),
        password: z.string().min(1).optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'BadRequest' });

      const username = parsed.data.username.trim();
      const password = parsed.data.password ?? 'pass';
      const password_b64 = Buffer.from(password, 'utf8').toString('base64');

      const r = await query(
        `insert into users (username, password_b64, role, event_id)
         values ($1, $2, 'user', null)
         returning user_id, username, role, event_id`,
        [username, password_b64],
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      if (String(e?.code) === '23505') {
        return res.status(409).json({ error: 'UsernameAlreadyExists' });
      }
      next(e);
    }
  });

  // -------------------------
  // Admin: Bid history for ended auctions
  // -------------------------
  app.get("/admin/bids/history", requireRole("admin"), async (req, res, next) => {
    try {
      const parsed = z.object({
        event_id: z.coerce.number().int().positive(),
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: 'BadRequest' });

      const eventId = parsed.data.event_id;

      const ev = await getEventById(eventId);
      if (!ev) return res.status(404).json({ error: 'NotFound' });
      if (ev.status !== 'ended') return res.status(409).json({ error: 'AuctionNotEnded' });

      // Fetch all bids, with winner metadata if exists.
      const r = await query(
        `select
            b.bid_id,
            b.event_id,
            b.item_id,
            i.item_desc,
            b.user_id,
            u.username,
            b.amount,
            b.placed_at,
            wb.winning_bid_id,
            wb.winning_bid,
            wb.bidder_id as winning_bidder_id
         from bids b
         join users u on u.user_id = b.user_id
         join items i on i.item_id = b.item_id
         left join winning_bids wb
           on wb.event_id = b.event_id and wb.item_id = b.item_id
         where b.event_id = $1
         order by b.placed_at asc`,
        [eventId],
      );

      res.json({
        event: { event_id: ev.event_id, event_desc: ev.event_desc, status: ev.status },
        bids: r.rows,
      });
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
