-- PostgreSQL initialization script for the auction webapp
-- Source: spec.md

BEGIN;

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
  event_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- "uppercase alpha hash of event_id" (spec). Use a deterministic 8-char hash.
  event_locator   VARCHAR(8) GENERATED ALWAYS AS (
    UPPER(SUBSTR(MD5(event_id::TEXT), 1, 8))
  ) STORED,
  event_desc      VARCHAR(100) NOT NULL,
  event_date      DATE NOT NULL,
  event_tax_id    VARCHAR(16),
  status          VARCHAR(12) NOT NULL DEFAULT 'scheduled',
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  time_limit_seconds INT,

  CONSTRAINT chk_events_status CHECK (status IN ('scheduled','ongoing','ended'))
);

-- BIDDERS
CREATE TABLE IF NOT EXISTS bidders (
  bidder_id                 INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id                  INT NOT NULL,
  bidder_num                INT,
  bidder_first_name         VARCHAR(100) NOT NULL,
  bidder_last_name          VARCHAR(100) NOT NULL,
  bidder_email              VARCHAR(100),
  bidder_credit_card_token  VARCHAR(100),

  CONSTRAINT fk_bidders_event
    FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE
);

-- bidder_num: "sequential within event" (spec) when provided.
CREATE UNIQUE INDEX IF NOT EXISTS ux_bidders_event_bidder_num
  ON bidders (event_id, bidder_num)
  WHERE bidder_num IS NOT NULL;

-- Basic email format validation (per spec). Keeps it permissive.
ALTER TABLE bidders
  ADD CONSTRAINT chk_bidders_email_format
  CHECK (
    bidder_email IS NULL OR bidder_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  );

-- ITEMS
CREATE TABLE IF NOT EXISTS items (
  item_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id     INT NOT NULL,
  item_type    VARCHAR(20) NOT NULL,
  item_desc    VARCHAR(100) NOT NULL,
  item_notes   VARCHAR(100),

  CONSTRAINT fk_items_event
    FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
  CONSTRAINT chk_items_type
    CHECK (item_type IN ('Live', 'Not Live'))
);

-- WINNING BIDS
CREATE TABLE IF NOT EXISTS winning_bids (
  winning_bid_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id        INT NOT NULL,
  bidder_id       INT NOT NULL,
  item_id         INT NOT NULL,
  winning_bid     NUMERIC(10,2) NOT NULL,

  CONSTRAINT fk_winning_bids_event
    FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
  -- Spec has typos here; these should reference bidders/items, not events.
  CONSTRAINT fk_winning_bids_bidder
    FOREIGN KEY (bidder_id) REFERENCES bidders (bidder_id) ON DELETE CASCADE,
  CONSTRAINT fk_winning_bids_item
    FOREIGN KEY (item_id) REFERENCES items (item_id) ON DELETE CASCADE,
  CONSTRAINT chk_winning_bid_nonnegative
    CHECK (winning_bid >= 0)
);

-- ------------------------------------------------------------
-- USERS (very simple auth; WIP)
-- Passwords are stored as BASE64 (NOT secure; placeholders only).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username           VARCHAR(50) NOT NULL UNIQUE,
  password_b64       VARCHAR(200) NOT NULL,
  role               VARCHAR(10) NOT NULL,
  event_id           INT,

  CONSTRAINT chk_users_role CHECK (role IN ('admin', 'user')),
  CONSTRAINT fk_users_event FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE SET NULL
);

