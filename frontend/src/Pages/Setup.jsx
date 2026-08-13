import { useEffect, useState } from "react";
import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
const API = baseURL ;
export default function Setup() {
  const [qr, setQr] = useState(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Starting WhatsApp client...");
  const [error, setError] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await axios.get(`${API}/qr`);
        setConnected(Boolean(res.data.connected));
        setQr(res.data.qr || null);
        setError(res.data.error || null);

        if (res.data.connected) {
          setStatus("WhatsApp connected and ready to send messages.");
        } else if (res.data.state === "auth_failure") {
          setStatus("Authentication failed. Please retry the WhatsApp link flow.");
        } else if (res.data.qr) {
          setStatus("Scan this QR code with WhatsApp.");
        } else {
          setStatus("Starting WhatsApp client...");
        }
      } catch (e) {
        setError("Unable to reach the backend right now.");
        setStatus("Unable to reach the backend right now.");
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

const refreshQR = async () => {
  await axios.post(`${API}/reset-session`);
  setStatus("Session reset. New QR will appear shortly...");
  setQr(null);
  setConnected(false);
  // Force re-poll
  setTimeout(() => poll(), 2000);
};

const logout = async () => {
  if (!confirm("Logout from WhatsApp? This will disconnect the bot.")) return;
  await axios.post(`${API}/logout`);
  setStatus("Logged out. Please scan QR again.");
  setQr(null);
  setConnected(false);
  setTimeout(() => poll(), 2000);
};

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">WhatsApp Setup</h1>
      <div className="flex gap-4 justify-center mt-4">
  <button
    onClick={refreshQR}
    className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm font-medium"
  >
    🔄 Refresh QR
  </button>
  <button
    onClick={logout}
    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium"
  >
    🚪 Logout
  </button>
</div>
      {connected ? (
        <div className="bg-green-500/20 border border-green-500 rounded-xl p-8">
          <p className="text-green-400 text-4xl mb-2">✅</p>
          <p className="text-green-400 font-semibold text-lg">WhatsApp Connected</p>
          <p className="text-slate-400 text-sm mt-2">Bot is active and ready to send messages</p>
        </div>
      ) : qr ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <p className="text-slate-400 text-sm">Open WhatsApp → Linked Devices → Link a Device → Scan this QR</p>
          <img src={qr} alt="QR Code" className="mx-auto rounded-lg w-64 h-64" />
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            <p className="text-orange-400 text-sm">{status}</p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 space-y-4">
          <p className="text-slate-400 text-sm">{status}</p>
          {error ? <p className="text-red-400 text-sm">{error}</p> : null}
          <div className="mt-4 w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      )}
    </div>
  );
}