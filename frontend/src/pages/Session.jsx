import { AlertTriangle, ArrowRight, BellRing, CarFront, CircleDollarSign, Clock3, Route, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { EmptyState, PageHeader, StatusPill } from "../components/UI";

export default function Session({ data, refresh, notify, now, onNavigate }) {
  const active = data.reservations?.find((item) => item.user_id === 1 && item.status === "CHECKED_IN");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!active) {
    return <><PageHeader eyebrow="Fair-use parking" title="Parking session" description="Your live timer and enforcement status appear here." /><EmptyState icon={CarFront} title="No active session" body="Reserve a Smart Bay and complete ANPR verification to begin." action={<button className="primary-button" onClick={() => onNavigate("parking")}>Find a Smart Bay <ArrowRight size={17} /></button>} /></>;
  }
  const end = new Date(`${active.end_time}${active.end_time.endsWith("Z") ? "" : "Z"}`);
  const diff = Math.floor((end - now) / 1000);
  const display = `${diff < 0 ? "+" : ""}${String(Math.floor(Math.abs(diff) / 60)).padStart(2, "0")}:${String(Math.abs(diff) % 60).padStart(2, "0")}`;

  async function simulate(minutes) {
    setBusy(true);
    try {
      const response = await api(`/simulation/overstay/${active.id}`, { method: "POST", body: JSON.stringify({ minutes_over: minutes }) });
      setResult(response);
      notify(response.message, minutes > 30 ? "error" : minutes > 10 ? "info" : "success");
      await refresh();
    } catch (error) { notify(error.message, "error"); }
    finally { setBusy(false); }
  }

  const steps = [
    { key: "GRACE", icon: BellRing, title: "0–10 min", body: "Grace period + driver warning" },
    { key: "PENALTY", icon: CircleDollarSign, title: "After 10 min", body: "RM10 + RM2 per overdue minute" },
    { key: "REROUTE", icon: Route, title: "Affected booking", body: "Next driver moves to a free Smart Bay" },
    { key: "ESCALATED", icon: ShieldAlert, title: "Severe overstay", body: "Security escalation status is triggered" },
  ];

  return (
    <>
      <PageHeader eyebrow="Fair-use parking" title="Your live parking session." description="The timer, grace period and enforcement actions stay transparent at every stage." />
      <section className="session-layout">
        <article className="session-timer-card">
          <div className="session-timer-top"><span className="live-badge"><span /> Sensor live</span><StatusPill value={active.overstay_stage} /></div>
          <div className="session-bay-line"><span className="big-parking-p">P</span><div><small>Smart Bay</small><strong>{active.space.code}</strong></div></div>
          <div className="giant-timer">{display}</div>
          <p>{diff >= 0 ? "remaining until your booked departure" : "past your booked departure"}</p>
          <div className="session-facts">
            <span><Clock3 size={17} /><small>Ends</small><strong>{end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></span>
            <span><CarFront size={17} /><small>Vehicle</small><strong>{active.vehicle_plate}</strong></span>
            <span><CircleDollarSign size={17} /><small>Penalty</small><strong>RM {Number(active.penalty_amount).toFixed(2)}</strong></span>
          </div>
        </article>

        <article className="panel enforcement-card">
          <div className="panel-heading"><div><span className="eyebrow">Original enforcement flow</span><h2>Fair, progressive action</h2></div></div>
          <div className="enforcement-flow">
            {steps.map(({ key, icon: Icon, title, body }, index) => {
              const activeIndex = active.overstay_stage === "ON_TIME" ? -1 : active.overstay_stage === "GRACE" ? 0 : active.overstay_stage === "PENALTY" ? 2 : 3;
              return <div className={`enforcement-step ${index <= activeIndex ? "reached" : ""}`} key={key}><span><Icon size={18} /></span><div><strong>{title}</strong><p>{body}</p></div></div>;
            })}
          </div>
          <div className="demo-controls">
            <span><AlertTriangle size={16} /> Demo controls</span>
            <div>
              <button disabled={busy} onClick={() => simulate(5)}>+5 min grace</button>
              <button disabled={busy} onClick={() => simulate(15)}>+15 min penalty</button>
              <button disabled={busy} onClick={() => simulate(35)}>+35 min escalate</button>
            </div>
          </div>
        </article>
      </section>

      {(result || active.overstay_stage !== "ON_TIME") && (
        <section className={`enforcement-result ${active.overstay_stage === "ESCALATED" ? "danger" : ""}`}>
          <AlertTriangle size={24} />
          <div><span className="eyebrow">Current enforcement state</span><h3>{(result?.stage || active.overstay_stage).replaceAll("_", " ")}</h3><p>{result?.message || `${active.overstay_minutes} minutes overdue. ${active.escalation_status.replaceAll("_", " ")}.`}</p></div>
          <div className="result-stats"><span><small>Penalty</small><strong>RM {Number(result?.penalty_amount ?? active.penalty_amount).toFixed(2)}</strong></span>{result?.rerouted && <span><small>Rerouted</small><strong>{result.rerouted.from} → {result.rerouted.to}</strong></span>}</div>
        </section>
      )}
    </>
  );
}

