#!/usr/bin/env python3
"""
Generate packet sets JSON from S3 bucket structure.

This script scans the s3://scibowl/cleaned_packets/ folder and generates
the sample_question_sets.json file with S3 URLs.

Usage:
    python scripts/generate_packets_from_s3.py

Requirements:
    - AWS credentials configured (via ~/.aws/credentials or environment variables)
    - boto3 installed: pip install boto3
"""

import json
import os
import re
from pathlib import Path
from typing import List, Dict
import boto3
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import ClientError

BUCKET_NAME = 'scibowl'
PREFIX = 'cleaned_packets/'
REGION = 'us-east-2'
OUTPUT_FILE = 'apps/website/frontend/src/features/packets/data/sample_question_sets.json'

# S3 URL format
S3_URL_BASE = f'https://{BUCKET_NAME}.s3.{REGION}.amazonaws.com'


def create_slug(name: str) -> str:
    """Convert tournament name to URL-friendly slug."""
    # Remove special characters, convert to lowercase, replace spaces with hyphens
    slug = re.sub(r'[^\w\s-]', '', name.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')


def get_tournament_folders(s3_client) -> List[str]:
    """Get list of tournament folders in S3."""
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        folders = []

        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=PREFIX, Delimiter='/'):
            for prefix in page.get('CommonPrefixes', []):
                folder_path = prefix['Prefix']
                folder_name = folder_path.replace(PREFIX, '').rstrip('/')
                if folder_name:  # Skip empty
                    folders.append(folder_name)

        return sorted(folders)
    except ClientError as e:
        print(f"Error listing folders: {e}")
        return []


def get_pdfs_in_folder(s3_client, folder_name: str) -> List[str]:
    """Get all PDF files in a tournament folder."""
    folder_prefix = f'{PREFIX}{folder_name}/'
    pdfs = []

    try:
        paginator = s3_client.get_paginator('list_objects_v2')

        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=folder_prefix):
            for obj in page.get('Contents', []):
                key = obj['Key']
                if key.lower().endswith('.pdf'):
                    # Create S3 URL
                    # URL-encode the key for special characters
                    from urllib.parse import quote
                    encoded_key = quote(key, safe='/')
                    url = f'{S3_URL_BASE}/{encoded_key}'
                    pdfs.append(url)

        return sorted(pdfs)
    except ClientError as e:
        print(f"Error listing PDFs in {folder_name}: {e}")
        return []


def generate_packet_sets() -> List[Dict]:
    """Generate packet sets from S3 structure."""
    # Use anonymous access since bucket is public
    s3_client = boto3.client('s3', region_name=REGION, config=Config(signature_version=UNSIGNED))

    print(f"Scanning S3 bucket: s3://{BUCKET_NAME}/{PREFIX}")

    folders = get_tournament_folders(s3_client)
    print(f"Found {len(folders)} tournament folders")

    packet_sets = []

    for folder in folders:
        print(f"Processing {folder}...")

        pdfs = get_pdfs_in_folder(s3_client, folder)

        if not pdfs:
            print(f"  ⚠️  No PDFs found in {folder}, skipping")
            continue

        # Create packet set
        packet_set = {
            "slug": create_slug(folder),
            "name": folder,
            "packets": pdfs
        }

        packet_sets.append(packet_set)
        print(f"  ✓ Added {len(pdfs)} packets")

    return packet_sets


def main():
    """Main function."""
    print("=" * 60)
    print("S3 Packet Generator")
    print("=" * 60)

    # Generate packet sets
    packet_sets = generate_packet_sets()

    if not packet_sets:
        print("\n❌ No packet sets generated. Check S3 bucket access.")
        return

    # Write to JSON file
    output_path = Path(OUTPUT_FILE)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(packet_sets, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print(f"✅ Generated {len(packet_sets)} packet sets")
    print(f"📄 Output: {OUTPUT_FILE}")
    print("=" * 60)

    # Show sample
    if packet_sets:
        print("\nSample packet set:")
        print(json.dumps(packet_sets[0], indent=2))


if __name__ == '__main__':
    main()
