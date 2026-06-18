import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { useAppContext } from "../context/AppContext";

const API = "http://localhost:5000/api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const { refreshTrigger, triggerRefresh } = useAppContext();

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Stats fetch error", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const resetDashboard = async () => {
    if (!confirm("Clear all pending tasks and reset dashboard?")) return;
    await axios.delete(`${API}/tasks`);
    setStats(null); // show loading
    triggerRefresh(); // this will trigger re-fetch
  };

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#ef4444'];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-orange-500">Dashboard</h1>
        <button
          onClick={resetDashboard}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          🔄 Reset Dashboard
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Messages Sent", value: stats.totalSent, color: "text-orange-400" },
          { label: "Pending Tasks", value: stats.totalPending, color: "text-red-400" },
          { label: "Resolved Total", value: stats.totalResolved, color: "text-green-400" },
          { label: "Resolved Today", value: stats.resolvedToday, color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <p className="text-slate-400 text-xs">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Message Volume */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Message Volume (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.dailyVolume}>
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
              <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Technician Leaderboard */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Pending Tasks per Technician</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.techStats.slice(0, 8)}>
              <XAxis dataKey="technician_name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
              <Bar dataKey="pending" radius={[4, 4, 0, 0]}>
                {stats.techStats.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reply Classification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.replyClassification.map((r) => (
          <div key={r.classification} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <p className="text-slate-400 text-xs capitalize">{r.classification} Replies</p>
            <p className="text-2xl font-bold text-orange-400 mt-1">{r.count}</p>
          </div>
        ))}
      </div>

      {/* Technician Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Technician Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className="pb-2">Technician</th>
                <th className="pb-2">Pending</th>
                <th className="pb-2">Completed</th>
                <th className="pb-2">Avg Days Pending</th>
              </tr>
            </thead>
            <tbody>
              {stats.techStats.map((t, i) => (
                <tr key={i} className="border-b border-slate-700/50">
                  <td className="py-2">{t.technician_name}</td>
                  <td className="py-2 text-red-400">{t.pending}</td>
                  <td className="py-2 text-green-400">{t.completed}</td>
                  <td className="py-2 text-orange-400">{Math.round(t.avg_days_pending || 0)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replies Feed */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Recent Replies</h2>
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
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    r.classification === 'completed' ? 'bg-green-500/20 text-green-400' :
                    r.classification === 'delayed' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {r.classification}
                  </span>
                  <p className="text-slate-500 text-xs mt-1">{new Date(r.received_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Escalations */}
      {stats.escalations.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-red-900 p-5">
          <h2 className="text-sm font-semibold text-red-400 mb-4">⚠️ Escalations</h2>
          <div className="space-y-3">
            {stats.escalations.map((e, i) => (
              <div key={i} className="flex justify-between border-b border-slate-700 pb-3">
                <div>
                  <p className="text-sm font-medium">Case #{e.case_number}</p>
                  <p className="text-slate-400 text-xs">{e.technician_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 text-sm">{e.days_pending} days overdue</p>
                  <p className="text-slate-500 text-xs">{new Date(e.escalated_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}