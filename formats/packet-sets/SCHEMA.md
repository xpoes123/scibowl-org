# Packet Sets Schema

Canonical data file:
- `apps/website/frontend/src/features/packets/data/packet_sets.json`

TypeScript shape (consumer):
- `apps/website/frontend/src/features/packets/types.ts`

## Shape

The file is a JSON array of objects:

```ts
type PacketSet = {
  slug: string;   // URL-friendly identifier
  name: string;   // display name
  packets: string[]; // list of packet PDF URLs
};
```

