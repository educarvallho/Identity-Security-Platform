const API_URL = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Network error (ECONNRESET, socket hang up) — retry once after short delay
    await new Promise((r) => setTimeout(r, 800));
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  }

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    if (path !== "/auth/login" && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new Error(body.detail || "Sessão expirada. Faça login novamente.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Erro ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  get: <T>(path: string) => request<T>(path),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string) => request<T>(path, { method: "PATCH" }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
