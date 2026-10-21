from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ParkingSpace
from ..schemas import SpaceOut


router = APIRouter(prefix="/parking", tags=["parking"])


@router.get("", response_model=list[SpaceOut])
async def list_spaces(
    zone: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(ParkingSpace).order_by(ParkingSpace.zone, ParkingSpace.code)
    if zone:
        query = query.where(ParkingSpace.zone == zone.upper())
    return db.scalars(query).all()


@router.get("/summary")
async def parking_summary(db: Session = Depends(get_db)):
    spaces = db.scalars(select(ParkingSpace)).all()

    def summarize(zone: str):
        filtered = [space for space in spaces if space.zone == zone]
        return {
            "total": len(filtered),
            "available": sum(space.status == "AVAILABLE" for space in filtered),
            "occupied": sum(space.status == "OCCUPIED" for space in filtered),
            "reserved": sum(space.status == "RESERVED" for space in filtered),
            "maintenance": sum(space.status == "MAINTENANCE" for space in filtered),
        }

    return {"GENERAL": summarize("GENERAL"), "SMART": summarize("SMART")}

