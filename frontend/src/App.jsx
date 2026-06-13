import { useState } from "react";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import Technicians from "./pages/Technicians";

export default function App() {
  const [tab, setTab] = useState("upload");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 px-8 py-4 flex gap-6 items-center border-b border-slate-700">
        <span className="text-orange-500 font-bold text-xl">⚡ Electrolyte Bot</span>
        {["upload", "dashboard", "technicians"].map((t) => (
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
        {tab === "upload" && <Upload />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "technicians" && <Technicians />}
      </main>
    </div>
  );
} 