from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ParkingSpace, Reservation, User, Vehicle
from ..vehicles import plate_key
from ..schemas import ReservationCreate, ReservationOut
from ..services import add_event, has_overlap, refresh_space_status, reservation_query


router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.get("", response_model=list[ReservationOut])
async def list_reservations(
    user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = reservation_query().order_by(Reservation.start_time.desc())
    if user_id:
        query = query.where(Reservation.user_id == user_id)
    return db.scalars(query).unique().all()


@router.post("", response_model=ReservationOut, status_code=201)
async def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db)):
    # Serialize SQLite booking checks and writes, including concurrent requests.
    db.execute(text("BEGIN IMMEDIATE"))
    user = db.get(User, payload.user_id)
    space = db.get(ParkingSpace, payload.space_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not space:
        raise HTTPException(status_code=404, detail="Parking bay not found")
    if space.zone != "SMART":
        raise HTTPException(status_code=400, detail="Only Smart Bays can be reserved")
    if space.status == "MAINTENANCE":
        raise HTTPException(status_code=409, detail="Bay is under maintenance")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    if payload.end_time <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reservation must end in the future")
    if has_overlap(db, space.id, payload.start_time, payload.end_time):
        raise HTTPException(status_code=409, detail="Bay is already reserved for that time")

    plate = payload.vehicle_plate or user.vehicle_plate
    if not plate:
        raise HTTPException(status_code=400, detail="Register a vehicle plate first")
    vehicle = db.scalar(select(Vehicle).where(Vehicle.user_id == user.id, Vehicle.plate_key == plate_key(plate)))
    if not vehicle:
        raise HTTPException(status_code=400, detail="Choose a vehicle registered to your account")
    for existing in db.scalars(select(Reservation).where(Reservation.status.in_(("UPCOMING", "CHECKED_IN")))).all():
        if plate_key(existing.vehicle_plate) == vehicle.plate_key:
            raise HTTPException(status_code=409, detail="This plate already has a parking slot. Cancel the booking or exit before reserving another.")
    plate = vehicle.vehicle_plate

    reservation = Reservation(
        user_id=user.id,
        space_id=space.id,
        vehicle_plate=plate,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="UPCOMING",
    )
    db.add(reservation)
    if not space.sensor_occupied:
        space.status = "RESERVED"
        space.bollard_status = "RAISED"
    add_event(db, space, "RESERVATION_CREATED", plate, "Exact Smart Bay reserved")
    db.commit()
    return db.scalar(reservation_query().where(Reservation.id == reservation.id))


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
async def cancel_reservation(reservation_id: int, db: Session = Depends(get_db)):
    reservation = db.scalar(
        reservation_query().where(Reservation.id == reservation_id)
    )
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != "UPCOMING":
        raise HTTPException(status_code=409, detail="Only upcoming reservations can be cancelled")
    reservation.status = "CANCELLED"
    add_event(
        db,
        reservation.space,
        "RESERVATION_CANCELLED",
        reservation.vehicle_plate,
    )
    db.flush()
    refresh_space_status(db, reservation.space)
    db.commit()
    return reservation

