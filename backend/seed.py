"""Generic demo-seed loader. Seed data is pack-owned: packs/<id>/seed.json
(only demo packs carry one). No seed.json in the active pack → no-op, so a
tenant deployment can never be seeded with demo data.

Dates in seed.json may be tokens resolved against today at load time, keeping
the demo evergreen: {{iso:+25}} → ISO date, {{disp:+25}} / {{short:-40}} →
display strings via meta.monthAbbrev, {{ts:-12 11:45}} → ISO timestamp,
{{days:+25}} → int. Offsets are days and the sign is mandatory. A string that
is exactly one token keeps the token's native type; tokens embedded in longer
strings interpolate.

Run once: python3 seed.py"""
import datetime
import json
import re
from sqlmodel import Session

from config import pack_dir
from models import Client, Fabric, Appointment, Payment, Delivery, Lead, Note

_TOKEN = re.compile(r"\{\{(iso|disp|short|ts|days):([+-]\d+)(?: (\d{2}:\d{2}))?\}\}")


def _resolve_token(kind: str, offset: int, hhmm: str | None,
                   month_abbrev: list[str] | None):
    d = datetime.date.today() + datetime.timedelta(days=offset)
    if kind == "iso":
        return d.isoformat()
    if kind == "ts":
        return f"{d.isoformat()}T{hhmm}:00"
    if kind == "days":
        return offset
    if month_abbrev is None:
        raise ValueError(f"seed.json uses a {kind} token but has no meta.monthAbbrev")
    if kind == "disp":
        return f"{d.day:02d} {month_abbrev[d.month - 1]} {d.year}"
    return f"{d.day:02d} {month_abbrev[d.month - 1]}"  # short


def resolve_value(value, month_abbrev: list[str] | None = None):
    """Resolve date tokens in a JSON value, recursively."""
    if isinstance(value, str):
        m = _TOKEN.fullmatch(value)
        if m:
            return _resolve_token(m.group(1), int(m.group(2)), m.group(3), month_abbrev)
        return _TOKEN.sub(
            lambda m: str(_resolve_token(m.group(1), int(m.group(2)), m.group(3), month_abbrev)),
            value)
    if isinstance(value, list):
        return [resolve_value(v, month_abbrev) for v in value]
    if isinstance(value, dict):
        return {k: resolve_value(v, month_abbrev) for k, v in value.items()}
    return value


_CHILDREN = {
    "fabrics": Fabric, "appointments": Appointment,
    "payments": Payment, "deliveries": Delivery, "notes": Note,
}


def load_seed() -> dict | None:
    """The active pack's seed.json, token-resolved; None if the pack has no
    seed (tenant packs)."""
    path = pack_dir() / "seed.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    month_abbrev = raw.pop("meta", {}).get("monthAbbrev")
    return resolve_value(raw, month_abbrev)


def run_seed(s: Session) -> bool:
    data = load_seed()
    if data is None:
        return False
    first_client_id = None
    for entry in data.get("clients", []):
        c = Client(**entry["client"])
        s.add(c)
        s.commit()
        s.refresh(c)
        if first_client_id is None:
            first_client_id = c.id
        for key, model in _CHILDREN.items():
            for rec in entry.get(key, []):
                s.add(model(**rec, client_id=c.id))
        s.commit()
    if first_client_id is not None:
        for rec in data.get("today_appointments", []):
            s.add(Appointment(**rec, client_id=first_client_id))
        s.commit()
    for rec in data.get("leads", []):
        s.add(Lead(**rec))
    s.commit()
    return True


if __name__ == "__main__":
    from database import create_db, engine
    create_db()
    with Session(engine) as s:
        seeded = run_seed(s)
    print("Seeded OK" if seeded else "No seed.json in active pack — nothing to do")
