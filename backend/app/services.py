from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from .models import ParkingEvent, ParkingSpace, Reservation


ACTIVE_RESERVATION_STATUSES = ("UPCOMING", "CHECKED_IN")


def add_event(
    db: Session,
    space: ParkingSpace,
    event_type: str,
    vehicle_plate: str | None = None,
    detail: str | None = None,
) -> ParkingEvent:
    event = ParkingEvent(
        space_id=space.id,
        vehicle_plate=vehicle_plate,
        event_type=event_type,
        detail=detail,
    )
    db.add(event)
    return event


def reservation_query():
    return select(Reservation).options(
        joinedload(Reservation.space), joinedload(Reservation.rerouted_from_space)
    )


def has_overlap(
    db: Session,
    space_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_reservation_id: int | None = None,
) -> bool:
    query = select(func.count(Reservation.id)).where(
        Reservation.space_id == space_id,
        Reservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        Reservation.start_time < end_time,
        Reservation.end_time > start_time,
    )
    if exclude_reservation_id:
        query = query.where(Reservation.id != exclude_reservation_id)
    return bool(db.scalar(query))


def find_reroute_space(db: Session, reservation: Reservation) -> ParkingSpace | None:
    candidates = db.scalars(
        select(ParkingSpace)
        .where(
            ParkingSpace.zone == "SMART",
            ParkingSpace.status == "AVAILABLE",
            ParkingSpace.sensor_occupied.is_(False),
            ParkingSpace.id != reservation.space_id,
        )
        .order_by(ParkingSpace.code)
    ).all()
    for candidate in candidates:
        if not has_overlap(
            db, candidate.id, reservation.start_time, reservation.end_time, reservation.id
        ):
            return candidate
    return None


def refresh_space_status(db: Session, space: ParkingSpace) -> None:
    if space.status == "MAINTENANCE" or space.sensor_occupied:
        return
    upcoming = db.scalar(
        select(Reservation.id)
        .where(
            Reservation.space_id == space.id,
            Reservation.status == "UPCOMING",
        )
        .limit(1)
    )
    space.status = "RESERVED" if upcoming else "AVAILABLE"
    if space.zone == "SMART":
        space.bollard_status = "RAISED"

