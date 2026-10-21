import re
from sqlalchemy import select
from .models import User, Vehicle, Reservation


def plate_key(value: str) -> str:
    return re.sub(r"\s+", "", value).upper()


def migrate_vehicles(db):
    """Preserve existing users and booking plates on upgrading the local database."""
    rows = [(u.id, u.vehicle_plate) for u in db.scalars(select(User)).all()]
    rows += [(r.user_id, r.vehicle_plate) for r in db.scalars(select(Reservation)).all()]
    keys = set(db.scalars(select(Vehicle.plate_key)).all())
    for user_id, plate in rows:
        if plate and plate_key(plate) not in keys:
            key = plate_key(plate)
            db.add(Vehicle(user_id=user_id, vehicle_plate=plate, plate_key=key))
            keys.add(key)
    db.commit()
