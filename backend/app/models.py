from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="user")
    reports: Mapped[list["Report"]] = relationship(back_populates="user")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vehicle_plate: Mapped[str] = mapped_column(String(20))
    plate_key: Mapped[str] = mapped_column(String(20), unique=True)


class ParkingSpace(Base):
    __tablename__ = "parking_spaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    zone: Mapped[str] = mapped_column(String(16), index=True)  # GENERAL | SMART
    level: Mapped[str] = mapped_column(String(40), default="Ground")
    status: Mapped[str] = mapped_column(String(24), default="AVAILABLE", index=True)
    bollard_status: Mapped[str] = mapped_column(String(16), default="NONE")
    sensor_occupied: Mapped[bool] = mapped_column(Boolean, default=False)
    current_vehicle_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)

    reservations: Mapped[list["Reservation"]] = relationship(
        back_populates="space", foreign_keys="Reservation.space_id"
    )
    events: Mapped[list["ParkingEvent"]] = relationship(back_populates="space")


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("parking_spaces.id"), index=True)
    vehicle_plate: Mapped[str] = mapped_column(String(20))
    start_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[str] = mapped_column(String(24), default="UPCOMING", index=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    penalty_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    overstay_stage: Mapped[str] = mapped_column(String(24), default="ON_TIME")
    overstay_minutes: Mapped[int] = mapped_column(default=0)
    escalation_status: Mapped[str] = mapped_column(String(40), default="NONE")
    warnings_sent: Mapped[int] = mapped_column(default=0)
    rerouted_from_space_id: Mapped[int | None] = mapped_column(
        ForeignKey("parking_spaces.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="reservations")
    space: Mapped[ParkingSpace] = relationship(
        back_populates="reservations", foreign_keys=[space_id]
    )
    rerouted_from_space: Mapped[ParkingSpace | None] = relationship(
        foreign_keys=[rerouted_from_space_id]
    )


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(60))
    location: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="OPEN", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="reports")


class ParkingEvent(Base):
    __tablename__ = "parking_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("parking_spaces.id"), index=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    event_type: Mapped[str] = mapped_column(String(60), index=True)
    detail: Mapped[str | None] = mapped_column(String(240), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    space: Mapped[ParkingSpace] = relationship(back_populates="events")

