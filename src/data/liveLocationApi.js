// Backend URL: .env-la VITE_API_URL=https://your-server.com podunga
const BASE = import.meta.env?.VITE_API_URL || "http://localhost:4000";

export async function sendLocation({ managerId, name, lat, lng, acc }) {
  const res = await fetch(`${BASE}/api/live-location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ managerId, name, lat, lng, acc }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchLiveManagers() {
  const res = await fetch(`${BASE}/api/live-location`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function stopSharing(managerId) {
  await fetch(`${BASE}/api/live-location/${encodeURIComponent(managerId)}`, { method: "DELETE" }).catch(() => {});
}