import { Camera, CheckCircle2, Clock3, LifeBuoy, MapPin, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { PageHeader, StatusPill } from "../components/UI";

export default function Safety({ data, refresh, notify }) {
  const [form, setForm] = useState({ category: "Lighting", location: "", description: "", image_path: "" });
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/reports", { method: "POST", body: JSON.stringify({ user_id: 1, ...form, image_path: form.image_path || null }) });
      setForm({ category: "Lighting", location: "", description: "", image_path: "" });
      notify("Incident submitted to the Safety Hub.");
      await refresh();
    } catch (error) { notify(error.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader eyebrow="Community safety" title="See something? Send it straight to the right team." description="Report parking hazards, damaged equipment or personal-safety concerns with clear location context." />
      <section className="safety-layout">
        <form className="panel report-form" onSubmit={submit}>
          <div className="card-title"><span className="icon-tile rose"><LifeBuoy size={21} /></span><div><h2>New incident report</h2><p>Takes less than a minute.</p></div></div>
          <div className="two-fields">
            <label>Category<select value={form.category} onChange={update("category")}><option>Lighting</option><option>Obstruction</option><option>Suspicious activity</option><option>Damaged equipment</option><option>Accessibility</option><option>Other</option></select></label>
            <label>Location<input value={form.location} onChange={update("location")} placeholder="e.g. Smart Bay S-04" required /></label>
          </div>
          <label>Description<textarea value={form.description} onChange={update("description")} placeholder="Tell the response team what you observed…" rows="5" required /></label>
          <label>Photo URL <small>(optional for demo)</small><div className="input-with-icon"><Camera size={17} /><input value={form.image_path} onChange={update("image_path")} placeholder="https://…" /></div></label>
          <button className="primary-button wide" disabled={busy}><Send size={17} /> {busy ? "Submitting…" : "Submit incident"}</button>
          <p className="emergency-note"><ShieldCheck size={16} /> For immediate danger, contact emergency services first.</p>
        </form>

        <div className="report-list-wrap">
          <div className="panel-heading"><div><span className="eyebrow">Live queue</span><h2>Recent reports</h2></div><span className="report-count">{data.reports?.length || 0}</span></div>
          <div className="report-list">
            {(data.reports || []).map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-card-top"><span className="report-category">{report.category}</span><StatusPill value={report.status} /></div>
                <h3>{report.description}</h3>
                <div className="report-meta"><span><MapPin size={14} /> {report.location}</span><span><Clock3 size={14} /> {new Date(`${report.created_at}Z`).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

