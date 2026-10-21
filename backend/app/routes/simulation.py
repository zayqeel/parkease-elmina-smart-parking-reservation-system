from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ParkingSpace, Reservation
from ..schemas import ANPRRequest, BollardRequest, OccupancyRequest, OverstayRequest
from ..seed import reset_database
from ..services import add_event, find_reroute_space, refresh_space_status, reservation_query


router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/anpr")
async def simulate_anpr(payload: ANPRRequest, db: Session = Depends(get_db)):
    space = db.get(ParkingSpace, payload.space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Parking bay not found")
    if space.zone != "SMART":
        raise HTTPException(status_code=400, detail="ANPR access is for Smart Bays")
    if space.status == "MAINTENANCE" or space.sensor_occupied:
        raise HTTPException(status_code=409, detail="Bay is unavailable or occupied")

    reservations = db.scalars(
        reservation_query()
        .where(
            Reservation.space_id == space.id,
            Reservation.status.in_(("UPCOMING", "CHECKED_IN")),
        )
        .order_by(Reservation.start_time)
    ).unique().all()
    match = next(
        (item for item in reservations if item.vehicle_plate == payload.vehicle_plate
         and item.start_time - timedelta(minutes=10) <= datetime.utcnow() < item.end_time),
        None,
    )
    if not match:
        add_event(db, space, "ANPR_DENIED", payload.vehicle_plate, "No matching reservation")
        db.commit()
        return {
            "verified": False,
            "message": "Plate not authorised for this bay",
            "bollard_status": space.bollard_status,
        }

    space.bollard_status = "LOWERED"
    space.current_vehicle_plate = payload.vehicle_plate
    add_event(db, space, "ANPR_VERIFIED", payload.vehicle_plate, f"Reservation #{match.id}")
    add_event(db, space, "BOLLARD_LOWERED", payload.vehicle_plate, "Automatic access granted")
    db.commit()
    return {
        "verified": True,
        "message": f"Welcome. {space.code} is unlocked.",
        "reservation_id": match.id,
        "bollard_status": space.bollard_status,
    }


@router.post("/bollard")
async def simulate_bollard(payload: BollardRequest, db: Session = Depends(get_db)):
    space = db.get(ParkingSpace, payload.space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Parking bay not found")
    if space.zone != "SMART":
        raise HTTPException(status_code=400, detail="General bays do not have bollards")
    if payload.action == "RAISE" and space.sensor_occupied:
        raise HTTPException(status_code=409, detail="Safety lock: bay is occupied")
    space.bollard_status = "RAISED" if payload.action == "RAISE" else "LOWERED"
    add_event(db, space, f"BOLLARD_{space.bollard_status}", detail="Manual demo command")
    db.commit()
    return {"space_id": space.id, "bollard_status": space.bollard_status}


@router.post("/occupancy")
async def simulate_occupancy(payload: OccupancyRequest, db: Session = Depends(get_db)):
    space = db.get(ParkingSpace, payload.space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Parking bay not found")
    if space.status == "MAINTENANCE":
        raise HTTPException(status_code=409, detail="Bay is under maintenance")

    if payload.occupied:
        plate = payload.vehicle_plate or space.current_vehicle_plate or "UNKNOWN"
        if space.zone == "SMART" and (space.bollard_status != "LOWERED" or space.current_vehicle_plate != plate):
            raise HTTPException(status_code=409, detail="Verify this vehicle with ANPR before confirming occupancy")
        if space.sensor_occupied:
            raise HTTPException(status_code=409, detail="Bay is already occupied")
        space.sensor_occupied = True
        space.current_vehicle_plate = plate
        space.status = "OCCUPIED"
        if space.zone == "SMART":
            space.bollard_status = "LOWERED"
        reservation = db.scalar(
            reservation_query().where(
                Reservation.space_id == space.id,
                Reservation.vehicle_plate == plate,
                Reservation.status.in_(("UPCOMING", "CHECKED_IN")),
            )
        )
        authorised = reservation is not None
        if reservation:
            reservation.status = "CHECKED_IN"
            reservation.checked_in_at = reservation.checked_in_at or datetime.utcnow()
        add_event(
            db,
            space,
            "OCCUPANCY_CONFIRMED" if authorised else "UNAUTHORISED_OCCUPANCY",
            plate,
            "Computer-vision occupancy simulation",
        )
    else:
        plate = space.current_vehicle_plate
        active = db.scalar(
            reservation_query().where(
                Reservation.space_id == space.id,
                Reservation.status == "CHECKED_IN",
            )
        )
        if active:
            active.status = "COMPLETED"
            active.checked_out_at = datetime.utcnow()
        space.sensor_occupied = False
        space.current_vehicle_plate = None
        if space.zone == "SMART":
            space.bollard_status = "RAISED"
        db.flush()
        refresh_space_status(db, space)
        add_event(db, space, "VEHICLE_EXITED", plate, "Bay released by occupancy sensor")

    db.commit()
    return {
        "space_id": space.id,
        "status": space.status,
        "occupied": space.sensor_occupied,
        "bollard_status": space.bollard_status,
    }


@router.post("/overstay/{reservation_id}")
async def simulate_overstay(
    reservation_id: int,
    payload: OverstayRequest,
    db: Session = Depends(get_db),
):
    reservation = db.scalar(
        reservation_query().where(Reservation.id == reservation_id)
    )
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != "CHECKED_IN":
        raise HTTPException(status_code=409, detail="Only an active session can overstay")

    minutes = payload.minutes_over
    if minutes < reservation.overstay_minutes:
        raise HTTPException(status_code=409, detail="Demo time cannot move backwards; reset the demo to restart")
    reservation.end_time = datetime.utcnow() - timedelta(minutes=minutes)
    reservation.overstay_minutes = minutes
    rerouted = None
    message = "Session remains within its booked time."

    if minutes == 0:
        reservation.overstay_stage = "ON_TIME"
        reservation.penalty_amount = Decimal("0.00")
        reservation.escalation_status = "NONE"
    elif minutes <= 10:
        reservation.overstay_stage = "GRACE"
        reservation.warnings_sent = max(reservation.warnings_sent, 1)
        reservation.escalation_status = "MONITORING"
        message = f"Grace-period warning sent. {10 - minutes} minutes remain."
        add_event(
            db,
            reservation.space,
            "OVERSTAY_WARNING",
            reservation.vehicle_plate,
            f"{minutes} minutes overdue",
        )
    else:
        reservation.overstay_stage = "PENALTY" if minutes <= 30 else "ESCALATED"
        reservation.warnings_sent = max(reservation.warnings_sent, 2)
        reservation.penalty_amount = Decimal("10.00") + Decimal(minutes - 10) * Decimal("2.00")
        reservation.escalation_status = (
            "SECURITY_NOTIFIED" if minutes > 30 else "PENALTY_ACTIVE"
        )
        message = "Penalty active. The next affected booking is being protected."
        add_event(
            db,
            reservation.space,
            "OVERSTAY_PENALTY" if minutes <= 30 else "OVERSTAY_ESCALATED",
            reservation.vehicle_plate,
            f"{minutes} minutes overdue",
        )

        next_reservation = db.scalar(
            reservation_query()
            .where(
                Reservation.space_id == reservation.space_id,
                Reservation.status == "UPCOMING",
                Reservation.start_time >= reservation.end_time,
            )
            .order_by(Reservation.start_time)
        )
        if next_reservation:
            alternative = find_reroute_space(db, next_reservation)
            if alternative:
                original_space = next_reservation.space
                next_reservation.rerouted_from_space_id = original_space.id
                next_reservation.space_id = alternative.id
                alternative.status = "RESERVED"
                alternative.bollard_status = "RAISED"
                rerouted = {
                    "reservation_id": next_reservation.id,
                    "from": original_space.code,
                    "to": alternative.code,
                }
                add_event(
                    db,
                    alternative,
                    "BOOKING_REROUTED",
                    next_reservation.vehicle_plate,
                    f"Moved from {original_space.code} due to overstay",
                )
                message += f" Reservation #{next_reservation.id} moved to {alternative.code}."

    db.commit()
    return {
        "reservation_id": reservation.id,
        "stage": reservation.overstay_stage,
        "minutes_over": minutes,
        "penalty_amount": float(reservation.penalty_amount),
        "escalation_status": reservation.escalation_status,
        "rerouted": rerouted,
        "message": message,
    }


@router.post("/reset")
async def reset_demo():
    reset_database()
    return {"message": "Demo data restored"}

