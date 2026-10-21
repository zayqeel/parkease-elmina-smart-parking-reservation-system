from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: int
    name: str
    email: EmailStr
    vehicle_plate: str | None


class VehicleUpdate(BaseModel):
    vehicle_plate: str = Field(min_length=2, max_length=20)

    @field_validator("vehicle_plate")
    @classmethod
    def normalize_plate(cls, value: str) -> str:
        value = " ".join(value.upper().strip().split())
        if not re.fullmatch(r"[A-Z0-9 ]+", value) or len(value.replace(' ', '')) < 2:
            raise ValueError("Use at least two letters or digits for the plate")
        return value


class VehicleOut(ORMModel):
    id: int
    user_id: int
    vehicle_plate: str


class SpaceOut(ORMModel):
    id: int
    code: str
    zone: str
    level: str
    status: str
    bollard_status: str
    sensor_occupied: bool
    current_vehicle_plate: str | None


class ReservationCreate(BaseModel):
    user_id: int = 1
    space_id: int
    vehicle_plate: str | None = None
    start_time: datetime
    end_time: datetime

    @field_validator("start_time", "end_time")
    @classmethod
    def utc_time(cls, value: datetime) -> datetime:
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    @field_validator("vehicle_plate")
    @classmethod
    def normalize_optional_plate(cls, value: str | None) -> str | None:
        return " ".join(value.upper().strip().split()) if value else None


class ReservationOut(ORMModel):
    id: int
    user_id: int
    space_id: int
    vehicle_plate: str
    start_time: datetime
    end_time: datetime
    status: str
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    penalty_amount: Decimal
    overstay_stage: str
    overstay_minutes: int
    escalation_status: str
    warnings_sent: int
    rerouted_from_space_id: int | None
    space: SpaceOut


class ANPRRequest(BaseModel):
    space_id: int
    vehicle_plate: str = Field(min_length=2, max_length=20)

    @field_validator("vehicle_plate")
    @classmethod
    def normalize_plate(cls, value: str) -> str:
        return " ".join(value.upper().strip().split())


class BollardRequest(BaseModel):
    space_id: int
    action: str

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        normalized = value.upper().strip()
        if normalized not in {"RAISE", "LOWER"}:
            raise ValueError("Action must be RAISE or LOWER")
        return normalized


class OccupancyRequest(BaseModel):
    space_id: int
    occupied: bool
    vehicle_plate: str | None = None

    @field_validator("vehicle_plate")
    @classmethod
    def normalize_occupancy_plate(cls, value: str | None) -> str | None:
        return " ".join(value.upper().strip().split()) if value else None


class OverstayRequest(BaseModel):
    minutes_over: int = Field(ge=0, le=240)


class ReportCreate(BaseModel):
    user_id: int = 1
    category: str = Field(min_length=2, max_length=60)
    location: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=5, max_length=1200)
    image_path: str | None = Field(default=None, max_length=500)


class ReportUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.upper().strip()
        if normalized not in {"OPEN", "IN_REVIEW", "RESOLVED"}:
            raise ValueError("Unsupported report status")
        return normalized


class ReportOut(ORMModel):
    id: int
    user_id: int
    category: str
    location: str
    description: str
    image_path: str | None
    status: str
    created_at: datetime


class EventOut(ORMModel):
    id: int
    space_id: int
    vehicle_plate: str | None
    event_type: str
    detail: str | None
    timestamp: datetime
    space: SpaceOut

