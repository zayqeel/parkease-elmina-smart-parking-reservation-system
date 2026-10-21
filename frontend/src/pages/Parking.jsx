import { CalendarClock, CheckCircle2, Clock3, Info, Search } from "lucide-react";
import { useMemo, useState } from "react";
import BayCard from "../components/BayCard";
import { PageHeader } from "../components/UI";
import { api } from "../api";

function localInput(date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

export default function Parking({ data, refresh, notify }) {
  const [zone, setZone] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const startDefault = new Date(Date.now() + 5 * 60000);
  const [startTime, setStartTime] = useState(localInput(startDefault));
  const [endTime, setEndTime] = useState(localInput(new Date(startDefault.getTime() + 60 * 60000)));

  const spaces = useMemo(() => (data.spaces || []).filter((space) => {
    return (zone === "ALL" || space.zone === zone) && space.code.toLowerCase().includes(query.toLowerCase());
  }), [data.spaces, query, zone]);

  function choose(space) {
    if (space.zone !== "SMART") {
      notify("General bays are first come, first served.", "info");
      return;
    }
    if (space.status !== "AVAILABLE") {
      notify(`${space.code} is ${space.status.toLowerCase()}. Choose an available Smart Bay.`, "error");
      return;
    }
    setSelected(space);
  }

  async function reserve(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api("/reservations", {
        method: "POST",
        body: JSON.stringify({
          user_id: 1,
          space_id: selected.id,
          vehicle_plate: data.user.vehicle_plate,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
        }),
      });
      notify(`${selected.code} is reserved. Its bollard will remain raised until ANPR verification.`);
      setSelected(null);
      await refresh();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Live parking"
        title="Choose the right bay for your visit."
        description="General bays are walk-in. Smart Bays can be reserved exactly and protected by a connected bollard."
      />

      <section className="panel parking-toolbar">
        <div className="segmented-control">
          {["ALL", "GENERAL", "SMART"].map((item) => (
            <button key={item} className={zone === item ? "active" : ""} onClick={() => setZone(item)}>{item === "ALL" ? "All zones" : `${item[0]}${item.slice(1).toLowerCase()} Zone`}</button>
          ))}
        </div>
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bay" /></label>
      </section>

      <div className="zone-legend">
        <span><i className="legend-dot available" /> Available</span>
        <span><i className="legend-dot reserved" /> Reserved</span>
        <span><i className="legend-dot occupied" /> Occupied</span>
        <span className="legend-note"><Info size={15} /> Select any available Smart Bay to reserve it.</span>
      </div>

      <section className="bay-grid">
        {spaces.map((space) => <BayCard key={space.id} space={space} onSelect={choose} selected={selected?.id === space.id} />)}
      </section>

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <form className="booking-sheet" onSubmit={reserve} onMouseDown={(event) => event.stopPropagation()}>
            <div className="booking-visual">
              <span className="booking-badge"><CheckCircle2 size={17} /> Available</span>
              <span className="booking-code">{selected.code}</span>
              <p>{selected.level} · Smart Zone</p>
              <div className="bollard-illustration"><span /><i /></div>
            </div>
            <div className="booking-content">
              <span className="eyebrow">Exact bay reservation</span>
              <h2>Reserve {selected.code}</h2>
              <p>Your bollard stays raised until <strong>{data.user.vehicle_plate}</strong> is verified.</p>
              <label>Arrival time<input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
              <label>Departure time<input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
              <div className="booking-summary"><CalendarClock size={18} /><span><strong>{Math.max(0, Math.round((new Date(endTime) - new Date(startTime)) / 60000))}-minute visit</strong><small>10-minute grace period included</small></span></div>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setSelected(null)}>Cancel</button>
                <button className="primary-button" disabled={submitting}><Clock3 size={17} /> {submitting ? "Reserving…" : "Confirm reservation"}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

