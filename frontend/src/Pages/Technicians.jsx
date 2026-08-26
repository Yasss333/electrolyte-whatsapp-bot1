import { useState, useEffect } from "react";
import axios from "../api";

const _envUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
const baseURL = _envUrl.replace(/\/$/, '').replace(/\/api$/i, '');
const API = baseURL + "/api";

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [name, setName] = useState("");
  const [chatId, setChatId] = useState("");
  const [msg, setMsg] = useState("");
  const [bulkFile, setBulkFile] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const res = await axios.get(`${API}/technicians`);
    setTechnicians(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name || !chatId) return;
    await axios.post(`${API}/technicians`, { name, chat_id: chatId });
    setMsg(`✅ Saved ${name}`);
    setName(""); setChatId("");
    load();
  };

  const handleUpdate = async (id) => {
    const tech = technicians.find(t => t.id === id);
    if (!tech) return;
    const newName = prompt("Update name:", tech.name);
    const newChatId = prompt("Update Telegram chat ID:", tech.chat_id);
    if (newName && newChatId) {
      await axios.put(`${API}/technicians/${id}`, { name: newName, chat_id: newChatId });
      setMsg(`✅ Updated ${newName}`);
      load();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this technician?")) return;
    await axios.delete(`${API}/technicians/${id}`);
    setMsg("🗑️ Technician deleted");
    load();
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    const form = new FormData();
    form.append("csv", bulkFile);
    const res = await axios.post(`${API}/upload-chat-ids`, form);
    setMsg(`✅ Imported ${res.data.imported} technicians`);
    setBulkFile(null);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">Technician Telegram Chat IDs</h1>

      {/* Bulk Upload */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Bulk Import via CSV</h2>
        <p className="text-slate-500 text-xs">CSV format: <code className="text-orange-400">Name, Chat ID</code>. Each technician must first start a chat with your bot.</p>
        <div className="flex gap-3">
          <input
            type="file" accept=".csv"
            onChange={(e) => setBulkFile(e.target.files[0])}
            className="text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-orange-500 file:text-white"
          />
          <button onClick={handleBulkUpload} className="bg-orange-500 hover:bg-orange-600 px-4 py-1 rounded text-sm font-medium">
            Import
          </button>
        </div>
      </div>

      {/* Single Add */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Add / Update Single Technician</h2>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Technician Name"
          className="w-full bg-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-orange-500"
        />
        <input
          value={chatId} onChange={(e) => setChatId(e.target.value)}
          placeholder="Telegram chat ID (for example: 123456789)"
          className="w-full bg-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-orange-500"
        />
        <button onClick={handleAdd} className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-lg text-sm font-medium">
          Save
        </button>
      </div>

      {msg && <p className="text-green-400 text-sm">{msg}</p>}

      {/* List with Edit/Delete */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Saved Technicians ({technicians.length})</h2>
        {technicians.length === 0 ? (
          <p className="text-slate-500 text-sm">No technicians added yet</p>
        ) : (
          <div className="space-y-3">
            {technicians.map((t) => (
              <div key={t.id} className="flex justify-between items-center border-b border-slate-700 pb-3">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-slate-400 text-sm">Chat ID: {t.chat_id || 'Not set'}</p>
                </div>
                <div className="flex gap-2">
                  {/* <button onClick={() => handleUpdate(t.id)} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs">
                    ✏️ Edit
                  </button> */}
                  <button onClick={() => handleDelete(t.id)} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
