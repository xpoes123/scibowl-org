# Tournament JSON Files

Each tournament is stored as a separate JSON file in this directory.

## File Naming

Files are named by tournament ID: `{id}.json`

IDs are simply incremental: 1, 2, 3, 4, ...

## Required Fields

Every tournament JSON file must include these fields:

```json
{
  "id": "26",
  "name": "Tournament Name",
  "location_city": "City",
  "location_state": "STATE",
  "start_date": "YYYY-MM-DD",
  "level": ["HS"],
  "status": "UPCOMING",
  "updated_at": "2026-01-06T00:00:00Z",
  "is_published": true
}
```

### Field Descriptions

- `id` - Unique incremental ID (string)
- `name` - Full tournament name
- `location_city` - City name
- `location_state` - Two-letter state code (e.g., "CA", "NY")
- `start_date` - ISO date format (YYYY-MM-DD)
- `end_date` - (Optional) For multi-day tournaments
- `level` - Array of levels: `["HS"]`, `["MS"]`, or `["MS", "HS"]`
- `status` - One of: `"UPCOMING"`, `"LIVE"`, or `"FINISHED"`
- `updated_at` - ISO timestamp
- `is_published` - Boolean, should be `true`

## Optional Detail Fields

For tournaments with detail pages, you can add:

```json
{
  "website_url": "https://example.com",
  "contact_info": "Contact information as free text",
  "logistics": "Logistics details",
  "difficulty": "Difficulty level description",
  "writing_team": "Team that wrote the questions",
  "field_limit": 32,
  "registration": {
    "method": "FORM",
    "instructions": "Registration instructions",
    "url": "https://forms.gle/...",
    "cost": "$50 per team",
    "deadlines": [
      {
        "label": "Early registration",
        "date": "2026-01-15"
      }
    ]
  },
  "format": {
    "summary": "Tournament format description",
    "rounds": 10,
    "field_limit": 32,
    "phases": []
  }
}
```

## Example

See [`3.json`](./3.json) (Yale Science Bowl Invitational) for a complete example with all detail fields.

## Adding Your Tournament

1. Create a new file with the next available ID (e.g., `26.json`)
2. Copy the structure from an existing file
3. Fill in your tournament details
4. Add the import to [`tournaments.ts`](../tournaments.ts)
5. Submit a pull request
