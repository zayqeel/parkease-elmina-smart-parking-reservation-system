import { CarFront, CheckCircle2, KeyRound, LockKeyhole, Radio, ScanLine, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api";
import { PageHeader, StatusPill } from "../components/UI";

export default function Access({ data, refresh, notify }) {
  const [plate, setPlate] = useState(data.user?.vehicle_plate || "");
  const userReservations = useMemo(
    () => (data.reservations || []).filter((item) => item.user_id === 1 && ["UPCOMING", "CHECKED_IN"].includes(item.status)),
    [data.reservations],
  );
  const [reservationId, setReservationId] = useState("");
  const selected = userReservations.find((item) => item.id === Number(reservationId)) || userReservations[0];
  const [scanResult, setScanResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function savePlate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/users/1/vehicle", { method: "PUT", body: JSON.stringify({ vehicle_plate: plate }) });
      notify("Vehicle plate updated.");
      await refresh();
    } catch (error) { notify(error.message, "error"); }
    finally { setBusy(false); }
  }

  async function runAction(path, body, successMessage) {
    if (!selected) return notify("Reserve a Smart Bay first.", "error");
    setBusy(true);
    try {
      const result = await api(path, { method: "POST", body: JSON.stringify(body) });
      setScanResult(result);
      notify(result.message || successMessage, result.verified === false ? "error" : "success");
      await refresh();
    } catch (error) { notify(error.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Vehicle & access"
        title="Your plate is your parking key."
        description="Simulate ANPR, smart bollard commands and computer-vision occupancy from one control room."
      />
      <section className="access-grid">
        <article className="panel vehicle-card">
          <div className="card-title"><span className="icon-tile"><CarFront size={21} /></span><div><h2>Registered vehicle</h2><p>Used for every Smart Bay verification.</p></div></div>
          <form onSubmit={savePlate}>
            <label>Vehicle registration</label>
            <div className="plate-input-wrap"><span>MY</span><input value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} maxLength={20} /></div>
            <button className="primary-button wide" disabled={busy}>Save vehicle plate</button>
          </form>
          <div className="privacy-note"><ShieldAlert size={17} /><span><strong>Privacy by design</strong>Plate data is used only for access verification in this demo.</span></div>
        </article>

        <article className="panel simulation-card">
          <div className="card-title"><span className="icon-tile blue"><ScanLine size={21} /></span><div><h2>Access simulator</h2><p>Test the end-to-end arrival flow.</p></div></div>
          <label className="field-label">Reservation</label>
          <select value={selected?.id || ""} onChange={(event) => setReservationId(event.target.value)}>
            {userReservations.length ? userReservations.map((item) => <option key={item.id} value={item.id}>{item.space.code} · {item.status.replaceAll("_", " ")}</option>) : <option>No active Smart Bay bookings</option>}
          </select>
          {selected && (
            <div className="access-bay">
              <div><span className="access-code">{selected.space.code}</span><small>{selected.space.level}</small></div>
              <div><StatusPill value={selected.space.status} /><span className="hardware-state"><LockKeyhole size={15} /> {selected.space.bollard_status}</span></div>
            </div>
          )}
          <div className="simulation-actions">
            <button className="primary-button" disabled={busy || !selected} onClick={() => runAction("/simulation/anpr", { space_id: selected.space_id, vehicle_plate: data.user.vehicle_plate }, "ANPR simulation complete")}><ScanLine size={17} /> Verify ANPR</button>
            <button className="secondary-button" disabled={busy || !selected} onClick={() => runAction("/simulation/occupancy", { space_id: selected.space_id, occupied: !selected.space.sensor_occupied, vehicle_plate: data.user.vehicle_plate }, "Occupancy sensor updated")}><Radio size={17} /> {selected?.space.sensor_occupied ? "Simulate exit" : "Confirm occupancy"}</button>
          </div>
          <div className="manual-controls">
            <span>Manual hardware controls</span>
            <button title="Lower bollard" disabled={busy || !selected} onClick={() => runAction("/simulation/bollard", { space_id: selected.space_id, action: "LOWER" }, "Bollard lowered")}><KeyRound size={16} /> Lower</button>
            <button title="Raise bollard" disabled={busy || !selected} onClick={() => runAction("/simulation/bollard", { space_id: selected.space_id, action: "RAISE" }, "Bollard raised")}><LockKeyhole size={16} /> Raise</button>
          </div>
        </article>
      </section>

      <section className="panel signal-console">
        <div className="console-heading"><span><Radio size={17} /> Simulation signal</span><small>Backend response</small></div>
        {scanResult ? (
          <div className={`signal-result ${scanResult.verified === false ? "denied" : "verified"}`}>
            {scanResult.verified === false ? <ShieldAlert size={24} /> : <CheckCircle2 size={24} />}
            <div><strong>{scanResult.verified === false ? "Access denied" : "Signal processed"}</strong><p>{scanResult.message || `Bay status: ${scanResult.status || scanResult.bollard_status}`}</p></div>
            {scanResult.bollard_status && <StatusPill value={scanResult.bollard_status} />}
          </div>
        ) : <div className="console-empty">Run a simulation above to inspect the result.</div>}
      </section>
    </>
  );
}

