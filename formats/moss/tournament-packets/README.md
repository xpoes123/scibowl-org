# MoSS Tournament Packets

Password-protected tournament packets that moderators load in MoSS via **New Game → Packet → Select Tournament Packet**. Each packet has its own password, which the tournament director releases when the round starts.

Packets live in a private S3 bucket. The browser never reads the bucket directly; a Vercel serverless function lists packets and returns a packet only when its password is correct.

Canonical sources:
- Upload script: `scripts/upload_tournament_packets.py`
- Serverless endpoint: `apps/moss/frontend/api/tournament-packets.ts`
- MoSS client: `apps/moss/frontend/src/domain/tournamentPacketsClient.ts`
- MoSS UI: `apps/moss/frontend/src/ui/TournamentChooserModal.tsx`, `apps/moss/frontend/src/ui/TournamentPacketChooserModal.tsx`

## Bucket layout

```text
index.json                         tournaments that have packets
<slug>/manifest.json               packet names + password hashes for one tournament
<slug>/packets/<packet_id>.json    raw MoSS packet JSON (see formats/moss/packet/)
```

`<slug>` is the tournament slug from `tournaments.json`. MoSS only lists tournaments that appear there.

Packet files are stored byte-for-byte as uploaded, so a game started from a tournament packet has the same `packet_checksum` as one started by uploading the same file from a computer.

### `index.json`

```json
{ "format": "moss_packet_index", "version": 1, "slugs": ["bsb-scrimmage-2026"] }
```

### `<slug>/manifest.json`

```json
{
  "format": "moss_tournament_packets",
  "version": 1,
  "tournament_slug": "bsb-scrimmage-2026",
  "uploaded_at": "2026-10-25T00:00:00+00:00",
  "packets": [
    {
      "id": "round_robin_1",
      "name": "ROUND ROBIN 1",
      "object_key": "bsb-scrimmage-2026/packets/round_robin_1.json",
      "sha256": "<sha256 of the packet file bytes>",
      "password": {
        "algorithm": "scrypt",
        "n": 16384, "r": 8, "p": 1, "dklen": 32,
        "salt": "<base64>",
        "hash": "<base64>"
      }
    }
  ]
}
```

- `packets` order is the order MoSS displays them.
- `id` is the packet filename without `.json` (`[A-Za-z0-9_-]`, up to 80 characters).
- `sha256` is checked by the endpoint before returning a packet; a mismatch returns 502 instead of serving the wrong questions.
- Passwords are never stored in plaintext.

## Passwords

- One password per packet; passwords must be unique within a tournament.
- Case-sensitive. Leading and trailing spaces are ignored.
- Hashed with salted scrypt (parameters above). The upload script and the endpoint must normalize passwords the same way (`normalize_password` / `normalizePassword`).

## Endpoint: `/api/tournament-packets`

| Request | Response |
|---|---|
| `GET /api/tournament-packets` | `{ "format": "moss_packet_index", "version": 1, "slugs": [...] }` |
| `GET /api/tournament-packets?slug=<slug>` | `{ "format": "moss_tournament_packet_list", "version": 1, "tournament_slug", "packets": [{ "id", "name" }] }` (no hashes or object keys) |
| `POST /api/tournament-packets` with `{ "slug", "packet_id", "password" }` | The raw packet JSON |

Errors return `{ "detail": "<message>" }`:

| Status | Meaning |
|---|---|
| 400 | Invalid slug, packet id, password, or request body |
| 401 | Incorrect password |
| 404 | Tournament has no packets, or packet not found |
| 405 | Method other than GET/POST |
| 500 | Missing environment variables |
| 502 | S3 error, malformed manifest, or packet checksum mismatch |

All responses are sent with `Cache-Control: no-store`.

The endpoint only runs on Vercel deployments (production and previews). Under `npm run dev`, MoSS shows "Tournament packets are only available on deployed MoSS."

### Environment variables (Vercel, MoSS project)

| Variable | Value |
|---|---|
| `MOSS_PACKETS_BUCKET` | Bucket name, e.g. `scibowl-moss-packets` |
| `MOSS_PACKETS_AWS_REGION` | e.g. `us-east-2` |
| `MOSS_PACKETS_AWS_ACCESS_KEY_ID` | Access key of the read-only IAM user |
| `MOSS_PACKETS_AWS_SECRET_ACCESS_KEY` | Secret of the read-only IAM user |

Set them for both Production and Preview. They are separate from the `AWS_*` variables used by the snapshot backup function.

## AWS setup

- **Bucket:** private (Block all public access on), versioning on, default encryption. Not the public packet archive bucket.
- **Read-only user for Vercel** (e.g. `moss-packets-reader`): `s3:GetObject` on `arn:aws:s3:::<bucket>/*` and `s3:ListBucket` on `arn:aws:s3:::<bucket>`.
- **Upload user for the person running the script** (e.g. `moss-packets-uploader`): `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::<bucket>/*`, and `s3:ListBucket` on `arn:aws:s3:::<bucket>` (needed so a missing `index.json` reads as "not found" rather than "access denied").

Neither user can delete objects.

## Uploading packets

Requires `pip install boto3` and AWS credentials for the upload user (e.g. `aws configure --profile moss-packets-uploader`).

1. Put the tournament's packet JSON files in one folder.
2. Write a passwords CSV with a header row:

   ```csv
   file,password,name
   round_robin_1.json,maple-river,
   round_robin_2.json,otter-river,Round Robin 2
   ```

   `name` is optional and defaults to the packet's `"packet"` field. Row order is the MoSS display order. Every `.json` file in the folder must be listed.
3. Validate without uploading:

   ```bash
   python scripts/upload_tournament_packets.py --tournament-slug <slug> --passwords passwords.csv path/to/packets/ --dry-run
   ```

4. Upload:

   ```bash
   python scripts/upload_tournament_packets.py --tournament-slug <slug> --passwords passwords.csv path/to/packets/ \
     --profile moss-packets-uploader --bucket <bucket>
   ```

The script validates every packet and the CSV before uploading anything, then uploads packets, the manifest, and the index (in that order). `--write-manifest <path>` saves a local copy of the generated manifest; `--allow-unknown-slug` skips the `tournaments.json` check.

Keep the passwords CSV out of the repo.

## Operational notes

- **Releasing packets:** the TD shares each packet's password when its round starts.
- **Re-uploading** a slug replaces its manifest. Packets left out of the new CSV disappear from MoSS, but their files remain in the bucket.
- **Removing a tournament or deleting packet files** is manual (S3 console): edit `index.json` to drop the slug and delete the `<slug>/` prefix. The upload user cannot delete.
- **Rosters are independent.** Selecting a tournament packet does not set the game's `tournament_slug`; that still comes only from the roster. MoSS shows a non-blocking warning when the packet and roster come from different tournaments.
- After a page reload, recover an in-progress game with **Load Game**, as with locally uploaded packets.
