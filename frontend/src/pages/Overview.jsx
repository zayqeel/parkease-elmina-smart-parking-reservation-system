import {
  ArrowRight,
  BellRing,
  CarFront,
  CheckCircle2,
  CircleParking,
  Clock3,
  LifeBuoy,
  MapPin,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { MetricCard, PageHeader, StatusPill } from "../components/UI";

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

export default function Overview({ data, admin, onNavigate, now }) {
  const spaces = data.spaces || [];
  const general = spaces.filter((space) => space.zone === "GENERAL");
  const smart = spaces.filter((space) => space.zone === "SMART");
  const available = spaces.filter((space) => space.status === "AVAILABLE").length;
  const active = data.reservations?.find(
    (item) => item.user_id === 1 && item.status === "CHECKED_IN",
  );
  const end = active ? new Date(`${active.end_time}${active.end_time.endsWith("Z") ? "" : "Z"}`) : null;
  const remaining = end ? Math.floor((end - now) / 1000) : 0;
  const timer = `${remaining < 0 ? "+" : ""}${String(Math.floor(Math.abs(remaining) / 60)).padStart(2, "0")}:${String(Math.abs(remaining) % 60).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        eyebrow={now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
        title={`Good afternoon, ${data.user?.name?.split(" ")[0] || "driver"}.`}
        description="Here’s what’s happening across ElminaPark right now."
        action={<button className="primary-button" onClick={() => onNavigate("parking")}><CircleParking size={18} /> Find a bay</button>}
      />

      <section className="metric-grid">
        <MetricCard label="Available now" value={available} note={`of ${spaces.length} total bays`} icon={CircleParking} />
        <MetricCard label="Smart bays" value={smart.filter((s) => s.status === "AVAILABLE").length} note="bollard protected" icon={ShieldCheck} tone="blue" />
        <MetricCard label="Live occupancy" value={`${admin?.metrics?.occupancy_rate ?? 0}%`} note="sensor confirmed" icon={CarFront} tone="amber" />
        <MetricCard label="Open reports" value={admin?.metrics?.open_reports ?? 0} note="Safety Hub" icon={LifeBuoy} tone="rose" />
      </section>

      <section className="overview-grid">
        <article className="session-hero">
          <div className="session-glow" />
          <div className="session-heading">
            <span className="live-badge"><span /> Live session</span>
            <StatusPill value={active?.overstay_stage || "ON_TIME"} />
          </div>
          {active ? (
            <>
              <div className="session-place">
                <span className="big-parking-p">P</span>
                <div>
                  <small>Your Smart Bay</small>
                  <h2>{active.space.code}</h2>
                  <p><MapPin size={15} /> {active.space.level} · Smart Zone</p>
                </div>
              </div>
              <div className="timer-block">
                <small>{remaining >= 0 ? "Time remaining" : "Overstay duration"}</small>
                <strong>{timer}</strong>
                <span>Booked until {end?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <button className="hero-link" onClick={() => onNavigate("session")}>Manage session <ArrowRight size={17} /></button>
            </>
          ) : (
            <div className="no-session"><CheckCircle2 /> No active parking session</div>
          )}
        </article>

        <article className="panel availability-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Live capacity</span><h2>Parking availability</h2></div>
            <button className="text-button" onClick={() => onNavigate("parking")}>View map <ArrowRight size={16} /></button>
          </div>
          <ZoneRow label="General Zone" caption="First come, first served" spaces={general} color="var(--mint)" />
          <ZoneRow label="Smart Zone" caption="Exact bay reservation" spaces={smart} color="var(--sky)" />
          <div className="availability-note"><BellRing size={17} /> Availability refreshes after every simulated sensor event.</div>
        </article>
      </section>

      <section className="panel how-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">One seamless journey</span><h2>Reserve. Verify. Park.</h2></div>
        </div>
        <div className="journey-steps">
          <JourneyStep number="01" icon={CircleParking} title="Choose your bay" body="Reserve an exact Smart Bay before you arrive." />
          <JourneyStep number="02" icon={ScanLine} title="Verify your plate" body="ANPR checks your registered vehicle at entry." />
          <JourneyStep number="03" icon={CarFront} title="Bollard lowers" body="Access unlocks only for the authorised booking." />
          <JourneyStep number="04" icon={Clock3} title="Park with confidence" body="Live occupancy and fair-use timing protect every user." />
        </div>
      </section>
    </>
  );
}

function ZoneRow({ label, caption, spaces, color }) {
  const free = spaces.filter((space) => space.status === "AVAILABLE").length;
  return (
    <div className="zone-row">
      <div><strong>{label}</strong><span>{caption}</span></div>
      <div className="capacity"><strong>{free}</strong><span> / {spaces.length} free</span></div>
      <div className="progress-track"><span style={{ width: `${percent(free, spaces.length)}%`, background: color }} /></div>
    </div>
  );
}

function JourneyStep({ number, icon: Icon, title, body }) {
  return (
    <div className="journey-step">
      <span className="step-number">{number}</span>
      <span className="step-icon"><Icon size={20} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

