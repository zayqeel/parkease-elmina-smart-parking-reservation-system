import { Menu, RefreshCw, Wifi, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import { Toast } from "./components/UI";
import Access from "./pages/Access";
import Admin from "./pages/Admin";
import Overview from "./pages/Overview";
import Parking from "./pages/Parking";
import Safety from "./pages/Safety";
import Session from "./pages/Session";

const pageLabels = {
  overview: "Overview",
  parking: "Find parking",
  access: "Vehicle & access",
  session: "Parking session",
  safety: "Safety Hub",
  admin: "Admin dashboard",
};

export default function App() {
  const [page, setPage] = useState("overview");
  const [data, setData] = useState({ spaces: [], reservations: [], reports: [] });
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const [bootstrap, dashboard] = await Promise.all([api("/bootstrap"), api("/admin/dashboard")]);
      setData(bootstrap);
      setAdmin(dashboard);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message, type = "success") => setToast({ message, type, id: Date.now() });
  const navigate = (next) => { setPage(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (loading) {
    return <div className="loading-screen"><span className="loading-logo">P</span><strong>Preparing ElminaPark</strong><p>Connecting parking sensors…</p></div>;
  }
  if (error && !data.user) {
    return <div className="error-screen"><span>Connection unavailable</span><h1>Start the FastAPI server first.</h1><p>{error}</p><button className="primary-button" onClick={refresh}><RefreshCw size={17} /> Try again</button></div>;
  }

  const props = { data, admin, refresh, notify, now, onNavigate: navigate };
  return (
    <div className="app-shell">
      <div className={`mobile-drawer ${mobileNav ? "open" : ""}`}><Sidebar page={page} onNavigate={navigate} user={data.user} /></div>
      {mobileNav && <button className="drawer-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <Sidebar page={page} onNavigate={navigate} user={data.user} />
      <main className="main-area">
        <div className="mobile-topbar"><button onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button><strong>{pageLabels[page]}</strong><span className="online-dot" /></div>
        <div className="desktop-status"><span><Wifi size={15} /> Live system</span><span>Demo environment</span></div>
        <div className="page-content">
          {page === "overview" && <Overview {...props} />}
          {page === "parking" && <Parking {...props} />}
          {page === "access" && <Access {...props} />}
          {page === "session" && <Session {...props} />}
          {page === "safety" && <Safety {...props} />}
          {page === "admin" && <Admin {...props} />}
        </div>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

