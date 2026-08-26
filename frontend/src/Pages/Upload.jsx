import { useState, useEffect } from "react";
import axios from "../api";
import { useAppContext } from "../context/AppContext";

const _envUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
const baseURL = _envUrl.replace(/\/$/, '').replace(/\/api$/i, '');
const API = baseURL + "/api";
export default function Upload() {
  const { tasks, setTasks, technicians, setTechnicians, triggerRefresh } = useAppContext();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [parsedTarget, setParsedTarget] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Fetch technicians once on mount
  useEffect(() => {
    const fetchTechs = async () => {
      try {
        const res = await axios.get(`${API}/technicians`);
        setTechnicians(res.data);
      } catch (err) {
        console.error("Failed to fetch technicians", err);
      }
    };
    fetchTechs();
    axios.get(`${API}/send-jobs/active`).then(({ data }) => {
      if (data && (data.status === "queued" || data.status === "running")) {
        setSending(true);
      }
    }).catch(() => {});
  }, [setTechnicians]);

  useEffect(() => {
    if (parsedCount >= parsedTarget) return undefined;
    const interval = window.setInterval(() => {
      setParsedCount((count) => Math.min(count + Math.max(1, Math.ceil((parsedTarget - count) / 8)), parsedTarget));
    }, 80);
    return () => window.clearInterval(interval);
  }, [parsedCount, parsedTarget]);

  const waitForSendJob = async (jobId) => {
    const { data } = await axios.get(`${API}/send-jobs/active`);
    if (!data || data.id !== jobId || data.status === "queued" || data.status === "running") {
      window.setTimeout(() => waitForSendJob(jobId).catch(() => setSending(false)), 3000);
      return;
    }
    setSending(false);
    if (data.status === "failed") {
      setStatus(`❌ Bulk send failed: ${data.error}`);
      return;
    }
    const skippedNames = data.skippedTechnicians?.slice(0, 5) || [];
    const missingText = skippedNames.length
      ? ` Add contacts for: ${skippedNames.join(", ")}${data.skippedTechnicians.length > 5 ? " and others" : ""}.`
      : "";
    setStatus(`✅ Sent ${data.sent} reminder(s). ${data.skipped || 0} skipped.${missingText}`);
    triggerRefresh();
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus("⚠️ Choose a CSV file before loading tasks.");
      return;
    }

    setStatus("Uploading and parsing CSV...");
    setParsing(true);
    setParsedCount(0);
    setParsedTarget(0);
    const form = new FormData();
    form.append("csv", file);

    try {
      const uploadRes = await axios.post(`${API}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const taskRes = await axios.get(`${API}/tasks`);
      setTasks(taskRes.data || []);
      setParsedTarget(uploadRes.data.pendingCount ?? taskRes.data.length);
      setParsing(false);
      setStatus(`✅ ${uploadRes.data.pendingCount ?? taskRes.data.length} pending task(s) loaded`);
      triggerRefresh();
    } catch (err) {
      setParsing(false);
      const message = err.response?.data?.error || err.message || "Upload failed";
      setStatus(`❌ ${message}`);
    }
  };

  const handleBulkSend = async () => {
    if (tasks.length === 0) {
      setStatus("⚠️ No tasks to send. Load a CSV first.");
      return;
    }
    const hasChatId = technicians.some(t => t.chat_id && t.chat_id.trim() !== "");
    if (!hasChatId) {
      setStatus("❌ No technician has a Telegram chat ID. Add chat IDs in the Technicians tab.");
      return;
      return;
    }
    setSending(true);
    try {
      const res = await axios.post(`${API}/send`);
      setStatus("Bulk send started. You can refresh this page safely; progress is saved.");
      waitForSendJob(res.data.jobId);
    } catch (err) {
      setStatus("❌ Error starting reminders: " + (err.response?.data?.error || err.message));
      setSending(false);
    }
  };

  const clearTasks = async () => {
    if (!confirm("Delete all pending tasks? This cannot be undone.")) return;
    await axios.delete(`${API}/tasks`);
    setTasks([]);
    setStatus("🧹 All pending tasks cleared");
    triggerRefresh();
  };

  const hasChatId = technicians.some(t => t.chat_id && t.chat_id.trim() !== "");
// const exportTasks = async () => {
//   try {
//     const response = await axios.get(`${API}/export-tasks`, {
//       responseType: 'blob', // Important: receive as binary data
//     });

//     // Create a download link
//     const url = window.URL.createObjectURL(new Blob([response.data]));
//     const link = document.createElement('a');
//     link.href = url;
//     // Extract filename from Content-Disposition header if available
//     const contentDisposition = response.headers['content-disposition'];
//     let filename = 'pending_tasks.xlsx';
//     if (contentDisposition) {
//       const match = contentDisposition.match(/filename="(.+)"/);
//       if (match) filename = match[1];
//     }
//     link.setAttribute('download', filename);
//     document.body.appendChild(link);
//     link.click();
//     link.remove();
//     window.URL.revokeObjectURL(url);
//   } catch (err) {
//     setStatus('❌ Failed to export tasks: ' + err.message);
//   }
// };
const exportTasks = async () => {
  try {
    const response = await axios.get(`${API}/export-tasks`, {
      responseType: 'blob',
    });

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `pending_tasks_${today}.xlsx`;

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    setStatus('❌ Failed to export tasks: ' + err.message);
  }
};

return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">Upload & Send</h1>

      {(parsing || parsedCount < parsedTarget) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4" aria-live="polite">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-300">Parsing tasks</span>
            <span className="text-orange-400 tabular-nums">{parsedCount} loaded</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className={`h-full bg-orange-500 transition-all duration-150 ${parsing && parsedTarget === 0 ? "w-1/3 animate-pulse" : ""}`} style={parsedTarget ? { width: `${Math.round((parsedCount / parsedTarget) * 100)}%` } : undefined} />
          </div>
        </div>
      )}

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

      {/* <div className="flex gap-4 flex-wrap">
        <button onClick={handleUpload} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-lg font-medium">
          Load Tasks
        </button>
        <button
          onClick={handleBulkSend}
          disabled={sending || tasks.length === 0 || !hasPhone}
          className={`bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2 rounded-lg font-medium`}
        >
          {sending ? "Sending..." : ` Bulk Send (${tasks.length})`}
        </button>
        <button
          onClick={clearTasks}
          className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-medium"
        >
          🗑️ Clear Tasks
        </button>
      </div> */}
      <div className="flex gap-4 flex-wrap">
  <button onClick={handleUpload} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-lg font-medium">
    Load Tasks
  </button>
  <button
    onClick={handleBulkSend}
    disabled={sending || tasks.length === 0 || !hasChatId}
    className={`bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2 rounded-lg font-medium`}
  >
    {sending ? "Sending..." : ` Bulk Send (${tasks.length})`}
  </button>
  <button
    onClick={clearTasks}
    className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-medium"
  >
    🗑️ Clear Tasks
  </button>
  <button
    onClick={exportTasks}
    disabled={tasks.length === 0}
    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-2 rounded-lg font-medium"
  >
    📥 Export Tasks
  </button>
</div>

      {status && <p className={`text-sm ${status.includes("❌") ? "text-red-400" : "text-green-400"}`}>{status}</p>}

      {tasks.length > 0 && !hasChatId && (
        <p className="text-yellow-400 text-sm">⚠️ No technician has a Telegram chat ID. Add chat IDs in the Technicians tab to send reminders.</p>
      )}

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
                  <td className="px-4 py-3 text-orange-400">{t.case_number}</td>
                  <td className="px-4 py-3">{t.technician_name}</td>
                  <td className="px-4 py-3">{t.customer_name}</td>
                  <td className="px-4 py-3">{t.city}</td>
                  <td className="px-4 py-3">{t.complaint}</td>
                  <td className="px-4 py-3">
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                      {t.line_item_status || t.wo_status}
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
