# Tournament Schema Reference

Complete documentation for all tournament fields.

## Core Fields

### `slug` (required)
- **Type**: `string`
- **Description**: Unique URL-friendly identifier for the tournament
- **Format**: Lowercase letters, numbers, and hyphens only
- **Examples**: `"stanford-invitational-2026"`, `"aves-2"`, `"yale-science-bowl"`
- **Notes**: Used in URLs like `/tournaments/stanford-invitational-2026`

### `name` (required)
- **Type**: `string`
- **Description**: Full tournament name as it should appear on the site
- **Examples**: `"Stanford Science Bowl Invitational"`, `"AVES 2"`

### `status` (required)
- **Type**: `"DRAFT" | "PUBLISHED" | "ARCHIVED"`
- **Description**: Publication status (separate from lifecycle status)
- **Default**: `"PUBLISHED"`
- **Notes**:
  - `DRAFT` - Tournament exists but isn't visible on the site
  - `PUBLISHED` - Visible to all users
  - `ARCHIVED` - Old tournament, may be hidden from main list

## Tournament Configuration

### `mode` (required)
- **Type**: `"IN_PERSON" | "ONLINE"`
- **Description**: Whether tournament is in-person or online
- **Notes**: Determines if `location` field is required

### `timezone` (required)
- **Type**: `string`
- **Description**: IANA timezone identifier
- **Examples**: `"America/Los_Angeles"`, `"America/New_York"`, `"America/Chicago"`
- **Notes**: Used for date display and future auto-status updates
- **Common US Timezones**:
  - Pacific: `America/Los_Angeles`
  - Mountain: `America/Denver`
  - Central: `America/Chicago`
  - Eastern: `America/New_York`

### `dates` (required)
- **Type**: `object`
- **Properties**:
  - `start` (required): `string` - Start date in `YYYY-MM-DD` format
  - `end` (required): `string` - End date in `YYYY-MM-DD` format
- **Example**:
  ```json
  "dates": {
    "start": "2026-01-15",
    "end": "2026-01-15"
  }
  ```
- **Notes**: For single-day tournaments, start and end are the same

### `divisions` (required)
- **Type**: `array of strings`
- **Values**: `"MS" | "HS" | "UG" | "OPEN"`
- **Examples**: `["HS"]`, `["MS", "HS"]`, `["UG"]`, `["OPEN"]`
- **Notes**:
  - MS = Middle School
  - HS = High School
  - UG = Undergraduate/College
  - OPEN = Open division
  - Most tournaments are single-division

### `location` (conditional)
- **Type**: `object | null`
- **Required**: Only for `IN_PERSON` tournaments
- **Omit**: For `ONLINE` tournaments (or set to `null`)
- **Properties**:
  - `city` (required): `string` - City name
  - `state` (required): `string` - Two-letter state code
  - `address` (optional): `string` - Full address or venue name
- **Example**:
  ```json
  "location": {
    "city": "Stanford",
    "state": "CA",
    "address": "Stanford University"
  }
  ```

## Tournament Details

### `difficulty` (optional)
- **Type**: `string`
- **Description**: Free-form difficulty description
- **Examples**: `"Beginner-friendly"`, `"Nationals-level"`, `"MS difficulty"`
- **Notes**: Displayed in tournament header

### `notes` (optional)
- **Type**: `object`
- **Properties**:
  - `logistics` (optional): `string` - Logistics details (time, requirements, etc.)
  - `writing_team` (optional): `string` - Question writers
- **Example**:
  ```json
  "notes": {
    "logistics": "Online via Discord. Tournament runs 9 AM - 5 PM PST.",
    "writing_team": "Stanford Science Bowl Team"
  }
  ```

### `format` (required)
- **Type**: `object`
- **Properties**:
  - `summary` (required): `string` - Brief tournament description
  - `rounds_guaranteed` (optional): `number` - Guaranteed number of rounds
- **Example**:
  ```json
  "format": {
    "summary": "Standard Science Bowl format with preliminary rounds and playoffs",
    "rounds_guaranteed": 6
  }
  ```

## Contact & Links

### `contacts` (optional but recommended)
- **Type**: `array of objects`
- **Object Properties**:
  - `type` (required): `"EMAIL" | "DISCORD" | "PHONE" | "OTHER"`
  - `value` (required): `string` - The contact value
  - `label` (optional): `string` - Descriptive label
