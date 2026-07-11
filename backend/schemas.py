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
    wedding_date: str
    days_until: int
    wedding_date_iso: Optional[str] = None
    status: str
    garment: str = ""
    garment_style: str = ""
    measurements_date: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""
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

    _check_status = field_validator("status")(_validate_status)

class AppointmentCreate(BaseModel):
    client_id: Optional[int] = None
    title: str
    date: str                          # ISO YYYY-MM-DD
    order_id: Optional[str] = None

class AppointmentPatch(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    order_id: Optional[str] = None
    client_id: Optional[int] = None

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
