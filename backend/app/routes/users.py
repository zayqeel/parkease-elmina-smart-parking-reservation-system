from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..models import User, Vehicle
from ..schemas import UserOut, VehicleUpdate, VehicleOut
from ..vehicles import plate_key


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}/vehicle", response_model=UserOut)
async def update_vehicle(user_id: int, payload: VehicleUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    vehicle = await add_vehicle(user_id, payload, db)
    user.vehicle_plate = vehicle.vehicle_plate
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/vehicles", response_model=list[VehicleOut])
async def list_vehicles(user_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(Vehicle).where(Vehicle.user_id == user_id)).all()


@router.post("/{user_id}/vehicles", response_model=VehicleOut, status_code=201)
async def add_vehicle(user_id: int, payload: VehicleUpdate, db: Session = Depends(get_db)):
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    vehicle = Vehicle(user_id=user_id, vehicle_plate=payload.vehicle_plate, plate_key=plate_key(payload.vehicle_plate))
    db.add(vehicle)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This vehicle plate is already registered")
    db.refresh(vehicle)
    return vehicle

