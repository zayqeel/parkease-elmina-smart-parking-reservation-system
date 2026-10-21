from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import ParkingEvent, ParkingSpace, Report, Reservation
from ..schemas import EventOut, ReportOut, ReservationOut
from ..services import reservation_query


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard")
async def admin_dashboard(db: Session = Depends(get_db)):
    total_spaces = db.scalar(select(func.count(ParkingSpace.id))) or 0
    occupied = db.scalar(
        select(func.count(ParkingSpace.id)).where(ParkingSpace.status == "OCCUPIED")
    ) or 0
    active_reservations = db.scalar(
        select(func.count(Reservation.id)).where(
            Reservation.status.in_(("UPCOMING", "CHECKED_IN"))
        )
    ) or 0
    open_reports = db.scalar(
        select(func.count(Report.id)).where(Report.status != "RESOLVED")
    ) or 0
    penalties = db.scalar(select(func.sum(Reservation.penalty_amount))) or 0

    enforcement = db.scalars(
        reservation_query()
        .where(Reservation.overstay_stage != "ON_TIME")
        .order_by(Reservation.overstay_minutes.desc())
    ).unique().all()
    events = db.scalars(
        select(ParkingEvent)
        .options(joinedload(ParkingEvent.space))
        .order_by(ParkingEvent.timestamp.desc())
        .limit(12)
    ).unique().all()
    reports = db.scalars(select(Report).order_by(Report.created_at.desc()).limit(8)).all()

    return {
        "metrics": {
            "total_spaces": total_spaces,
            "occupied": occupied,
            "occupancy_rate": round((occupied / total_spaces * 100) if total_spaces else 0),
            "active_reservations": active_reservations,
            "open_reports": open_reports,
            "penalties_collected": float(penalties),
        },
        "enforcement": [ReservationOut.model_validate(item) for item in enforcement],
        "events": [EventOut.model_validate(item) for item in events],
        "reports": [ReportOut.model_validate(item) for item in reports],
    }