-- Memberships: users request to join an auction; admin approves.
CREATE TABLE IF NOT EXISTS event_memberships (
  membership_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by_user_id INT,

  CONSTRAINT fk_membership_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_decider FOREIGN KEY (decided_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_membership_status CHECK (status IN ('pending','approved','denied')),
  CONSTRAINT ux_membership_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_event_memberships_status ON event_memberships(status);
CREATE INDEX IF NOT EXISTS ix_event_memberships_event ON event_memberships(event_id);
CREATE INDEX IF NOT EXISTS ix_event_memberships_user ON event_memberships(user_id);

-- Bids: users place bids on items. Admin sees all bids; user sees their own + latest.
CREATE TABLE IF NOT EXISTS bids (
  bid_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_bids_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_bids_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS ix_bids_event_item ON bids(event_id, item_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS ix_bids_user ON bids(user_id, placed_at DESC);

-- Helpful indexes for FK lookups
CREATE INDEX IF NOT EXISTS ix_bidders_event_id ON bidders(event_id);
CREATE INDEX IF NOT EXISTS ix_items_event_id ON items(event_id);
CREATE INDEX IF NOT EXISTS ix_winning_bids_event_id ON winning_bids(event_id);
CREATE INDEX IF NOT EXISTS ix_winning_bids_bidder_id ON winning_bids(bidder_id);
CREATE INDEX IF NOT EXISTS ix_winning_bids_item_id ON winning_bids(item_id);

-- ------------------------------------------------------------
-- Seed data (demo)
-- NOTE: This runs only on a fresh DB volume.
-- ------------------------------------------------------------

-- 3 demo events
INSERT INTO events (event_desc, event_date, event_tax_id)
VALUES
  ('Chinese Ming Vase Benefit Auction', DATE '2026-03-22', NULL),
  ('Dinosaur Fossil Fundraiser Night',  DATE '2026-04-05', NULL),
  ('Meteorite Fragment Charity Gala',   DATE '2026-04-19', NULL);

-- Bidders (a couple per event)
INSERT INTO bidders (event_id, bidder_num, bidder_first_name, bidder_last_name, bidder_email, bidder_credit_card_token)
VALUES
  (1, 101, 'Aria',   'Chen',     'aria.chen@example.com',     NULL),
  (1, 102, 'Miles',  'Harrington','miles.h@example.com',      NULL),
  (2, 201, 'Nora',   'Gomez',    'nora.gomez@example.com',    NULL),
  (2, 202, 'Theo',   'Kline',    'theo.kline@example.com',    NULL),
  (3, 301, 'Sam',    'Okoye',    'sam.okoye@example.com',     NULL),
  (3, 302, 'Priya',  'Iyer',     'priya.iyer@example.com',    NULL);

-- Items (one headline item per event + a couple extras)
INSERT INTO items (event_id, item_type, item_desc, item_notes)
VALUES
  (1, 'Live',     'Porcelain Ming Dynasty Vase (replica)', 'Decorative reproduction for demo purposes'),
  (1, 'Not Live', 'Tea ceremony set',                      'Includes teapot + 4 cups'),
  (2, 'Live',     'Dinosaur Fossil: "Raptor" claw cast', 'Museum-quality cast (demo)'),
  (2, 'Not Live', 'Prehistoric plant print',               'Framed'),
  (3, 'Live',     'Meteorite Fragment (Campo del Cielo)',  'Small iron meteorite slice (demo)'),
  (3, 'Not Live', 'Star map print',                        'Personalized to the event date');

-- Winning bids (one per event)
-- Bidder/item IDs are deterministic here because this is demo seed data in a fresh DB.
INSERT INTO winning_bids (event_id, bidder_id, item_id, winning_bid)
VALUES
  (1, 2, 1, 1250.00),
  (2, 4, 3, 980.00),
  (3, 6, 5, 1430.00);

-- App users
-- admin/admin => "YWRtaW4="
-- pass => "cGFzcw=="
INSERT INTO users (username, password_b64, role, event_id)
VALUES
  ('admin', 'YWRtaW4=', 'admin', NULL),
  ('user1', 'cGFzcw==', 'user', 1),
  ('user2', 'cGFzcw==', 'user', 2),
  ('user3', 'cGFzcw==', 'user', 3);

-- Seed memberships: attach user1/user2/user3 to their default event as approved (demo)
INSERT INTO event_memberships (event_id, user_id, status, requested_at, decided_at, decided_by_user_id)
SELECT u.event_id, u.user_id, 'approved', now(), now(), (SELECT user_id FROM users WHERE username = 'admin')
FROM users u
WHERE u.role = 'user' AND u.event_id IS NOT NULL;

-- Optionally mark seeded events as scheduled in the future by default
UPDATE events SET status = 'scheduled', starts_at = NULL, ends_at = NULL, time_limit_seconds = NULL;

COMMIT;
