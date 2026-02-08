# MoSS Packet JSON

MoSS expects a single JSON object with:
- `packet` (string)
- `year` (number)
- `questions` (array)

Canonical example:
- `apps/moss/frontend/src/assets/sample_packet.json`

Canonical parser/type definitions:
- `apps/moss/frontend/src/App.tsx` (`type Packet`, `type Question`, `parsePacketJson`)

