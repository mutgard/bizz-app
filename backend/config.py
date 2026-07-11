"""Active-pack loader. One pack (vertical config) per deployment, selected by
the ACTIVE_PACK env var (default "atelier"). Loaded lazily and cached so that
importing `main` in tests works without any env setup."""
import json
import os
from pathlib import Path

PACKS_DIR = Path(__file__).parent / "packs"

_cache: dict[str, dict] = {}


def active_pack_id() -> str:
    return os.getenv("ACTIVE_PACK", "atelier")


def get_pack() -> dict:
    pack_id = active_pack_id()
    if pack_id not in _cache:
        path = PACKS_DIR / f"{pack_id}.json"
        with open(path, encoding="utf-8") as f:
            _cache[pack_id] = json.load(f)
    return _cache[pack_id]


def reset_pack_cache() -> None:
    """Clear the cache — used by tests that switch ACTIVE_PACK at runtime."""
    _cache.clear()
