import {
  CarFront,
  CircleParking,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "parking", label: "Find parking", icon: CircleParking },
  { id: "access", label: "Vehicle & access", icon: ScanLine },
  { id: "session", label: "Parking session", icon: Gauge },
  { id: "safety", label: "Safety Hub", icon: LifeBuoy },
  { id: "admin", label: "Admin dashboard", icon: ShieldCheck },
];

export default function Sidebar({ page, onNavigate, user }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate("overview")}>
        <span className="brand-mark"><CarFront size={20} strokeWidth={2.4} /></span>
        <span>
          <strong>ElminaPark</strong>
          <small>Smart township mobility</small>
        </span>
      </button>

      <nav aria-label="Main navigation">
        <span className="nav-eyebrow">Workspace</span>
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? "active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === "safety" && <span className="nav-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-card">
        <Sparkles size={18} />
        <strong>Hackathon demo</strong>
        <p>All hardware and camera signals are simulated safely.</p>
      </div>

      <div className="profile-chip">
        <span className="avatar">{user?.name?.split(" ").map((part) => part[0]).join("") || "AR"}</span>
        <span>
          <strong>{user?.name || "Loading…"}</strong>
          <small>{user?.vehicle_plate || "No vehicle"}</small>
        </span>
        <LogOut size={17} />
      </div>
    </aside>
  );
}

