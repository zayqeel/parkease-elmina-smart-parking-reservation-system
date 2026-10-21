import { Activity, AlertTriangle, CarFront, CircleDollarSign, ClipboardCheck, Radio, RotateCcw } from "lucide-react";
import { api } from "../api";
import { MetricCard, PageHeader, StatusPill } from "../components/UI";

export default function Admin({ admin, refresh, notify }) {
  const metrics = admin?.metrics || {};
  async function reset() {
    try {
      await api("/simulation/reset", { method: "POST" });
      notify("Demo data restored to its starting state.");
      await refresh();
    } catch (error) { notify(error.message, "error"); }
  }
  async function updateReport(id, status) {
    try {
      await api(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(`Report #${id} marked ${status.replaceAll("_", " ").toLowerCase()}.`);
      await refresh();
    } catch (error) { notify(error.message, "error"); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operations control"
        title="A clear view of every bay and incident."
        description="Monitor live occupancy, enforcement, safety reports and simulated hardware events."
        action={<button className="secondary-button" onClick={reset}><RotateCcw size={17} /> Reset demo</button>}
      />
      <section className="metric-grid admin-metrics">
        <MetricCard label="Occupancy" value={`${metrics.occupancy_rate || 0}%`} note={`${metrics.occupied || 0} bays occupied`} icon={CarFront} />
        <MetricCard label="Active bookings" value={metrics.active_reservations || 0} note="upcoming + checked in" icon={ClipboardCheck} tone="blue" />
        <MetricCard label="Open incidents" value={metrics.open_reports || 0} note="awaiting resolution" icon={AlertTriangle} tone="rose" />
        <MetricCard label="Demo penalties" value={`RM ${Number(metrics.penalties_collected || 0).toFixed(0)}`} note="current sessions" icon={CircleDollarSign} tone="amber" />
      </section>
      <section className="admin-grid">
        <article className="panel admin-table-card">
          <div className="panel-heading"><div><span className="eyebrow">Exceptions</span><h2>Overstay enforcement</h2></div><Activity size={20} /></div>
          <div className="table-wrap"><table><thead><tr><th>Bay</th><th>Plate</th><th>Stage</th><th>Over</th><th>Penalty</th></tr></thead><tbody>
            {admin?.enforcement?.length ? admin.enforcement.map((item) => <tr key={item.id}><td><strong>{item.space.code}</strong></td><td>{item.vehicle_plate}</td><td><StatusPill value={item.overstay_stage} /></td><td>{item.overstay_minutes} min</td><td>RM {Number(item.penalty_amount).toFixed(2)}</td></tr>) : <tr><td colSpan="5" className="empty-cell">No enforcement cases. The car park is running smoothly.</td></tr>}
          </tbody></table></div>
        </article>
        <article className="panel event-feed">
          <div className="panel-heading"><div><span className="eyebrow">Sensors & hardware</span><h2>Live event feed</h2></div><Radio size={20} /></div>
          <div className="events">{(admin?.events || []).slice(0, 8).map((event) => <div className="event-item" key={event.id}><span className="event-pulse" /><div><strong>{event.event_type.replaceAll("_", " ")}</strong><p>{event.space.code} · {event.detail}</p></div><small>{new Date(`${event.timestamp}Z`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div>
        </article>
      </section>
      <section className="panel incident-table">
        <div className="panel-heading"><div><span className="eyebrow">Safety Hub</span><h2>Incident management</h2></div></div>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>Category</th><th>Location</th><th>Description</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {(admin?.reports || []).map((report) => <tr key={report.id}><td>#{report.id}</td><td><strong>{report.category}</strong></td><td>{report.location}</td><td className="description-cell">{report.description}</td><td><StatusPill value={report.status} /></td><td><select value={report.status} onChange={(event) => updateReport(report.id, event.target.value)}><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option></select></td></tr>)}
        </tbody></table></div>
      </section>
    </>
  );
}

