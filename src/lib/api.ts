// Thin client for the MIFTAH Express API. Enabled when VITE_API_URL is set at build/dev time;
// otherwise the app keeps running fully in the browser (the published prototype).
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const remote = !!API_URL;

const TOKEN_KEY = 'miftah-token';
export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body: any) { super(message); }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const t = token.get();
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? res.statusText, data);
  return data as T;
}
