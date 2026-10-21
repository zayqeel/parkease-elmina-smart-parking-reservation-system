import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export function StatusPill({ value }) {
  const normalized = (value || "UNKNOWN").toLowerCase();
  return <span className={`status-pill status-${normalized}`}>{value?.replaceAll("_", " ")}</span>;
}

export function MetricCard({ label, value, note, icon: Icon, tone = "green" }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon tone-${tone}`}><Icon size={20} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </article>
  );
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = toast.type === "error" ? AlertCircle : toast.type === "info" ? Info : CheckCircle2;
  return (
    <div className={`toast toast-${toast.type || "success"}`} role="status">
      <Icon size={20} />
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="Close notification"><X size={17} /></button>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="empty-state">
      <span><Icon size={26} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

