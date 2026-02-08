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
  event_tax_id    VARCHAR(16)
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

COMMIT;
