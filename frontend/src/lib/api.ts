// src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function parseRes(res: Response) {
  const txt = await res.text();
  try {
    return JSON.parse(txt || '{}');
  } catch {
    return txt;
  }
}

export async function apiGet(path: string, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return parseRes(res);
}

export async function apiPost(
  path: string,
  body: FormData | Record<string, any>,
  token?: string
) {
  let res: Response;
  if (body instanceof FormData) {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } else {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }
  if (!res.ok) throw new Error(`POST ${path} ${res.status}`);
  return parseRes(res);
}

export async function apiPut(
  path: string,
  body: FormData | Record<string, any>,
  token?: string
) {
  let res: Response;
  if (body instanceof FormData) {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } else {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }
  if (!res.ok) throw new Error(`PUT ${path} ${res.status}`);
  return parseRes(res);
}

export async function apiDelete(path: string, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`DELETE ${path} ${res.status}`);
  return parseRes(res);
}
