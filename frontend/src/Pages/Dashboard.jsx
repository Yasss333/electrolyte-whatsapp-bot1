import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <p className="text-slate-400">Loading...</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Messages Sent", value: stats.totalSent, color: "text-orange-400" },
          { label: "Replies Received", value: stats.replies.length, color: "text-green-400" },
          { label: "Recent Activity", value: stats.recentMessages.length, color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm">{s.label}</p>
            <p className={`text-4xl font-bold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Replies Feed */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Technician Replies</h2>
        {stats.replies.length === 0 ? (
          <p className="text-slate-500 text-sm">No replies yet</p>
        ) : (
          <div className="space-y-3">
            {stats.replies.map((r, i) => (
              <div key={i} className="flex justify-between items-start border-b border-slate-700 pb-3">
                <div>
                  <p className="text-sm font-medium">{r.phone}</p>
                  <p className="text-slate-400 text-sm">{r.reply_text}</p>
                </div>
                <p className="text-slate-500 text-xs">{new Date(r.received_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Messages */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Messages Sent</h2>
        <div className="space-y-3">
          {stats.recentMessages.map((m, i) => (
            <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <p className="text-sm font-medium">{m.technician_name}</p>
                <p className="text-slate-400 text-xs">Case #{m.case_number} • {m.phone}</p>
              </div>
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">{m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}