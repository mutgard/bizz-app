from fastapi import APIRouter

from config import get_pack

router = APIRouter()


@router.get("/config")
def read_config():
    """Return the active vertical pack for the frontend to bootstrap from."""
    return get_pack()
