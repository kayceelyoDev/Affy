export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return (window as any).__CSRF_TOKEN__ || '';
}

export function setCachedCsrfToken(token: string) {
  (window as any).__CSRF_TOKEN__ = token;
}

export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.detail || err.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return res.json();
}

export const api = {
  get: <T = any>(url: string) => apiFetch<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    apiFetch<T>(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  put: <T = any>(url: string, body?: any) =>
    apiFetch<T>(url, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  delete: <T = any>(url: string) => apiFetch<T>(url, { method: 'DELETE' }),
};
