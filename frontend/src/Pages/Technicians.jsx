import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await axios.get(`${API}/technicians`);
    setTechnicians(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name || !phone) return;
    await axios.post(`${API}/technicians`, { name, phone });
    setMsg(`Saved ${name}`);
    setName(""); setPhone("");
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">Technician Phone Numbers</h1>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Technician Name (must match CSV exactly)"
          className="w-full bg-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-orange-500"
        />
        <input
          value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number (10 digits, no +91)"
          className="w-full bg-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-orange-500"
        />
        <button onClick={handleAdd} className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-lg text-sm font-medium">
          Save Technician
        </button>
        {msg && <p className="text-green-400 text-sm">{msg}</p>}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Saved Technicians ({technicians.length})</h2>
        {technicians.length === 0 ? (
          <p className="text-slate-500 text-sm">No technicians added yet</p>
        ) : (
          <div className="space-y-3">
            {technicians.map((t) => (
              <div key={t.id} className="flex justify-between border-b border-slate-700 pb-3">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-slate-400 text-sm">{t.phone}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}