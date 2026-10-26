#!/usr/bin/env python3
"""
Upload password-protected tournament packets for MoSS "Select Tournament Packet".

Validates a folder of MoSS packet JSON files, hashes each packet's password with
scrypt, and uploads the packets plus a manifest to the private packets bucket.
The packet files are uploaded byte-for-byte so MoSS packet checksums match a
locally uploaded copy of the same file.

Usage:
    python scripts/upload_tournament_packets.py \\
        --tournament-slug my-tournament \\
        --passwords path/to/passwords.csv \\
        path/to/packets/ \\
        [--dry-run]

passwords.csv columns (header row required):
    file      Packet filename within the packets folder (e.g. round_robin_1.json)
    password  The password moderators type to unlock the packet
    name      Optional display name; defaults to the packet's "packet" field

Packets appear in MoSS in the CSV row order.

Requirements (not needed for --dry-run):
    - boto3 installed: pip install boto3
    - AWS credentials with s3:GetObject/s3:PutObject on the bucket, e.g. via
      `aws configure` or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
    - Bucket from --bucket or MOSS_PACKETS_BUCKET

Bucket layout:
    index.json                         {"format": "moss_packet_index", "version": 1, "slugs": [...]}
    <slug>/manifest.json               packet list with names and password hashes
    <slug>/packets/<packet_id>.json    raw packet files
"""
from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent
_TOURNAMENTS_JSON = (
    _REPO_ROOT / "apps" / "website" / "frontend" / "src" / "features" / "tournaments" / "data" / "tournaments.json"
)

DEFAULT_REGION = "us-east-2"

# Must match the unlock endpoint in apps/moss/frontend/api/.
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SALT_BYTES = 16

QUESTION_TYPES = {"TOSSUP", "BONUS"}
QUESTION_STYLES = {"MULTIPLE_CHOICE", "SHORT_ANSWER", "IDENTIFY_ALL", "RANK"}
CATEGORIES = {"BIOLOGY", "CHEMISTRY", "EARTH_SPACE", "ENERGY", "MATH", "PHYSICS"}
MC_ANSWERS = {"W", "X", "Y", "Z"}
PACKET_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


def normalize_password(password: str) -> str:
    # Must match the unlock endpoint. Case-sensitive; surrounding whitespace is ignored.
    return password.strip()


