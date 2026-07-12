"""Active-pack loader. One pack (vertical config) per deployment, selected by
the ACTIVE_PACK env var (default "atelier-demo"). Packs live in packs/<id>/
at the repo root (copied to /app/packs in the Docker image): pack.json plus
optional pack-owned data files (seed.json, intake/). A pack.json may declare
{"extends": "<base-id>"} — single level only — and is deep-merged over its
base; the merged pack's "id" is always the directory name. Loaded lazily and
cached so importing `main` in tests works without any env setup."""
import json
import os
from pathlib import Path


def packs_root() -> Path:
    """packs/ location: PACKS_DIR env override, else next to backend/ (dev:
    <repo>/packs) or inside the app dir (container: /app/packs)."""
    env = os.getenv("PACKS_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve().parent
    for candidate in (here / "packs", here.parent / "packs"):
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("no packs/ directory found; set PACKS_DIR")


_cache: dict[str, dict] = {}


def active_pack_id() -> str:
    return os.getenv("ACTIVE_PACK", "atelier-demo")


def pack_dir(pack_id: str | None = None) -> Path:
    """Directory of a pack (default: the active one) — home of pack.json and
    pack-owned data files like seed.json and intake/."""
    return packs_root() / (pack_id or active_pack_id())


def _read_pack_json(pack_id: str) -> dict:
    with open(pack_dir(pack_id) / "pack.json", encoding="utf-8") as f:
        return json.load(f)


def _deep_merge(base: dict, override: dict) -> dict:
    """Dicts merge recursively; lists and scalars replace."""
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def get_pack() -> dict:
    pack_id = active_pack_id()
    if pack_id not in _cache:
        data = _read_pack_json(pack_id)
        base_id = data.pop("extends", None)
        if base_id:
            base = _read_pack_json(base_id)
            if "extends" in base:
                raise ValueError(
                    f"pack '{pack_id}' extends '{base_id}', which itself "
                    "extends another pack — chained extends is not supported")
            data = _deep_merge(base, data)
        data["id"] = pack_id
        _cache[pack_id] = data
    return _cache[pack_id]


def reset_pack_cache() -> None:
    """Clear the cache — used by tests that switch ACTIVE_PACK at runtime."""
    _cache.clear()
