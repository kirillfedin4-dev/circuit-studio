const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:1234`;

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

export interface ApiUser { id: string; email: string; }
export interface ApiCircuitMeta {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}
export interface ApiCircuit extends ApiCircuitMeta {
  data: { components: any[]; wires: any[] };
  user_id: string;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...(opts.headers as any) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  register: (email: string, password: string) =>
    req<{ token: string; user: ApiUser }>('/api/register', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    req<{ token: string; user: ApiUser }>('/api/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => req<{ user: ApiUser }>('/api/me'),

  listMy: () => req<ApiCircuitMeta[]>('/api/circuits'),
  listPublic: () => req<ApiCircuitMeta[]>('/api/circuits/public'),
  getCircuit: (id: string) => req<ApiCircuit>(`/api/circuits/${id}`),
  createCircuit: (name: string, data: any, is_public: boolean) =>
    req<ApiCircuitMeta>('/api/circuits', {
      method: 'POST', body: JSON.stringify({ name, data, is_public }),
    }),
  updateCircuit: (id: string, patch: any) =>
    req<{ ok: boolean }>(`/api/circuits/${id}`, {
      method: 'PUT', body: JSON.stringify(patch),
    }),
  deleteCircuit: (id: string) =>
    req<{ ok: boolean }>(`/api/circuits/${id}`, { method: 'DELETE' }),
};

export const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:1234`;