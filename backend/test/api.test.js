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

describe("API", () => {
  it("GET /healthz returns ok true when DB reachable", async () => {
    query.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });
    const app = createApp();
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("POST /events validates input", async () => {
    const app = createApp();
    const res = await request(app).post("/events").send({ event_desc: "", event_date: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("BadRequest");
  });

  it("GET /events calls expected SQL", async () => {
    query.mockResolvedValueOnce({ rows: [{ event_id: 1 }], rowCount: 1 });
    const app = createApp();
    const res = await request(app).get("/events?q=test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ event_id: 1 }]);
    expect(query).toHaveBeenCalledWith(
      "select * from events where event_desc ilike $1 order by event_date desc, event_id desc",
      ["%test%"],
    );
  });

  it("POST /winning-bids validates nonnegative amount", async () => {
    const app = createApp();
    const res = await request(app).post("/winning-bids").send({
      event_id: 1,
      bidder_id: 1,
      item_id: 1,
      winning_bid: -1,
    });
    expect(res.status).toBe(400);
  });
});

