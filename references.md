How to run
```
docker compose up -d --build
```

Then open:
- Landing: http://localhost:4200
- Admin UI: http://localhost:4200/admin
- User UI (event dashboard): http://localhost:4200/user/<EVENT_LOCATOR>
- API health: http://localhost:4200/api/healthz (via nginx proxy)

How to get an EVENT_LOCATOR:
- In the Admin UI, go to Events and copy the `event_locator` column.
- Or via API: `curl -sS http://localhost:4200/api/events`

docker-compose.yml: brings up
Postgres (db) with your db/init.sql
Node/Express API (api) on localhost:3000
Angular UI served by nginx (web) on localhost:4200, with /api/* proxied to the API container

Backend (backend/): Express + pg + zod with endpoints:
+ GET /healthz
+ GET/POST /events
+ GET/POST /bidders (optional ?event_id=...)
+ GET/POST /items (optional ?event_id=...)
+ GET/POST /winning-bids (optional ?event_id=..., includes joined bidder/item fields on GET)

Frontend (frontend/): Angular UI
- Landing page: choose Admin or open User UI by event locator
- Admin: manage events/bidders/items/winning bids
- User: event dashboard based on `event_locator`

# Example - Events
```
curl -sS -X POST http://localhost:4200/api/events -H 'content-type: application/json' -d '{"event_desc":"Test Event","event_date":"2026-01-28","event_tax_id":null}' && echo && curl -sS http://localhost:4200/api/events | head
```

Returns
```{"event_id":3,"event_locator":"ECCBC87E","event_desc":"Test Event","event_date":"2026-01-28T00:00:00.000Z","event_tax_id":null}
[{"event_id":3,"event_locator":"ECCBC87E","event_desc":"Test Event","event_date":"2026-01-28T00:00:00.000Z","event_tax_id":null},{"event_id":2,"event_locator":"C81E728D","event_desc":"Test Event","event_date":"2026-01-28T00:00:00.000Z","event_tax_id":null},{"event_id":1,"event_locator":"C4CA4238","event_desc":"Test Event","event_date":"2026-01-28T00:00:00.000Z","event_tax_id":null}]
```

# Example - Bidders
```
curl -sS -X POST http://localhost:4200/api/bidders -H 'content-type: application/json' -d '{"event_id":1,"bidder_num":2,"bidder_first_name":"Ada","bidder_last_name":"Lovelace","bidder_email":"ada@example.com"}' && echo && curl -sS -X POST http://localhost:4200/api/items -H 'content-type: application/json' -d '{"event_id":1,"item_type":"Live","item_desc":"Gift Basket","item_notes":null}' && echo && curl -sS http://localhost:4200/api/bidders?event_id=1 && echo && curl -sS http://localhost:4200/api/items?event_id=1
```

Returns - note, bidder_id must be unique
```
{"bidder_id":3,"event_id":1,"bidder_num":2,"bidder_first_name":"Ada","bidder_last_name":"Lovelace","bidder_email":"ada@example.com","bidder_credit_card_token":null}
{"item_id":4,"event_id":1,"item_type":"Live","item_desc":"Gift Basket","item_notes":null}
[{"bidder_id":1,"event_id":1,"bidder_num":1,"bidder_first_name":"Ada","bidder_last_name":"Lovelace","bidder_email":"ada@example.com","bidder_credit_card_token":null},{"bidder_id":3,"event_id":1,"bidder_num":2,"bidder_first_name":"Ada","bidder_last_name":"Lovelace","bidder_email":"ada@example.com","bidder_credit_card_token":null}]
[{"item_id":4,"event_id":1,"item_type":"Live","item_desc":"Gift Basket","item_notes":null},{"item_id":3,"event_id":1,"item_type":"Live","item_desc":"Gift Basket","item_notes":null},{"item_id":2,"event_id":1,"item_type":"Live","item_desc":"Gift Basket","item_notes":null},{"item_id":1,"event_id":1,"item_type":"Live","item_desc":"Gift Basket","item_notes":null}]
```

# Example - Winning Bid
```
curl -sS -X POST http://localhost:4200/api/winning-bids -H 'content-type: application/json' -d '{"event_id":1,"bidder_id":1,"item_id":1,"winning_bid":25.00}' && echo && curl -sS http://localhost:4200/api/winning-bids?event_id=1
```

Returns
```
{"winning_bid_id":1,"event_id":1,"bidder_id":1,"item_id":1,"winning_bid":"25.00"}
[{"winning_bid_id":1,"event_id":1,"bidder_id":1,"item_id":1,"winning_bid":"25.00","bidder_first_name":"Ada","bidder_last_name":"Lovelace","item_desc":"Gift Basket"}]
```

# Testing
Backend unit tests added
Test framework: vitest + supertest
Refactor for testability: moved express setup into backend/src/app.js (createApp()), and backend/src/index.js now just starts the server.

Tests: backend/test/api.test.js
health check
validation failures
verifies expected SQL + params are sent to query() (DB is mocked)

Run (in a container if your host has no npm):
docker run --rm -v "$PWD/backend":/app -w /app node:20-bookworm-slim bash -lc "npm install && npm test"

Frontend unit tests added
Runner: Angular ng test (Karma/Jasmine)

Tests:
frontend/src/app/api.service.spec.ts
frontend/src/app/dashboard.component.spec.ts

Added the necessary config: frontend/karma.conf.js, frontend/tsconfig.spec.json, frontend/src/test.ts

If you want to run tests in Docker without needing Chrome on the host, use the included frontend/Dockerfile.test:
```
docker build -f frontend/Dockerfile.test -t webapp-frontend-test frontenddocker run --rm webapp-frontend-test
```
