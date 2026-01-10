#!/usr/bin/env python3
"""Quick script to list S3 packet structure"""

import boto3
from botocore import UNSIGNED
from botocore.config import Config

# Use anonymous access since bucket is public
s3 = boto3.client('s3', region_name='us-east-2', config=Config(signature_version=UNSIGNED))

print("=== Tournament Folders ===")
# List folders
paginator = s3.get_paginator('list_objects_v2')
for page in paginator.paginate(Bucket='scibowl', Prefix='cleaned_packets/', Delimiter='/'):
    for prefix in page.get('CommonPrefixes', []):
        folder = prefix['Prefix'].replace('cleaned_packets/', '')
        print(f"  {folder}")

print("\n=== All Files (first 50) ===")
# List all files
response = s3.list_objects_v2(Bucket='scibowl', Prefix='cleaned_packets/', MaxKeys=50)
for obj in response.get('Contents', []):
    print(f"  {obj['Key']}")
