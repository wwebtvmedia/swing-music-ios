// ─── Normalize URL ────────────────────────────────────────────────────────────
export function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  if (!url.endsWith('/')) url = url + '/';
  return url;
}

// ─── Fetch list of users on the server ────────────────────────────────────────
export interface ServerUser {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  roles?: string[];
}

export async function fetchServerUsers(baseUrl: string): Promise<ServerUser[]> {
  const url = normalizeUrl(baseUrl);
  // Swing Music exposes GET /auth/users → list of users
  const res = await fetch(`${url}auth/users`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Server unreachable (${res.status})`);
  const data = await res.json();
  return data.users || data.items || data || [];
}

// ─── Login with username + password ──────────────────────────────────────────
export async function loginUser(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ accessToken: string; refreshToken?: string }> {
  const url = normalizeUrl(baseUrl);
  const res = await fetch(`${url}auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Incorrect password');
    if (res.status === 404) throw new Error('User not found');
    throw new Error(`Login failed (${res.status})`);
  }

  const data = await res.json();
  return {
    accessToken: data.accesstoken || data.accessToken || '',
    refreshToken: data.refreshtoken || data.refreshToken,
  };
}
