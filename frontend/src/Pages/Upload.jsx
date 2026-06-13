import { useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("csv", file);
    await axios.post(`${API}/upload`, form);
    const res = await axios.get(`${API}/tasks`);
    setTasks(res.data);
    setStatus(`${res.data.length} pending tasks loaded`);
  };

  const handleBulkSend = async () => {
    setSending(true);
    const res = await axios.post(`${API}/send`);
    setStatus(`✅ Sent ${res.data.sent} reminders`);
    setSending(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">Upload & Send</h1>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); setFile(e.dataTransfer.files[0]); }}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          dragOver ? "border-orange-500 bg-orange-500/10" : "border-slate-600 hover:border-orange-400"
        }`}
      >
        <p className="text-slate-400 mb-3">Drag & drop CSV here or</p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} className="hidden" id="fileInput" />
        <label htmlFor="fileInput" className="cursor-pointer bg-orange-500 px-4 py-2 rounded-lg text-sm font-medium">
          Browse File
        </label>
        {file && <p className="mt-3 text-green-400 text-sm">{file.name} selected</p>}
      </div>

      <div className="flex gap-4">
        <button onClick={handleUpload} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-lg font-medium">
          Load Tasks
        </button>
        <button
          onClick={handleBulkSend}
          disabled={sending || tasks.length === 0}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2 rounded-lg font-medium"
        >
          {sending ? "Sending..." : `🚀 Bulk Send (${tasks.length})`}
        </button>
      </div>

      {status && <p className="text-green-400 text-sm">{status}</p>}

      {/* Tasks Table */}
      {tasks.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                {["Case #", "Technician", "Customer", "City", "Complaint", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={i} className="border-t border-slate-700 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-orange-400">{t.caseNumber}</td>
                  <td className="px-4 py-3">{t.technicianName}</td>
                  <td className="px-4 py-3">{t.customerName}</td>
                  <td className="px-4 py-3">{t.city}</td>
                  <td className="px-4 py-3">{t.complaint}</td>
                  <td className="px-4 py-3">
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                      {t.lineItemStatus || t.woStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}