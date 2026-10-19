# PulseDesk

PulseDesk is an autonomous multi-agent support triage dashboard for classifying, prioritizing, and safely dispatching incoming tickets.

![Dashboard](./screenshots/dashboard.png)

## Quick Start

```bash
docker compose up --build
# Open http://localhost:3000
```

The container initializes and seeds SQLite automatically on startup. The database is persisted at `./data/pulsedesk.db` through the Docker Compose volume.

For local development without Docker:

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Architecture

```text
Incoming Ticket
      │
      ▼
┌────────────────────┐
│  Classifier Agent  │  intent, urgency, components, confidence
└─────────┬──────────┘
          ▼
┌──────────────────────┐
│ Policy & Context     │  SLA rules from SQLite knowledge base
└─────────┬────────────┘
          ▼
┌──────────────────────┐
│ Action Dispatcher     │  action plan, customer draft, webhook payload
└─────────┬────────────┘
          ▼
┌──────────────────────┐
│ Human Approval        │  approve, reject, or resolve
└──────────────────────┘
```

The orchestrator runs the agents deterministically without external API keys, saves the result in SQLite, and writes each stage to the live activity feed.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite |
| SQLite driver | better-sqlite3 |
| Testing | Jest + ts-jest |
| Runtime | Node.js 20 Alpine |

## How it works

- Tickets are created from the dashboard or `POST /api/tickets`, then sorted with critical signals at the top of the queue.
- The classifier detects intent and urgency, the policy agent selects an SLA from the knowledge base, and the dispatcher prepares an action plan and customer response.
- A human reviews the pipeline output before approving dispatch; approved triaged tickets can then be resolved from the dashboard.

## Activity Feed

The dashboard polls `GET /api/logs` every five seconds. It displays the 20 most recent classifier, policy, dispatcher, and orchestrator events with agent badges, ticket links, and relative timestamps.

## API

- `GET /api/tickets` — list tickets with approval state
- `POST /api/tickets` — create a ticket with `title`, `body`, and `source`
- `GET /api/tickets/:id` — return ticket details and triage result
- `POST /api/tickets/:id/triage` — run the three-stage triage pipeline
- `PATCH /api/tickets/:id/approve` — approve or reject a triage result
- `PATCH /api/tickets/:id/resolve` — resolve a triaged and approved ticket
- `GET /api/logs` — return the 20 most recent agent activity entries

## Running tests

```bash
npm test
```

The suite covers the classifier, policy agent, dispatcher, and an in-memory SQLite integration flow through the ticket and triage APIs.
