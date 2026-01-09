# Tournament Data Management

This directory contains documentation, examples, and validation tools for managing tournament data in SciBowl.

## Quick Links

- **[Schema Documentation](SCHEMA.md)** - Complete field reference and requirements
- **[Example Tournament](example-tournament.json)** - Copy-paste template
- **[Validation Script](validate.js)** - Check your tournament data before committing

## Adding a New Tournament

1. Open `apps/website/frontend/src/features/tournaments/data/tournaments.json`
2. Copy the example from `tournaments/example-tournament.json`
3. Fill in all required fields (see schema)
4. Run validation: `node tournaments/validate.js`
5. Commit and create PR

## Required Fields

Every tournament must have:
- `slug` - URL-friendly unique identifier (e.g., "stanford-invitational-2026")
- `name` - Full tournament name
- `status` - `"PUBLISHED"` (or `"DRAFT"` if not ready)
- `mode` - `"IN_PERSON"` or `"ONLINE"`
- `timezone` - IANA timezone (e.g., `"America/Los_Angeles"`)
- `dates` - Start and end dates
- `divisions` - Array of divisions (e.g., `["HS"]`)
- `format` - Tournament format description
- `notes` - Logistics and other details

## Optional Fields

- `location` - Required for IN_PERSON, omit for ONLINE
- `difficulty` - Difficulty level description
- `contacts` - Array of contact methods
- `registration` - For upcoming tournaments
- `links` - Website, results, stats, packets

## Status Lifecycle

Tournaments automatically transition between LIVE/UPCOMING/FINISHED based on their dates:
- **UPCOMING**: Current date < start date
- **LIVE**: Current date between start and end dates
- **FINISHED**: Current date > end date

The `status` field (`PUBLISHED`/`DRAFT`/`ARCHIVED`) controls visibility, not lifecycle.

## Best Practices

### Slugs
- Use lowercase with dashes
- Include year if it's a recurring tournament
- Examples: `"yale-invitational-2026"`, `"aves-2"`

### Timezones
Common US timezones:
- Pacific: `"America/Los_Angeles"`
- Mountain: `"America/Denver"`
- Central: `"America/Chicago"`
- Eastern: `"America/New_York"`

### Dates
- Use ISO format: `YYYY-MM-DD`
- For single-day tournaments, start and end are the same
- For multi-day tournaments, set end date appropriately

### Contacts
- Always provide a way to contact organizers
- Prefer Discord for online tournaments
- Include descriptive labels (e.g., "Tournament Director")

### Links
- Use meaningful labels (not just "Link")
- Add website link for all tournaments
- Add results/stats/packets for finished tournaments

## Validation

### Local Validation

Before committing changes, run:

```bash
node tournaments/validate.js
```

This checks for:
- Required fields
- Valid field types
- Proper date formats
- Unique slugs
- Timezone validity
- Link URL formats

## Directory Structure

```
tournaments/
├── README.md                 # This file
├── SCHEMA.md                 # Complete schema reference
├── example-tournament.json   # Template for new tournaments
└── validate.js              # Validation script
```

## Questions?

See [SCHEMA.md](SCHEMA.md) for detailed field documentation.