def hash_password(password: str) -> dict[str, Any]:
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.scrypt(
        normalize_password(password).encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return {
        "algorithm": "scrypt",
        "n": SCRYPT_N,
        "r": SCRYPT_R,
        "p": SCRYPT_P,
        "dklen": SCRYPT_DKLEN,
        "salt": base64.b64encode(salt).decode("ascii"),
        "hash": base64.b64encode(digest).decode("ascii"),
    }


def verify_password(password: str, record: dict[str, Any]) -> bool:
    digest = hashlib.scrypt(
        normalize_password(password).encode("utf-8"),
        salt=base64.b64decode(record["salt"]),
        n=record["n"],
        r=record["r"],
        p=record["p"],
        dklen=record["dklen"],
    )
    return hmac.compare_digest(digest, base64.b64decode(record["hash"]))


def validate_packet(obj: Any) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors would break MoSS; warnings are spec deviations."""
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(obj, dict):
        return ["top level must be a JSON object"], warnings
    if not isinstance(obj.get("packet"), str) or not obj["packet"].strip():
        errors.append('missing non-empty string field "packet"')
    year = obj.get("year")
    if not isinstance(year, int) or isinstance(year, bool) or not 1900 <= year <= 3000:
        errors.append('"year" must be an integer year')
    questions = obj.get("questions")
    if not isinstance(questions, list) or not questions:
        errors.append('"questions" must be a non-empty array')
        return errors, warnings

    seen_ids: set[int] = set()
    pairs: dict[int, list[str]] = {}
    for idx, q in enumerate(questions):
        where = f"questions[{idx}]"
        if not isinstance(q, dict):
            errors.append(f"{where} must be an object")
            continue

        qid = q.get("id")
        if not isinstance(qid, int) or isinstance(qid, bool):
            errors.append(f"{where}.id must be an integer")
        elif qid in seen_ids:
            errors.append(f"{where}.id {qid} is duplicated")
        else:
            seen_ids.add(qid)

        pair_id = q.get("pair_id")
        if not isinstance(pair_id, int) or isinstance(pair_id, bool):
            errors.append(f"{where}.pair_id must be an integer")

        qtype = q.get("question_type")
        if qtype not in QUESTION_TYPES:
            errors.append(f"{where}.question_type must be one of {sorted(QUESTION_TYPES)}")
        elif isinstance(pair_id, int):
            pairs.setdefault(pair_id, []).append(qtype)

        style = q.get("question_style")
        if style not in QUESTION_STYLES:
            errors.append(f"{where}.question_style must be one of {sorted(QUESTION_STYLES)}")

        category = q.get("category")
        if not isinstance(category, str):
            errors.append(f"{where}.category must be a string")
        elif category not in CATEGORIES:
            warnings.append(f"{where}.category {category!r} is not a standard category")

        if not isinstance(q.get("question_text"), str) or not q["question_text"].strip():
            errors.append(f"{where}.question_text must be a non-empty string")

        options = q.get("options")
        if not isinstance(options, list) or not all(isinstance(o, str) for o in options):
            errors.append(f"{where}.options must be an array of strings")
            options = None

        answer = q.get("correct_answer")
        if style in ("MULTIPLE_CHOICE", "SHORT_ANSWER"):
            if not isinstance(answer, str) or not answer.strip():
                errors.append(f"{where}.correct_answer must be a non-empty string for {style}")
            elif style == "MULTIPLE_CHOICE" and answer not in MC_ANSWERS:
                errors.append(f"{where}.correct_answer must be one of W/X/Y/Z for MULTIPLE_CHOICE")
        elif style in ("IDENTIFY_ALL", "RANK"):
            if not isinstance(answer, list) or not all(isinstance(a, int) and not isinstance(a, bool) for a in answer):
                errors.append(f"{where}.correct_answer must be an array of integers for {style}")

        if style == "MULTIPLE_CHOICE" and options is not None and len(options) != 4:
            warnings.append(f"{where} is MULTIPLE_CHOICE with {len(options)} options (expected 4)")

    for pair_id, types in sorted(pairs.items()):
        if types.count("TOSSUP") != 1 or types.count("BONUS") > 1:
            warnings.append(f"pair_id {pair_id} has {types.count('TOSSUP')} tossup(s) and {types.count('BONUS')} bonus(es)")

    return errors, warnings


def load_known_slugs() -> set[str] | None:
    try:
        data = json.loads(_TOURNAMENTS_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return {t["slug"] for t in data if isinstance(t, dict) and isinstance(t.get("slug"), str)}


def read_passwords_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = {name.strip() for name in reader.fieldnames or []}
        if not {"file", "password"} <= fieldnames:
            raise SystemExit(f"{path}: header row must include 'file' and 'password' columns")
        rows = []
        for row in reader:
            row = {(k or "").strip(): (v or "") for k, v in row.items()}
            if not row.get("file", "").strip() and not row.get("password", "").strip():
                continue
            rows.append(row)
    return rows


def build_upload_plan(slug: str, packets_dir: Path, rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Validate everything and return (packets, problems). Nothing is uploaded here."""
    problems: list[str] = []
    packets: list[dict[str, Any]] = []
    seen_files: set[str] = set()
    seen_passwords: dict[str, str] = {}

    for line_no, row in enumerate(rows, start=2):
        filename = row.get("file", "").strip()
        password = row.get("password", "")
        where = f"passwords.csv line {line_no} ({filename or 'no file'})"

        if not filename:
            problems.append(f"{where}: missing file")
            continue
        if filename in seen_files:
            problems.append(f"{where}: file listed more than once")
            continue
        seen_files.add(filename)

        packet_id = Path(filename).stem
        if Path(filename).suffix.lower() != ".json" or Path(filename).name != filename:
            problems.append(f"{where}: file must be a .json filename inside the packets folder")
            continue
        if not PACKET_ID_RE.match(packet_id):
            problems.append(f"{where}: filename stem must match {PACKET_ID_RE.pattern}")
            continue

        normalized = normalize_password(password)
        if not normalized:
            problems.append(f"{where}: missing password")
        elif normalized in seen_passwords:
            problems.append(f"{where}: same password as {seen_passwords[normalized]}")
        else:
            seen_passwords[normalized] = filename

        path = packets_dir / filename
        if not path.is_file():
            problems.append(f"{where}: file not found in {packets_dir}")
            continue
        raw = path.read_bytes()
        try:
            obj = json.loads(raw.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            problems.append(f"{filename}: invalid JSON ({e})")
            continue

        errors, warnings = validate_packet(obj)
        problems.extend(f"{filename}: {e}" for e in errors)
        for w in warnings:
            print(f"  warning: {filename}: {w}")
        if errors:
            continue

        packets.append({
            "id": packet_id,
            "name": row.get("name", "").strip() or obj["packet"].strip(),
            "file": filename,
            "raw": raw,
            "password": password,
            "question_count": len(obj["questions"]),
        })

    listed = {p.name for p in packets_dir.glob("*.json")}
    for missing in sorted(listed - seen_files):
        problems.append(f"{missing}: in packets folder but not listed in passwords.csv")

    names = [p["name"] for p in packets]
    for name in sorted({n for n in names if names.count(n) > 1}):
        problems.append(f"display name {name!r} is used by more than one packet")

    return packets, problems


def build_manifest(slug: str, packets: list[dict[str, Any]]) -> dict[str, Any]:
    entries = []
    for p in packets:
        record = hash_password(p["password"])
        if not verify_password(p["password"], record):
            raise SystemExit(f"{p['file']}: password hash self-check failed")
        entries.append({
            "id": p["id"],
            "name": p["name"],
            "object_key": f"{slug}/packets/{p['id']}.json",
            "sha256": hashlib.sha256(p["raw"]).hexdigest(),
            "password": record,
        })
    return {
        "format": "moss_tournament_packets",
        "version": 1,
        "tournament_slug": slug,
        "uploaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "packets": entries,
    }


def upload(bucket: str, region: str, profile: str | None, slug: str, packets: list[dict[str, Any]], manifest: dict[str, Any]) -> None:
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        raise SystemExit("boto3 is required for uploading: pip install boto3")

    session = boto3.Session(profile_name=profile, region_name=region)
    s3 = session.client("s3")

    def put_json_bytes(key: str, body: bytes) -> None:
        s3.put_object(Bucket=bucket, Key=key, Body=body, ContentType="application/json")
        print(f"  uploaded s3://{bucket}/{key}")

    # Packets first, then the manifest, then the index, so nothing ever references a missing object.
    for p, entry in zip(packets, manifest["packets"]):
        put_json_bytes(entry["object_key"], p["raw"])
    put_json_bytes(f"{slug}/manifest.json", (json.dumps(manifest, indent=2) + "\n").encode("utf-8"))

    try:
        current = json.loads(s3.get_object(Bucket=bucket, Key="index.json")["Body"].read())
        slugs = set(current.get("slugs", []))
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") not in ("NoSuchKey", "404"):
            raise
        slugs = set()
    slugs.add(slug)
    index = {"format": "moss_packet_index", "version": 1, "slugs": sorted(slugs)}
    put_json_bytes("index.json", (json.dumps(index, indent=2) + "\n").encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload password-protected tournament packets for MoSS.")
    parser.add_argument("packets_dir", type=Path, help="Folder containing the packet JSON files.")
    parser.add_argument("--tournament-slug", required=True, help="Tournament slug from tournaments.json.")
    parser.add_argument("--passwords", type=Path, required=True, help="CSV with file,password[,name] columns.")
    parser.add_argument("--bucket", default=os.environ.get("MOSS_PACKETS_BUCKET"), help="Defaults to $MOSS_PACKETS_BUCKET.")
    parser.add_argument("--region", default=os.environ.get("MOSS_PACKETS_AWS_REGION", DEFAULT_REGION))
    parser.add_argument("--profile", default=None, help="AWS CLI profile to use for credentials.")
    parser.add_argument("--allow-unknown-slug", action="store_true", help="Skip the tournaments.json slug check.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the plan without uploading.")
    parser.add_argument("--write-manifest", type=Path, help="Also write the generated manifest to this local path.")
    args = parser.parse_args()

    slug = args.tournament_slug.strip()
    known = load_known_slugs()
    if not args.allow_unknown_slug:
        if known is None:
            raise SystemExit(f"Could not read {_TOURNAMENTS_JSON}; pass --allow-unknown-slug to skip the check.")
        if slug not in known:
            raise SystemExit(f"Unknown tournament slug {slug!r}. MoSS only lists tournaments in tournaments.json.")

    if not args.packets_dir.is_dir():
        raise SystemExit(f"{args.packets_dir} is not a directory")

    print(f"Validating packets in {args.packets_dir} for {slug!r}...")
    packets, problems = build_upload_plan(slug, args.packets_dir, read_passwords_csv(args.passwords))
    if problems:
        print(f"\n{len(problems)} problem(s) found; nothing was uploaded:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        raise SystemExit(1)

    manifest = build_manifest(slug, packets)

    print(f"\n{len(packets)} packet(s) ready (in MoSS display order):")
    for p, entry in zip(packets, manifest["packets"]):
        print(f"  {p['name']:<28} {p['file']:<32} {p['question_count']:>3} questions  sha256 {entry['sha256'][:12]}")

    if args.write_manifest:
        args.write_manifest.parent.mkdir(parents=True, exist_ok=True)
        args.write_manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"\nWrote manifest to {args.write_manifest}")

    if args.dry_run:
        print("\nDry run: nothing was uploaded.")
        return

    if not args.bucket:
        raise SystemExit("No bucket given; pass --bucket or set MOSS_PACKETS_BUCKET.")
    print(f"\nUploading to s3://{args.bucket}/{slug}/ ...")
    upload(args.bucket, args.region, args.profile, slug, packets, manifest)
    print("\nDone. Re-uploading a slug replaces its manifest; packets left out are no longer listed in MoSS.")


if __name__ == "__main__":
    main()
