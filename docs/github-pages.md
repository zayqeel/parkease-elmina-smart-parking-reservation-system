# GitHub Pages browser demo

The Pages build runs entirely in the browser. It uses fictional seeded data and
localStorage (key `parkease-elmina-demo-v1`). No API server, database credentials,
real ANPR, payments or security notifications are involved. Visitors do not share
bookings or incidents. Tabs in the same browser share site storage; Web Locks
serialize operations where supported. Clearing site data removes saved progress.

## Publish

1. Open the repository's **Settings > Pages** and choose **GitHub Actions** as Source.
2. Open **Actions > Publish browser demo > Run workflow** (or push to `main`).
3. Wait for the workflow to succeed. Its deployment output contains the live URL:
   `https://zayqeel.github.io/parkease-elmina-smart-parking-reservation-system/`
4. Add `#admin` to that URL for the desktop dashboard.

GitHub Pages availability for private repositories depends on the account plan.
If GitHub asks you to upgrade or make the repository public, choose deliberately:
making it public exposes source code. The workflow does not change visibility.

## Local preview (no Python required)

From `frontend`:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build:demo
npm.cmd run preview
```

Open the URL Vite prints. The persistent browser-demo banner confirms the mode.
The demo supports multiple plates, exact-bay reservations, simulated arrival,
occupancy/exit, session timers, staged overstay enforcement, rerouting, reports,
admin report updates and reset. Use fictional data. Reset affects only this
browser's demo, not the local backend database or other visitors.

`npm.cmd run dev` and `npm.cmd run build` still use the original FastAPI backend.
The Pages workflow explicitly uses `build:demo`. Do not add secrets to `.env.demo`;
Vite environment values are public in the generated JavaScript.
