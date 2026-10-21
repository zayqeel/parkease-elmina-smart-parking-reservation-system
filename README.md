# ParkEase Elmina: Smart Parking Reservation System

ParkEase Elmina is the repository name for the ElminaPark hackathon MVP.

## Current mobile interface

Users can now add multiple plates in **Vehicle & access → My vehicles**. Plates are unique across the demo, ignoring capitalization and whitespace. Each plate may have one upcoming or checked-in reservation; cancel the upcoming booking or simulate vehicle exit to free it for another slot. The booking dialog selects an available saved plate, and the Session screen lets users switch between active vehicle sessions. Existing user and reservation plates are migrated into the new `vehicles` table at startup without resetting data.

The app now uses `elminapark_smart_township_mobility.html` as its visual template. React mounts that design through `frontend/src/MobileApp.jsx`; `frontend/src/mobile-controller.js` replaces the template's mock JavaScript with backend API calls. Run the frontend with Vite, rather than opening the original HTML directly. The original HTML is preserved as supplied; opening it directly still runs its original mock behavior.

The updated interface includes live capacity, Smart-only reservations with visit duration, reservation-specific access controls, occupancy and exit simulation, persisted incident reports, overstay controls, and an admin view accessible through the profile button. It refreshes backend data every ten seconds. Styling, icons and fonts currently require internet access through the template's CDNs. Existing desktop React screens remain in the source for reference.

ElminaPark is a hackathon-ready parking operations MVP for a smarter, fairer and safer township. It combines exact Smart Bay reservations and bollard protection with ANPR access, computer-vision occupancy signals, transparent overstay enforcement, incident reporting and an admin control view.

The camera, ANPR and bollard integrations are intentionally simulated through real backend endpoints and visible UI controls, so the full product story can be demonstrated locally without physical hardware.

## What works

- Live General and Smart Zone availability
- Exact Smart Bay reservation with time-overlap protection
- User vehicle-plate registration
- ANPR match/deny simulation
- Automatic and manual smart-bollard state changes
- Computer-vision occupancy/exit simulation
- Live parking-session countdown
- Original overstay flow: 10-minute grace → penalty → protect/reroute next booking → security escalation
- Safety Hub incident submission and status tracking
- Admin metrics, enforcement cases, sensor events and incident management
- One-click demo-data reset

## Stack

This is a local demo with a fixed seeded user and no authentication. Admin and simulation endpoints are intentionally accessible locally. Penalty rates are illustrative, no payments or external notifications are sent, and incident photos use an optional URL rather than uploads. Run the server on loopback only.

- Frontend: React 18, Vite, Lucide icons
- Backend: FastAPI, SQLAlchemy, Pydantic
- Database: SQLite, created and seeded automatically

## Project structure

```text
elminapark/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── services.py
│   │   ├── seed.py
│   │   └── routes/
│   │       ├── parking.py
│   │       ├── reservations.py
│   │       ├── users.py
│   │       ├── simulation.py
│   │       ├── reports.py
│   │       └── admin.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api.js
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Run locally

Open two terminals from this repository.

Requires Node.js 20.19+ and Python 3.12+. If Python's bundled pip bootstrap fails on Windows, use `python -m venv --without-pip .venv`, followed by `python -m pip --python .venv install -r requirements.txt` from the backend directory.

### 1. Backend

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the FastAPI server during development.

## Recommended 3-minute demo

1. Start on **Overview** to show live capacity and the seeded active session in Smart Bay S-02.
2. Open **Find parking**, select an available Smart Bay and reserve the exact space.
3. Open **Vehicle & access**, choose the reservation, run **Verify ANPR**, then **Confirm occupancy**. The bollard lowers and the bay becomes occupied.
4. Open **Parking session** and use the +5, +15 and +35 minute controls to demonstrate grace, penalty, automatic rerouting and escalation.
5. Submit an incident in **Safety Hub**.
6. Open **Admin dashboard** to show the resulting event log, penalty, reroute and incident queue.
7. Use **Reset demo** to restore the seeded state for the next presentation.

## Overstay policy simulated by the MVP

| Stage | Rule | System action |
| --- | --- | --- |
| On time | Before booked end | Normal session monitoring |
| Grace | 1–10 minutes overdue | Warning notification; no penalty |
| Penalty | 11–30 minutes overdue | RM10 + RM2 per overdue minute after minute 10; next affected reservation rerouted when possible |
| Escalated | More than 30 minutes overdue | Penalty remains active and security is notified according to approved parking policy |

## API map

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/bootstrap` | Initial app data |
| GET | `/api/parking` | Live bay states, optionally filtered by zone |
| POST | `/api/reservations` | Reserve an exact Smart Bay |
| PUT | `/api/users/{id}/vehicle` | Register or update a vehicle plate |
| POST | `/api/simulation/anpr` | Simulate access verification |
| POST | `/api/simulation/bollard` | Raise/lower a Smart Bay bollard |
| POST | `/api/simulation/occupancy` | Simulate CV occupancy or exit |
| POST | `/api/simulation/overstay/{id}` | Move an active session through enforcement stages |
| GET/POST | `/api/reports` | Read or submit Safety Hub reports |
| GET | `/api/admin/dashboard` | Admin metrics, enforcement, reports and events |
| POST | `/api/simulation/reset` | Restore the original seeded demo |

## Tests and production build

With the backend virtual environment active:

```bash
cd backend
python -m pytest
```

For the frontend:

```bash
cd frontend
npm run build
```

The SQLite file is generated at `backend/elminapark.db` on first API startup and is intentionally excluded from version control.

