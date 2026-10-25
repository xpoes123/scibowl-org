import crypto from "node:crypto";

// Password-protected tournament packets, uploaded by scripts/upload_tournament_packets.py.
//
//   GET  /api/tournament-packets             -> { format: "moss_packet_index", slugs }
//   GET  /api/tournament-packets?slug=<slug> -> { format: "moss_tournament_packet_list", packets: [{ id, name }] }
//   POST /api/tournament-packets             { slug, packet_id, password } -> raw packet JSON (401 on wrong password)

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type PasswordRecord = {
  algorithm: "scrypt";
  n: number;
  r: number;
  p: number;
  dklen: number;
  salt: string;
  hash: string;
};

type ManifestPacket = {
  id: string;
  name: string;
  object_key: string;
  sha256: string;
  password: PasswordRecord;
};

type Manifest = {
  format: "moss_tournament_packets";
  version: 1;
  tournament_slug: string;
  packets: ManifestPacket[];
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PACKET_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_PASSWORD_LENGTH = 200;
// Upper bound on manifest scrypt cost so a bad manifest can't exhaust function memory.
const MAX_SCRYPT_N = 2 ** 17;

function normalizePassword(password: string): string {
  // Must match normalize_password in scripts/upload_tournament_packets.py.
  return password.trim();
}

function sha256Hex(payload: string): string {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function toAmzDate(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildS3Path(bucket: string, key: string): string {
  const encodedKey = key
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
  return `/${encodeRfc3986(bucket)}/${encodedKey}`;
}

function buildSigV4GetHeaders(config: S3Config, host: string, path: string, now: Date): Record<string, string> {
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaderNames = Object.keys(headers).sort((a, b) => a.localeCompare(b));
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]}`).join("\n") + "\n";
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = ["GET", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// Returns the raw object bytes, or null if the key does not exist.
async function s3GetBytes(config: S3Config, key: string): Promise<Buffer | null> {
  const host = `s3.${config.region}.amazonaws.com`;
  const path = buildS3Path(config.bucket, key);
  const response = await fetch(`https://${host}${path}`, {
    method: "GET",
    headers: buildSigV4GetHeaders(config, host, path, new Date()),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HttpError(502, `S3 getObject failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function s3GetText(config: S3Config, key: string): Promise<string | null> {
  const bytes = await s3GetBytes(config, key);
  // TextDecoder strips a UTF-8 BOM, matching how browsers read uploaded packet files.
  return bytes === null ? null : new TextDecoder("utf-8").decode(bytes);
}

function readS3Config(): S3Config {
  const config = {
    bucket: process.env.MOSS_PACKETS_BUCKET || "",
    region: process.env.MOSS_PACKETS_AWS_REGION || "",
    accessKeyId: process.env.MOSS_PACKETS_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.MOSS_PACKETS_AWS_SECRET_ACCESS_KEY || "",
  };
  if (!config.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) {
    throw new HttpError(500, "Missing required server configuration (packet S3 env vars).");
  }
  return config;
}

function requireSlug(value: unknown): string {
  if (typeof value !== "string" || !SLUG_RE.test(value)) throw new HttpError(400, "Invalid tournament slug.");
  return value;
}

function parseManifest(text: string, slug: string): Manifest {
  const obj = JSON.parse(text) as Partial<Manifest>;
  if (obj.format !== "moss_tournament_packets" || obj.version !== 1 || obj.tournament_slug !== slug || !Array.isArray(obj.packets)) {
    throw new HttpError(502, "Packet manifest has unexpected format.");
  }
  return obj as Manifest;
}

async function loadManifest(config: S3Config, slug: string): Promise<Manifest> {
  const text = await s3GetText(config, `${slug}/manifest.json`);
  if (text === null) throw new HttpError(404, "No packets found for this tournament.");
  return parseManifest(text, slug);
}

function scryptAsync(password: string, salt: Buffer, record: PasswordRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      record.dklen,
      { N: record.n, r: record.r, p: record.p, maxmem: 256 * record.n * record.r },
      (err, derived) => (err ? reject(err) : resolve(derived))
    );
  });
}

async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  if (record.algorithm !== "scrypt" || record.n > MAX_SCRYPT_N) {
    throw new HttpError(502, "Packet manifest has unsupported password parameters.");
  }
  const expected = Buffer.from(record.hash, "base64");
  const derived = await scryptAsync(normalizePassword(password), Buffer.from(record.salt, "base64"), record);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

async function handleIndex(config: S3Config): Promise<string> {
  const text = await s3GetText(config, "index.json");
  const slugs = text === null ? [] : (JSON.parse(text) as { slugs?: unknown }).slugs;
  const valid = Array.isArray(slugs) ? slugs.filter((s): s is string => typeof s === "string") : [];
  return JSON.stringify({ format: "moss_packet_index", version: 1, slugs: valid });
}

async function handleList(config: S3Config, slug: string): Promise<string> {
  const manifest = await loadManifest(config, slug);
  return JSON.stringify({
    format: "moss_tournament_packet_list",
    version: 1,
    tournament_slug: slug,
    packets: manifest.packets.map((p) => ({ id: p.id, name: p.name })),
  });
}

async function handleUnlock(config: S3Config, body: unknown): Promise<string> {
  const rec = (typeof body === "string" ? JSON.parse(body) : body) as Record<string, unknown> | null;
  if (!rec || typeof rec !== "object") throw new HttpError(400, "Request body must be an object.");
  const slug = requireSlug(rec.slug);
  const packetId = rec.packet_id;
  const password = rec.password;
  if (typeof packetId !== "string" || !PACKET_ID_RE.test(packetId)) throw new HttpError(400, "Invalid packet_id.");
  if (typeof password !== "string" || !password.trim() || password.length > MAX_PASSWORD_LENGTH) {
    throw new HttpError(400, "Password is required.");
  }

  const manifest = await loadManifest(config, slug);
  const entry = manifest.packets.find((p) => p.id === packetId);
  if (!entry) throw new HttpError(404, "Packet not found.");
  if (!(await verifyPassword(password, entry.password))) throw new HttpError(401, "Incorrect password.");

  if (!entry.object_key.startsWith(`${slug}/`)) throw new HttpError(502, "Packet manifest has an invalid object key.");
  const packetBytes = await s3GetBytes(config, entry.object_key);
  if (packetBytes === null) throw new HttpError(502, "Packet file is missing from storage.");
  if (crypto.createHash("sha256").update(packetBytes).digest("hex") !== entry.sha256) {
    throw new HttpError(502, "Packet file does not match its manifest checksum.");
  }
  return new TextDecoder("utf-8").decode(packetBytes);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  try {
    let payload: string;
    if (req.method === "GET") {
      const config = readS3Config();
      const rawSlug = req.query?.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      payload = slug === undefined ? await handleIndex(config) : await handleList(config, requireSlug(slug));
    } else if (req.method === "POST") {
      payload = await handleUnlock(readS3Config(), req.body);
    } else {
      res.setHeader("Allow", "GET, POST");
      throw new HttpError(405, "Method not allowed");
    }
    res.statusCode = 200;
    res.end(payload);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err instanceof SyntaxError ? 400 : 500;
    const detail = err instanceof HttpError || err instanceof SyntaxError ? err.message : "Unexpected server error";
    res.statusCode = status;
    res.end(JSON.stringify({ detail }));
  }
}
