import { useState } from 'react';
import axios from 'axios';
import { baseURL } from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@ec.com');
  const [password, setPassword] = useState('admin123');
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const copyInstructions = async () => {
    await navigator.clipboard.writeText('1. Open Telegram\n2. Search for @userinfobot\n3. Send /start\n4. Copy your Chat ID and paste it here');
    setMessage('Chat ID instructions copied to your clipboard.');
  };
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const { data } = await axios.post(`${baseURL}/login`, { email, password, chat_id: chatId });
      localStorage.setItem('auth_token', data.token); onLogin();
    } catch (err) { setMessage(err.response?.data?.error || 'Unable to sign in.'); }
    finally { setLoading(false); }
  };
  return <main className="min-h-screen bg-slate-900 text-white grid place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
    <div><h1 className="text-2xl font-bold text-orange-500">Electrolyte Bot</h1><p className="mt-1 text-sm text-slate-400">Sign in to the administrator dashboard.</p></div>
    <label className="block text-sm">Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 ring-orange-500" /></label>
    <label className="block text-sm">Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 ring-orange-500" /></label>
    <label className="block text-sm">Telegram Chat ID <span className="text-slate-400">(optional)</span><input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 ring-orange-500" /></label>
    <button type="button" onClick={copyInstructions} className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600">📋 Get Chat ID from Telegram</button>
    {message && <p className={`text-sm ${message.includes('copied') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
    <button disabled={loading} className="w-full rounded-lg bg-orange-500 px-4 py-2 font-medium hover:bg-orange-600 disabled:opacity-60">{loading ? 'Logging in…' : 'Login'}</button>
    <a className="block text-center text-xs text-orange-400 hover:underline" href="https://t.me/userinfobot" target="_blank" rel="noreferrer">Open @userinfobot</a>
  </form></main>;
}
