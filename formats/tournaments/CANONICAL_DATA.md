# Canonical Tournament Data Location

The website consumes tournament data from:
- `apps/website/frontend/src/features/tournaments/data/tournaments.json`

Validator tooling (CI + local) currently targets that path:
- `tournaments/validate.js`
- `.github/workflows/validate-tournaments.yml`

