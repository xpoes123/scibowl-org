import crypto from "node:crypto";

type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

type SnapshotMeta = {
  tournament_slug?: string | null;
  packet_year: number;
  packet_name: string;
  team_a: string;
  team_b: string;
  game_instance_id: string;
};

type UploadBody = {
  snapshot_meta: SnapshotMeta;
  export_obj: unknown;
};

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "export";
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} must be non-empty`);
  return trimmed;
}

function requireNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function requireSnapshotMeta(value: unknown): SnapshotMeta {
  if (!value || typeof value !== "object") throw new Error("snapshot_meta must be an object");
  const rec = value as Record<string, unknown>;

  const tournamentSlugRaw = rec.tournament_slug;
  const tournament_slug =
    tournamentSlugRaw === undefined || tournamentSlugRaw === null
      ? null
      : requireString(tournamentSlugRaw, "snapshot_meta.tournament_slug");

  const packet_year = requireNumber(rec.packet_year, "snapshot_meta.packet_year");
  const packet_name = requireString(rec.packet_name, "snapshot_meta.packet_name");
  const team_a = requireString(rec.team_a, "snapshot_meta.team_a");
  const team_b = requireString(rec.team_b, "snapshot_meta.team_b");
  const game_instance_id = requireString(rec.game_instance_id, "snapshot_meta.game_instance_id");

  if (!/^[A-Za-z0-9_:-]{6,80}$/.test(game_instance_id)) {
    throw new Error("snapshot_meta.game_instance_id must match /^[A-Za-z0-9_:-]{6,80}$/");
  }
  if (!Number.isInteger(packet_year) || packet_year < 1900 || packet_year > 3000) {
    throw new Error("snapshot_meta.packet_year must be a plausible year (integer 1900..3000)");
  }

  return {
    tournament_slug,
    packet_year,
    packet_name,
    team_a,
    team_b,
    game_instance_id,
  };
}

function parseUploadBody(body: unknown): UploadBody {
  if (!body || typeof body !== "object") throw new Error("Request body must be an object");
  const rec = body as Record<string, unknown>;
  const snapshot_meta = requireSnapshotMeta(rec.snapshot_meta);
  const export_obj = rec.export_obj;
  if (!export_obj || typeof export_obj !== "object") throw new Error("export_obj must be an object");
  return { snapshot_meta, export_obj };
}

function sha256Hex(payload: string): string {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function toAmzDate(now: Date): string {
  // YYYYMMDDTHHMMSSZ
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function toDateStamp(amzDate: string): string {
  return amzDate.slice(0, 8);
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildS3Path(bucket: string, key: string): string {
  const encodedBucket = encodeRfc3986(bucket);
  const encodedKey = key
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
  return `/${encodedBucket}/${encodedKey}`;
}

function buildSnapshotKey(meta: SnapshotMeta): string {
  const tournamentPart = safeFilenamePart(meta.tournament_slug ?? "custom");
  const packetPart = safeFilenamePart(`${meta.packet_year}_${meta.packet_name}`);
  const teamParts = [safeFilenamePart(meta.team_a), safeFilenamePart(meta.team_b)].sort((a, b) => a.localeCompare(b));
  const teamsPart = teamParts.join("__");
  const gameInstanceId = meta.game_instance_id;
  return `${tournamentPart}/${packetPart}/${teamsPart}/${gameInstanceId}/latest.json`;
}

function buildSigV4Headers(args: {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  amzDate: string;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  extraHeaders?: Record<string, string>;
}): Record<string, string> {
  const {
    method,
    host,
    path,
    region,
    service,
    amzDate,
    payloadHash,
    accessKeyId,
    secretAccessKey,
    extraHeaders = {},
  } = args;

  const canonicalQueryString = "";
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
  };

  const signedHeaderNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort((a, b) => a.localeCompare(b));

  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(headers[name]).trim().replace(/\s+/g, " ")}`)
    .join("\n") + "\n";

  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    method.toUpperCase(),
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const dateStamp = toDateStamp(amzDate);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, v])),
    authorization,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ detail: "Method not allowed" }));
      return;
    }

    const bucket = process.env.MOSS_SNAPSHOTS_BUCKET || "";
    const region = process.env.AWS_REGION || "";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ detail: "Missing required server configuration (S3 env vars)." }));
      return;
    }

    const token = (process.env.MOSS_SNAPSHOTS_UPLOAD_TOKEN || "").trim();
    if (token) {
      const rawHeader = req.headers?.authorization;
      const auth = Array.isArray(rawHeader) ? rawHeader[0] ?? "" : String(rawHeader ?? "");
      if (auth !== `Bearer ${token}`) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ detail: "Unauthorized" }));
        return;
      }
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { snapshot_meta, export_obj } = parseUploadBody(body);

    const key = buildSnapshotKey(snapshot_meta);
    const payloadObj = export_obj as Record<string, unknown>;
    payloadObj.snapshot_meta = snapshot_meta;
    const payload = JSON.stringify(payloadObj, null, 2) + "\n";

    const now = new Date();
    const amzDate = toAmzDate(now);
    const payloadHash = sha256Hex(payload);

    const host = `s3.${region}.amazonaws.com`;
    const path = buildS3Path(bucket, key);
    const url = `https://${host}${path}`;

    const headers = buildSigV4Headers({
      method: "PUT",
      host,
      path,
      region,
      service: "s3",
      amzDate,
      payloadHash,
      accessKeyId,
      secretAccessKey,
      extraHeaders: {
        "content-type": "application/json",
      },
    });

    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: payload,
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        detail: "S3 putObject failed",
        status: putRes.status,
        body: text.slice(0, 2000),
      }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, key }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ detail: msg }));
  }
}
