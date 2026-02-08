#!/usr/bin/env python3
"""
Wrapper around the canonical packet set generator.

Canonical script: `scripts/generate_packets_from_s3.py`
Canonical output: `apps/website/frontend/src/features/packets/data/packet_sets.json`
"""

from __future__ import annotations

import runpy
from pathlib import Path


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    script_path = repo_root / "scripts" / "generate_packets_from_s3.py"
    runpy.run_path(str(script_path), run_name="__main__")


if __name__ == "__main__":
    main()

