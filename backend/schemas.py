import re
from typing import List, Optional
from pydantic import BaseModel, field_validator

from config import get_pack


def _valid_status_keys() -> set:
    return {s["key"] for s in get_pack()["statuses"]["client"]}


def _validate_status(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    valid = _valid_status_keys()
    if v not in valid:
        raise ValueError(f"status must be one of {sorted(valid)}, got {v!r}")
    return v

class AppointmentIn(BaseModel):
    label: str
    value: str

class PaymentIn(BaseModel):
    label: str
    value: str

class FabricIn(BaseModel):
    name: str
    use: str
    qty: str
    price: str
    to_buy: bool = False
    supplier: str = ""

class ClientCreate(BaseModel):
    name: str
    wedding_date: str = ""
    days_until: int = 0
    wedding_date_iso: Optional[str] = None
    status: str
    garment: str = ""
    garment_style: str = ""
    measurements_date: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""
    custom: dict = {}
    appointments: List[AppointmentIn] = []
    payments: List[PaymentIn] = []
    fabrics: List[FabricIn] = []

    _check_status = field_validator("status")(_validate_status)

class ClientPatch(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    days_until: Optional[int] = None
    wedding_date: Optional[str] = None
    wedding_date_iso: Optional[str] = None
    garment: Optional[str] = None
    garment_style: Optional[str] = None
    measurements_date: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    custom: Optional[dict] = None

    _check_status = field_validator("status")(_validate_status)

_APPOINTMENT_OUTCOMES = {"", "done", "no_show"}
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")

def _validate_outcome(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if v not in _APPOINTMENT_OUTCOMES:
        raise ValueError(f"outcome must be one of {sorted(_APPOINTMENT_OUTCOMES)}, got {v!r}")
    return v

def _validate_time(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return v
    if not _TIME_RE.match(v):
        raise ValueError(f"time must match HH:MM, got {v!r}")
    return v

def _validate_duration_min(v: Optional[int]) -> Optional[int]:
    if v is None:
        return v
    if v <= 0:
        raise ValueError(f"duration_min must be positive, got {v!r}")
    return v

class AppointmentCreate(BaseModel):
    client_id: Optional[int] = None
    title: str
    date: str                          # ISO YYYY-MM-DD
    order_id: Optional[str] = None
    time: Optional[str] = None         # "HH:MM" 24h
    duration_min: Optional[int] = None
    source: Optional[str] = None       # None/'manual' · 'booking' (open set)
    external_ref: Optional[str] = None
    context: dict = {}                 # scheduling-app payload: event type, invitee answers…

    _check_time = field_validator("time")(_validate_time)
    _check_duration_min = field_validator("duration_min")(_validate_duration_min)

class AppointmentPatch(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    order_id: Optional[str] = None
    client_id: Optional[int] = None
    time: Optional[str] = None
    duration_min: Optional[int] = None
    outcome: Optional[str] = None
    source: Optional[str] = None
    external_ref: Optional[str] = None
    context: Optional[dict] = None

    _check_time = field_validator("time")(_validate_time)
    _check_duration_min = field_validator("duration_min")(_validate_duration_min)
    _check_outcome = field_validator("outcome")(_validate_outcome)

class DeliveryCreate(BaseModel):
    client_id: Optional[int] = None
    supplier: str
    description: str
    expected_date: str                 # ISO YYYY-MM-DD
    received: bool = False

class DeliveryPatch(BaseModel):
    client_id: Optional[int] = None
    supplier: Optional[str] = None
    description: Optional[str] = None
    expected_date: Optional[str] = None
    received: Optional[bool] = None

_LEAD_CHANNELS = {"phone", "walkin", "whatsapp", "email", "booking"}
_LEAD_STATUSES = {"open", "converted", "dismissed"}

def _validate_lead_channel(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if v not in _LEAD_CHANNELS:
        raise ValueError(f"channel must be one of {sorted(_LEAD_CHANNELS)}, got {v!r}")
    return v

def _validate_lead_status(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if v not in _LEAD_STATUSES:
        raise ValueError(f"status must be one of {sorted(_LEAD_STATUSES)}, got {v!r}")
    return v

class LeadCreate(BaseModel):
    channel: str
    name: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""
    fields: dict = {}

    _check_channel = field_validator("channel")(_validate_lead_channel)

class LeadPatch(BaseModel):
    channel: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    fields: Optional[dict] = None
    status: Optional[str] = None

    _check_channel = field_validator("channel")(_validate_lead_channel)
    _check_status = field_validator("status")(_validate_lead_status)

class LeadConvertAppointment(BaseModel):
    title: str
    date: str

class LeadConvert(BaseModel):
    client: ClientCreate
    appointment: Optional[LeadConvertAppointment] = None
