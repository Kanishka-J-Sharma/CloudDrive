// Auth helpers — token stored in React state only (no localStorage, sandbox restriction)
export let authToken: string | null = null;
export let currentUser: { id: number; email: string; username: string; role: string } | null = null;

export function setAuth(token: string, user: typeof currentUser) {
  authToken = token;
  currentUser = user;
}

export function clearAuth() {
  authToken = null;
  currentUser = null;
}

export function getAuthHeaders(): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
