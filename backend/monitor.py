"""In-memory operational monitor: error ring buffer + uptime.

Phase 1 of the backoffice: per-tenant capture, read via the /admin API.
In-memory by design (resets on restart); holds request paths only, no bodies.
"""
import time
import traceback
from collections import deque

START_TIME = time.time()
_errors: deque = deque(maxlen=200)


def record(method: str, path: str, status: int, detail: str = "") -> None:
    _errors.append({
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
        "method": method,
        "path": path,
        "status": status,
        "detail": detail,
    })


def record_exception(method: str, path: str, exc: Exception) -> None:
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    record(method, path, 500, tb[-2000:])


def list_errors() -> list:
    """Newest first."""
    return list(reversed(_errors))


def uptime_seconds() -> int:
    return int(time.time() - START_TIME)


def reset() -> None:
    """Test helper."""
    _errors.clear()
