import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, JSON
from pydantic import ConfigDict

class Client(SQLModel, table=True):
    model_config = ConfigDict(ignored_types=(property,))

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    wedding_date: str = ""               # key-date display string e.g. "17 Mai 2026"
    wedding_date_iso: Optional[str] = None  # ISO format "YYYY-MM-DD" for computation
    days_until: int = 0                  # cached; use .days_remaining for live value
    status: str                          # pack-defined vocabulary; validated in schemas.py
    garment: str = ""
    garment_style: str = ""
    measurements_date: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""
    custom: Optional[dict] = Field(default=None, sa_column=Column(JSON))  # pack-defined extra fields
    fabrics: List["Fabric"] = Relationship(back_populates="client")
    appointments: List["Appointment"] = Relationship(back_populates="client")
    payments: List["Payment"] = Relationship(back_populates="client")
    deliveries: List["Delivery"] = Relationship(back_populates="client")

    @property
    def days_remaining(self) -> Optional[int]:
        """Live days until wedding. Use this instead of days_until for display."""
        if not self.wedding_date_iso:
            return self.days_until  # fallback to cached value
        try:
            target = datetime.date.fromisoformat(self.wedding_date_iso)
            return (target - datetime.date.today()).days
        except ValueError:
            return self.days_until

class Fabric(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client.id")
    name: str
    use: str
    qty: str
    price: str
    to_buy: bool = False
    supplier: str = ""
    client: Optional[Client] = Relationship(back_populates="fabrics")

class Appointment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client.id")
    label: str
    value: str
    date: Optional[str] = None       # ISO YYYY-MM-DD — roadmap field
    title: Optional[str] = None      # display title — roadmap field
    order_id: Optional[str] = None   # e.g. "ORD-2026-001"
    client: Optional[Client] = Relationship(back_populates="appointments")

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client.id")
    label: str
    value: str
    client: Optional[Client] = Relationship(back_populates="payments")

class Delivery(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client.id")
    supplier: str
    description: str
    expected_date: str               # ISO YYYY-MM-DD
    received: bool = False
    client: Optional[Client] = Relationship(back_populates="deliveries")
