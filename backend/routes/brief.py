from fastapi import APIRouter, HTTPException
import json

from config import pack_dir

router = APIRouter(prefix="/api/brief", tags=["brief"])

@router.get("/{token}")
def get_brief(token: str):
    intake_dir = pack_dir() / "intake"
    if intake_dir.is_dir():
        for path in sorted(intake_dir.glob("client_*.json")):
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            if data.get("token") == token:
                brief = data.get("brief", {})
                return {
                    "client_name": data.get("client_name", ""),
                    "wedding_date": brief.get("wedding_date", ""),
                    "venue": brief.get("venue", ""),
                    "garment": brief.get("garment", ""),
                    "style": brief.get("style", ""),
                    "fabric_notes": brief.get("fabric_notes", ""),
                }
    raise HTTPException(status_code=404, detail="Brief not found")
