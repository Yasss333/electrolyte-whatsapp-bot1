import axios from 'axios';

const configuredUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
const baseURL = configuredUrl.replace(/\/$/, '').replace(/\/api$/i, '') + '/api';
const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { baseURL };
export default api;
