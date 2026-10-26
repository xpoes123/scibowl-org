# MoSS Packet JSON

MoSS expects a single JSON object with:
- `packet` (string)
- `year` (number)
- `questions` (array)

Canonical example:
- `apps/moss/frontend/src/assets/sample_packet.json`

Packets can be loaded in MoSS by uploading a file from the computer, or through **Select Tournament Packet** (password-protected packets stored in S3; see `formats/moss/tournament-packets/`). Tournament packets are served byte-for-byte as uploaded, so both paths produce the same packet checksum.

Canonical parser/type definitions:
- `apps/moss/frontend/src/App.tsx` (`type Packet`, `type Question`, `parsePacketJson`)

