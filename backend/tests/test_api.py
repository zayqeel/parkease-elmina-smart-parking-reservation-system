import os
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_elminapark.db"
os.environ["ELMINAPARK_DB"] = str(TEST_DB)

import httpx  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


def setup_module():
    if TEST_DB.exists():
        TEST_DB.unlink()


def teardown_module():
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if TEST_DB.exists():
        TEST_DB.unlink()


async def run_core_demo_flow():
    transport = httpx.ASGITransport(app=app)
    async with app.router.lifespan_context(app):
      async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        health = await client.get("/api/health")
        assert health.status_code == 200

        bootstrap = (await client.get("/api/bootstrap")).json()
        assert bootstrap["user"]["vehicle_plate"] == "VCD 2187"
        assert len(bootstrap["spaces"]) == 20

        vehicle = await client.put("/api/users/1/vehicle", json={"vehicle_plate": "abc 1234"})
        assert vehicle.json()["vehicle_plate"] == "ABC 1234"
        assert (await client.post('/api/users/1/vehicles', json={'vehicle_plate':'abc1234'})).status_code == 409
        assert (await client.post('/api/users/2/vehicles', json={'vehicle_plate':'ABC  1234'})).status_code == 409
        assert (await client.post('/api/users/1/vehicles', json={'vehicle_plate':'   '})).status_code == 422
        added = await client.post('/api/users/1/vehicles', json={'vehicle_plate':'NEW 9876'})
        assert added.status_code == 201
        assert len((await client.get('/api/users/1/vehicles')).json()) == 3

        smart_bay = next(
            space
            for space in bootstrap["spaces"]
            if space["zone"] == "SMART" and space["status"] == "AVAILABLE"
        )
        anpr_denied = await client.post(
            "/api/simulation/anpr",
            json={"space_id": smart_bay["id"], "vehicle_plate": "NOT 123"},
        )
        assert anpr_denied.json()["verified"] is False

        now = datetime.now(timezone.utc)
        payload = {"space_id": smart_bay["id"], "user_id": 1,
                   "start_time": now.isoformat(),
                   "end_time": (now + timedelta(hours=1)).isoformat()}
        booking = await client.post("/api/reservations", json=payload)
        assert booking.status_code == 201, booking.text
        duplicate = await client.post("/api/reservations", json=payload)
        assert duplicate.status_code == 409
        other_bay = next(s for s in bootstrap['spaces'] if s['zone']=='SMART' and s['status']=='AVAILABLE' and s['id'] != smart_bay['id'])
        other_payload = {**payload, 'space_id':other_bay['id'], 'vehicle_plate':'abc1234'}
        assert (await client.post('/api/reservations', json=other_payload)).status_code == 409
        assert (await client.post('/api/reservations', json={**other_payload, 'vehicle_plate':'UNREGISTERED'})).status_code == 400
        second = await client.post('/api/reservations', json={**other_payload, 'vehicle_plate':'NEW 9876'})
        assert second.status_code == 201, second.text
        assert (await client.post(f"/api/reservations/{second.json()['id']}/cancel")).status_code == 200
        second_again = await client.post('/api/reservations', json={**other_payload, 'vehicle_plate':'NEW 9876'})
        assert second_again.status_code == 201
        await client.post(f"/api/reservations/{second_again.json()['id']}/cancel")
        occupancy = {"space_id": smart_bay["id"], "occupied": True, "vehicle_plate": "ABC 1234"}
        assert (await client.post("/api/simulation/occupancy", json=occupancy)).status_code == 409
        verified = await client.post("/api/simulation/anpr", json={"space_id": smart_bay["id"], "vehicle_plate": "ABC 1234"})
        assert verified.json()["verified"] is True
        assert (await client.post("/api/simulation/occupancy", json=occupancy)).status_code == 200
        assert (await client.post('/api/reservations', json=other_payload)).status_code == 409
        assert (await client.post("/api/simulation/bollard", json={"space_id": smart_bay["id"], "action": "RAISE"})).status_code == 409
        assert (await client.post("/api/simulation/occupancy", json={"space_id": smart_bay["id"], "occupied": False})).status_code == 200
        after_exit = await client.post('/api/reservations', json=other_payload)
        assert after_exit.status_code == 201
        await client.post(f"/api/reservations/{after_exit.json()['id']}/cancel")

        active = next(
            item
            for item in bootstrap["reservations"]
            if item["user_id"] == 1 and item["status"] == "CHECKED_IN"
        )
        overstay = await client.post(
            f"/api/simulation/overstay/{active['id']}", json={"minutes_over": 15}
        )
        assert overstay.status_code == 200
        assert overstay.json()["stage"] == "PENALTY"
        assert overstay.json()["rerouted"] is not None

        report = await client.post(
            "/api/reports",
            json={
                "user_id": 1,
                "category": "Safety",
                "location": "S-04",
                "description": "Test incident report",
            },
        )
        assert report.status_code == 201
        dashboard = await client.get("/api/admin/dashboard")
        assert dashboard.status_code == 200, dashboard.text
        escalation = await client.post(f"/api/simulation/overstay/{active['id']}", json={"minutes_over": 35})
        assert escalation.json()["escalation_status"] == "SECURITY_NOTIFIED"


def test_core_demo_flow():
    asyncio.run(run_core_demo_flow())

