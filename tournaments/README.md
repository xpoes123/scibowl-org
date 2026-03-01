# Tournaments

Tournament listings live in:
- `apps/website/frontend/src/features/tournaments/data/tournaments.json`

## Edit flow

1. Start from `tournaments/example-tournament.json`.
2. Follow `tournaments/SCHEMA.md`.
3. Validate before committing:

```bash
node tournaments/validate.js
```

## Notes

- `status` controls visibility (`PUBLISHED`/`DRAFT`/`ARCHIVED`).
- Use an IANA timezone (for US: `America/Los_Angeles`, `America/Denver`, `America/Chicago`, `America/New_York`).
