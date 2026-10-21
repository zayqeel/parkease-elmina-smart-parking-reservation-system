from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .database import SessionLocal, init_db
from .models import ParkingSpace, Report, Reservation, User, Vehicle
from .routes import admin, parking, reports, reservations, simulation, users
from .seed import seed_database
from .services import reservation_query
from .schemas import UserOut, SpaceOut, ReservationOut, ReportOut, VehicleOut


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_database()
    yield


app = FastAPI(
    title="ElminaPark API",
    version="0.1.0",
    description="Hackathon MVP for smart, fair and safer township parking.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parking.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(reservations.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ElminaPark API"}


@app.get("/api/bootstrap")
async def bootstrap():
    with SessionLocal() as db:
        user = db.get(User, 1)
        spaces = db.scalars(
            select(ParkingSpace).order_by(ParkingSpace.zone, ParkingSpace.code)
        ).all()
        reservations_list = db.scalars(
            reservation_query().order_by(Reservation.start_time.desc())
        ).unique().all()
        reports_list = db.scalars(
            select(Report).order_by(Report.created_at.desc())
        ).all()
        return {
            "user": UserOut.model_validate(user),
            "vehicles": [VehicleOut.model_validate(v) for v in db.scalars(select(Vehicle).where(Vehicle.user_id == 1)).all()],
            "spaces": [SpaceOut.model_validate(item) for item in spaces],
            "reservations": [ReservationOut.model_validate(item) for item in reservations_list],
            "reports": [ReportOut.model_validate(item) for item in reports_list],
        }

