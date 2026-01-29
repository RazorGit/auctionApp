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
    FOREIGN KEY (event_id) REFERENCES events (event_id)
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
    FOREIGN KEY (event_id) REFERENCES events (event_id),
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
    FOREIGN KEY (event_id) REFERENCES events (event_id),
  -- Spec has typos here; these should reference bidders/items, not events.
  CONSTRAINT fk_winning_bids_bidder
    FOREIGN KEY (bidder_id) REFERENCES bidders (bidder_id),
  CONSTRAINT fk_winning_bids_item
    FOREIGN KEY (item_id) REFERENCES items (item_id),
  CONSTRAINT chk_winning_bid_nonnegative
    CHECK (winning_bid >= 0)
);

-- Helpful indexes for FK lookups
CREATE INDEX IF NOT EXISTS ix_bidders_event_id ON bidders(event_id);
CREATE INDEX IF NOT EXISTS ix_items_event_id ON items(event_id);
CREATE INDEX IF NOT EXISTS ix_winning_bids_event_id ON winning_bids(event_id);
CREATE INDEX IF NOT EXISTS ix_winning_bids_bidder_id ON winning_bids(bidder_id);
CREATE INDEX IF NOT EXISTS ix_winning_bids_item_id ON winning_bids(item_id);

COMMIT;
