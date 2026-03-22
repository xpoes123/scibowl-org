# Scibowl.Live
## Overview

**Scibowl.Live** is a full-stack solution for **National Science Bowl (NSB)** students, teams, coaches, and tournament organizers. The project is in active development, built using React and TypeScript.

### Current Features

- Tournament listing: A complete listing of all Science Bowl invitationals for the 2025-26 season
- Packet archive: The largest invitational packet repository in Science Bowl (formerly known as cloud.mehvix).
- MoSS: An all-in-on moderating software that reduces staffing needs to one staffer per room, while also recording buzzpoint statistics and allowing for real time game updates to Scibowl.Live's tournament listing. 

## Documentation

- Tournament listings (schema, examples, validation): [`tournaments/README.md`](./tournaments/README.md)
- Generated stats artifacts and sync to frontends: [`stats/README.md`](./stats/README.md)
- Project-defined JSON/file formats index: [`formats/README.md`](./formats/README.md)
- Backend API (Django): [`backend/README.md`](./backend/README.md)
- Website frontend architecture notes: [`apps/website/frontend/src/README.md`](./apps/website/frontend/src/README.md)
- PDF question import tooling: [`scripts/question_import/question_pdfs/README.md`](./scripts/question_import/question_pdfs/README.md)
- Testing/CI setup notes: [`TESTING_SETUP.md`](./TESTING_SETUP.md)

## Deployment Architecture 
```
Browser
  │
  ├──▶ Vercel: Hosts two React frontends (static files: HTML, JS, CSS)
  │      ├── scibowl.live          → website frontend (tournament listings, stats, packet archive)
  │      ├── moss.scibowl.live     → MoSS moderating app
  │      └── *.vercel.app          → auto-generated PR preview deployments
  │            │
  │            │  (API calls: fetch/POST to Railway)
  │            ▼
  ├──▶ Railway: Runs Django backend (a persistent Python web server)
  │      └── Receives API requests from the frontends, runs 24/7, not serverless.
  │            │
  │            │  (SQL queries: reads/writes game data)
  │            ▼
  ├──▶ Supabase: Hosts PostgreSQL database
  │      └── The actual tables. Railway reads/writes here, decoupling frontend from database.
  │
  └──▶ AWS S3 (via Vercel serverless function) — game state snapshots
         └── MoSS periodically uploads game export snapshots, independent of Railway/Supabase.
```

## License

Scibowl.Live is licensed under the **GNU General Public License v3.0**. See the [LICENSE](./LICENSE) file for the full text.
