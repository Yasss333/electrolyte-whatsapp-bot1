import { useEffect, useState } from "react";
import axios from "../api";

const _envUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
const API = _envUrl.replace(/\/$/, '').replace(/\/api$/i, '') + "/api";

export default function Setup() {
  const [bot, setBot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`${API}/health`);
        setBot(data);
        setError(null);
      } catch {
        setError("Unable to reach the backend right now.");
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const connected = Boolean(bot?.connected);
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold text-orange-500">Telegram Bot Setup</h1>
      <div className={`border rounded-xl p-8 ${connected ? "bg-green-500/20 border-green-500" : "bg-slate-800 border-slate-700"}`}>
        <p className="text-4xl mb-2">{connected ? "✅" : "⚠️"}</p>
        <p className={`font-semibold text-lg ${connected ? "text-green-400" : "text-orange-400"}`}>{connected ? "Telegram Bot Connected" : "Telegram Bot Not Ready"}</p>
        {connected && bot.botUsername && <p className="text-slate-300 text-sm mt-2">@{bot.botUsername}</p>}
        <p className="text-slate-400 text-sm mt-3">{error || bot?.error || "Bot is active and ready to send messages."}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-left text-sm text-slate-300 space-y-2">
        <p>1. Create a bot with Telegram’s <span className="text-orange-400">@BotFather</span>.</p>
        <p>2. Set its token as <code className="text-orange-400">TELEGRAM_BOT_TOKEN</code> in the backend environment.</p>
        <p>3. Have each technician start a chat with the bot, then save their chat ID in the Technicians tab.</p>
      </div>
    </div>
  );
}
