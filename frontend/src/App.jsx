import { useState } from "react";
import Upload from "./Pages/Upload.jsx";
import Dashboard from "./Pages/Dashboard.jsx";
import Technicians from "./Pages/Technicians.jsx";
import Setup from "./Pages/Setup.jsx";

export default function App() {
  const [tab, setTab] = useState("setup");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 px-8 py-4 flex gap-6 items-center border-b border-slate-700">
        <span className="text-orange-500 font-bold text-xl">Electrolyte Bot</span>
        {["setup", "upload", "dashboard", "technicians"].map((t) => (
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
      </nav>
      <main className="p-8">
        <div className={tab === "setup" ? "" : "hidden"}><Setup /></div>
        <div className={tab === "upload" ? "" : "hidden"}><Upload /></div>
        <div className={tab === "dashboard" ? "" : "hidden"}><Dashboard /></div>
        <div className={tab === "technicians" ? "" : "hidden"}><Technicians /></div>
      </main>
    </div>
  );
}