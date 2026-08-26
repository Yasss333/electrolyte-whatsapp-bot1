import { useEffect, useState } from "react";
import Upload from "./Pages/Upload.jsx";
import Dashboard from "./Pages/Dashboard.jsx";
import Technicians from "./Pages/Technicians.jsx";
import Setup from "./Pages/Setup.jsx";
import ItemRequests from "./Pages/ItemRequests.jsx";
import Login from "./Pages/Login.jsx";
import api from "./api";

export default function App() {
  const [tab, setTab] = useState("setup");
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem("auth_token")));

  useEffect(() => {
    if (!authenticated && window.location.pathname !== '/login') window.history.replaceState({}, '', '/login');
  }, [authenticated]);

  if (!authenticated) return <Login onLogin={() => { window.history.replaceState({}, '', '/'); setAuthenticated(true); }} />;

  const logout = async () => {
    try { await api.post('/logout'); } catch { /* Clearing the local session is sufficient. */ }
    localStorage.removeItem('auth_token');
    window.history.replaceState({}, '', '/login');
    setAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 px-8 py-4 flex gap-6 items-center border-b border-slate-700">
        <span className="text-orange-500 font-bold text-xl">Electrolyte Bot</span>
        {["setup", "upload", "dashboard", "technicians", "item requests"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`capitalize px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
        <button onClick={logout} className="ml-auto px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white">Logout</button>
      </nav>
      <main className="p-8">
        <div className={tab === "setup" ? "" : "hidden"}><Setup /></div>
        <div className={tab === "upload" ? "" : "hidden"}><Upload /></div>
        <div className={tab === "dashboard" ? "" : "hidden"}><Dashboard /></div>
        <div className={tab === "technicians" ? "" : "hidden"}><Technicians /></div>
        <div className={tab === "item requests" ? "" : "hidden"}><ItemRequests /></div>
      </main>
    </div>
  );
}
