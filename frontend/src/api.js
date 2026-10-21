const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(Array.isArray(data.detail) ? data.detail.map(item => item.msg).join('; ') : data.detail || "Something went wrong. Please try again.");
  }
  return data;
}

