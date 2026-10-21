from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, init_db
from .models import ParkingEvent, ParkingSpace, Report, Reservation, User


def seed_database(db: Session | None = None) -> None:
    owns_session = db is None
    session = db or SessionLocal()
    try:
        if session.scalar(select(User.id).limit(1)) is not None:
            from .vehicles import migrate_vehicles
            migrate_vehicles(session)
            return

        now = datetime.utcnow().replace(microsecond=0)
        users = [
            User(name="Aina Rahman", email="aina@elminapark.demo", vehicle_plate="VCD 2187"),
            User(name="Daniel Lee", email="daniel@elminapark.demo", vehicle_plate="WXY 4401"),
            User(name="Priya Nair", email="priya@elminapark.demo", vehicle_plate="BQV 9032"),
        ]
        session.add_all(users)

        spaces: list[ParkingSpace] = []
        general_occupied = {1, 4, 7, 11}
        for number in range(1, 13):
            occupied = number in general_occupied
            spaces.append(
                ParkingSpace(
                    code=f"G-{number:02d}",
                    zone="GENERAL",
                    level="Ground",
                    status="OCCUPIED" if occupied else "AVAILABLE",
                    bollard_status="NONE",
                    sensor_occupied=occupied,
                    current_vehicle_plate=f"GEN {number:04d}" if occupied else None,
                )
            )

        for number in range(1, 9):
            status = "AVAILABLE"
            bollard = "RAISED"
            occupied = False
            plate = None
            if number == 2:
                status, bollard, occupied, plate = "OCCUPIED", "LOWERED", True, "VCD 2187"
            elif number == 3:
                status = "RESERVED"
            elif number == 6:
                status, bollard, occupied, plate = "OCCUPIED", "LOWERED", True, "TMP 6250"
            elif number == 8:
                status, bollard = "MAINTENANCE", "RAISED"
            spaces.append(
                ParkingSpace(
                    code=f"S-{number:02d}",
                    zone="SMART",
                    level="Level 1",
                    status=status,
                    bollard_status=bollard,
                    sensor_occupied=occupied,
                    current_vehicle_plate=plate,
                )
            )

        session.add_all(spaces)
        session.flush()
        by_code = {space.code: space for space in spaces}

        current = Reservation(
            user_id=users[0].id,
            space_id=by_code["S-02"].id,
            vehicle_plate="VCD 2187",
            start_time=now - timedelta(minutes=25),
            end_time=now + timedelta(minutes=20),
            status="CHECKED_IN",
            checked_in_at=now - timedelta(minutes=24),
        )
        queued = Reservation(
            user_id=users[1].id,
            space_id=by_code["S-02"].id,
            vehicle_plate="WXY 4401",
            start_time=now + timedelta(minutes=30),
            end_time=now + timedelta(minutes=90),
            status="UPCOMING",
        )
        reserved = Reservation(
            user_id=users[2].id,
            space_id=by_code["S-03"].id,
            vehicle_plate="BQV 9032",
            start_time=now + timedelta(minutes=60),
            end_time=now + timedelta(minutes=120),
            status="UPCOMING",
        )
        session.add_all([current, queued, reserved])

        session.add_all(
            [
                Report(
                    user_id=users[1].id,
                    category="Lighting",
                    location="General Zone, G-09",
                    description="Lamp is flickering near the pedestrian walkway.",
                    status="IN_REVIEW",
                    created_at=now - timedelta(hours=2),
                ),
                Report(
                    user_id=users[2].id,
                    category="Obstruction",
                    location="Level 1 ramp",
                    description="A trolley is blocking part of the access lane.",
                    status="OPEN",
                    created_at=now - timedelta(minutes=34),
                ),
            ]
        )
        session.add_all(
            [
                ParkingEvent(
                    space_id=by_code["S-02"].id,
                    vehicle_plate="VCD 2187",
                    event_type="OCCUPANCY_CONFIRMED",
                    detail="Computer vision marked bay occupied",
                    timestamp=now - timedelta(minutes=24),
                ),
                ParkingEvent(
                    space_id=by_code["S-02"].id,
                    vehicle_plate="VCD 2187",
                    event_type="BOLLARD_LOWERED",
                    detail="Authorised after ANPR match",
                    timestamp=now - timedelta(minutes=25),
                ),
                ParkingEvent(
                    space_id=by_code["G-04"].id,
                    vehicle_plate="GEN 0004",
                    event_type="VEHICLE_ENTERED",
                    detail="General-zone sensor updated",
                    timestamp=now - timedelta(minutes=42),
                ),
            ]
        )
        session.commit()
        from .vehicles import migrate_vehicles
        migrate_vehicles(session)
    finally:
        if owns_session:
            session.close()


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    init_db()
    seed_database()


if __name__ == "__main__":
    init_db()
    seed_database()
    print("ElminaPark demo data is ready.")