- **Example**:
  ```json
  "contacts": [
    {
      "type": "EMAIL",
      "value": "director@tournament.org",
      "label": "Tournament Director"
    },
    {
      "type": "DISCORD",
      "value": "discord.gg/abc123",
      "label": "Discord Server"
    }
  ]
  ```

### `links` (optional)
- **Type**: `array of objects`
- **Object Properties**:
  - `type` (required): `"WEBSITE" | "RESULTS" | "PACKETS" | "STATS" | "OTHER"`
  - `url` (required): `string` - Full URL
  - `label` (required): `string` - Display label
- **Example**:
  ```json
  "links": [
    {
      "type": "WEBSITE",
      "url": "https://tournament.org",
      "label": "Website"
    },
    {
      "type": "RESULTS",
      "url": "https://docs.google.com/spreadsheets/...",
      "label": "Final Standings"
    }
  ]
  ```

## Registration (Upcoming Tournaments Only)

### `registration` (optional)
- **Type**: `object`
- **Required for**: Upcoming tournaments that are accepting registrations
- **Properties**:
  - `method` (required): `"FORM" | "EMAIL" | "WEBSITE" | "OTHER"`
  - `instructions` (required): `string` - How to register
  - `url` (optional): `string` - Registration link
  - `cost` (optional): `string` - Cost description
  - `deadlines` (required): `array` - Array of deadline objects
    - `label` (required): `string` - Deadline description
    - `date` (required): `string` - Date in `YYYY-MM-DD` or descriptive format
- **Example**:
  ```json
  "registration": {
    "method": "FORM",
    "instructions": "Fill out the Google Form to register. Teams are accepted on a first-come, first-served basis.",
    "url": "https://forms.gle/abc123",
    "cost": "$25 per team",
    "deadlines": [
      {
        "label": "Registration closes",
        "date": "2026-01-10"
      },
      {
        "label": "Payment due",
        "date": "2026-01-15"
      }
    ]
  }
  ```

## Metadata

### `updated_at` (optional)
- **Type**: `string`
- **Description**: ISO 8601 datetime of last update
- **Format**: `YYYY-MM-DDTHH:MM:SSZ`
- **Example**: `"2026-01-08T12:00:00Z"`
- **Notes**: Automatically set by system in the future

## Complete Example

```json
{
  "slug": "stanford-invitational-2026",
  "name": "Stanford Science Bowl Invitational",
  "status": "PUBLISHED",
  "mode": "IN_PERSON",
  "timezone": "America/Los_Angeles",
  "dates": {
    "start": "2026-02-15",
    "end": "2026-02-15"
  },
  "divisions": ["HS"],
  "location": {
    "city": "Stanford",
    "state": "CA",
    "address": "Stanford University"
  },
  "difficulty": "Nationals-level",
  "notes": {
    "logistics": "Check-in starts at 8:00 AM. Tournament runs 9:00 AM - 5:00 PM.",
    "writing_team": "Stanford Science Bowl Team"
  },
  "format": {
    "summary": "Preliminary rounds followed by playoff bracket",
    "rounds_guaranteed": 8
  },
  "contacts": [
    {
      "type": "EMAIL",
      "value": "scibowl@stanford.edu",
      "label": "Tournament Directors"
    }
  ],
  "registration": {
    "method": "FORM",
    "instructions": "Registration is first-come, first-served. Maximum 2 teams per school.",
    "url": "https://forms.gle/example",
    "cost": "$30 per team",
    "deadlines": [
      {
        "label": "Registration closes",
        "date": "2026-02-01"
      }
    ]
  },
  "links": [
    {
      "type": "WEBSITE",
      "url": "https://stanford-scibowl.org",
      "label": "Website"
    }
  ],
  "updated_at": "2026-01-08T12:00:00Z"
}
```

## Field Requirements by Tournament Type

### Upcoming Tournament (Minimum)
- slug, name, status, mode, timezone, dates, divisions
- location (if IN_PERSON)
- format
- contacts (recommended)
- registration (if accepting registrations)
- links with WEBSITE (recommended)

### Live Tournament (Minimum)
- Same as Upcoming
- registration may still exist if late registration allowed

### Finished Tournament (Minimum)
- slug, name, status, mode, timezone, dates, divisions
- location (if IN_PERSON)
- format
- notes (preserve original logistics)
- links with RESULTS, STATS, and/or PACKETS
