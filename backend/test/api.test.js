import { describe, expect, it, vi } from "vitest";
import request from "supertest";

// Mock DB layer
vi.mock("../src/db.js", () => {
  return {
    query: vi.fn(),
  };
});

import { query } from "../src/db.js";
import { createApp } from "../src/app.js";

function makeSessionCookie(session) {
  const val = Buffer.from(JSON.stringify(session), "utf8").toString("base64");
  return `session=${val}`;
}

describe("API", () => {
  it("GET /healthz returns ok true when DB reachable", async () => {
    query.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });
    const app = createApp();
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("GET /events requires auth", async () => {
    const app = createApp();
    const res = await request(app).get("/events");
    expect(res.status).toBe(401);
  });

  it("GET /events calls expected SQL (admin)", async () => {
    query.mockResolvedValueOnce({ rows: [{ event_id: 1 }], rowCount: 1 });
    const app = createApp();
    const res = await request(app)
      .get("/events?q=test")
      .set("Cookie", makeSessionCookie({ user_id: 1, username: "admin", role: "admin", event_id: null }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ event_id: 1 }]);
    expect(query).toHaveBeenCalledWith(
      "select * from events where event_desc ilike $1 order by event_date desc, event_id desc",
      ["%test%"],
    );
  });

  it("POST /events validates input", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/events")
      .set("Cookie", makeSessionCookie({ user_id: 1, username: "admin", role: "admin", event_id: null }))
      .send({ event_desc: "", event_date: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("BadRequest");
  });

  it("POST /winning-bids validates nonnegative amount", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/winning-bids")
      .set("Cookie", makeSessionCookie({ user_id: 2, username: "user1", role: "user", event_id: 1 }))
      .send({
        event_id: 1,
        bidder_id: 1,
        item_id: 1,
        winning_bid: -1,
      });
    expect(res.status).toBe(400);
  });

  it("POST /events rejects asterisk in event_desc", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/events")
      .set("Cookie", makeSessionCookie({ user_id: 1, username: "admin", role: "admin", event_id: null }))
      .send({
        event_desc: "Annual*Gala",
        event_date: "2026-12-31"
      });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Asterisk cannot be used");
  });

  it("POST /bidders rejects asterisk in first_name", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/bidders")
      .set("Cookie", makeSessionCookie({ user_id: 2, username: "user1", role: "user", event_id: 1 }))
      .send({
        event_id: 1,
        bidder_first_name: "sam*spade",
        bidder_last_name: "Smith",
        bidder_email: "sam@example.com"
      });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Asterisk cannot be used");
  });

  it("POST /bidders rejects asterisk in last_name", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/bidders")
      .set("Cookie", makeSessionCookie({ user_id: 2, username: "user1", role: "user", event_id: 1 }))
      .send({
        event_id: 1,
        bidder_first_name: "Sam",
        bidder_last_name: "Smith*Jones",
        bidder_email: "sam@example.com"
      });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Asterisk cannot be used");
  });

  it("POST /items rejects asterisk in item_desc", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/items")
      .set("Cookie", makeSessionCookie({ user_id: 2, username: "user1", role: "user", event_id: 1 }))
      .send({
        event_id: 1,
        item_type: "Live",
        item_desc: "Wine*Basket"
      });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Asterisk cannot be used");
  });

  it("POST /bidders rejects invalid email with custom message", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/bidders")
      .set("Cookie", makeSessionCookie({ user_id: 2, username: "user1", role: "user", event_id: 1 }))
      .send({
        event_id: 1,
        bidder_first_name: "John",
        bidder_last_name: "Doe",
        bidder_email: "x"
      });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Invalid email address - please use a proper email format (e.g., user@example.com or x@x.com)");
  });
});

