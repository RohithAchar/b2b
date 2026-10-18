# OpenWA notification gateway

OpenWA (https://www.open-wa.org) is the self-hosted WhatsApp gateway this app
now uses for outbound order notifications — it replaces the Meta Graph API.
It is a separate long-running service (not a library): the app POSTs each
message to it over HTTP, and it sends from a WhatsApp account linked to it.

OpenWA is third-party software (MIT, free forever) and is deliberately not
vendored here; this file documents how to run it and wire the app to it.
Its API contract is versioned with its own releases — the send endpoint used
by `lib/notifications/whatsapp.ts` is:

```
POST {OPENWA_API_URL}/sessions/{OPENWA_SESSION_ID}/messages/send-text
X-API-Key: <OPENWA_API_KEY>
{ "chatId": "91XXXXXXXXXX@c.us", "text": "..." }
→ { "messageId": "...", "timestamp": ... }
```

## App env

| Var | Required | Description |
| --- | --- | --- |
| `OPENWA_API_URL` | yes | API base **including the `/api` prefix**, e.g. `http://localhost:2785/api` (dev) or `https://wa.<domain>/api` (production). |
| `OPENWA_API_KEY` | yes | API key minted in OpenWA. Server-only; bearer-equivalent, never in a URL or over plain `http://` outside local dev. |
| `OPENWA_SESSION_ID` | yes | The session (linked WhatsApp account) that sends the notifications. |

Leave all three empty to stay on the mock provider — nothing is sent, rows are
recorded in `notification_outbox` and shown as "Mock only".

## Run locally (dev)

```bash
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
docker compose -f docker-compose.dev.yml up -d
# Dashboard + API on one port: http://localhost:2785
```

First boot:

1. Grab the seeded API key from the startup log or `data/.api-key`.
2. Create a session in the dashboard and scan its QR with the phone running
   the WhatsApp account you want notifications sent from (use a dedicated
   number, not a personal one).
3. Point the app at it:

```
OPENWA_API_URL=http://localhost:2785/api
OPENWA_API_KEY=<key>
OPENWA_SESSION_ID=<session>
```

Optionally mint a narrower `operator` key scoped to that one session via the
dashboard's key management (roles: `viewer` < `operator` < `admin`) and use
that instead of the seeded admin key.

## Deploy (production)

Same compose, on an always-on host:

- **TLS is mandatory** — OpenWA serves plain HTTP and expects TLS terminated
  in front of it (Caddy, nginx, or a tunnel). The app calls it with the API
  key, so a plaintext public endpoint leaks that key.
- **Persistent volume for `data/`** — it holds the linked WhatsApp session and
  the SQLite database; losing it means re-scanning the QR.
- `ENGINE_TYPE=baileys` swaps the default Puppeteer engine for a lighter
  browserless one; useful on a small VPS.
- The dashboard is internet-reachable once exposed — keep it behind the same
  TLS and strong keys.

Then set the three `OPENWA_*` values on Vercel (same names, production
`https://wa.<domain>/api`), exactly like the image-search service vars.

## Keeping the number safe

OpenWA drives a normal WhatsApp account, not the official Business API, so
account safety follows WhatsApp's consumer rules, not Meta's API terms: keep
messages transactional (this app already is), warm up new numbers, avoid
cold outreach. See the OpenWA FAQ for their guidance.
