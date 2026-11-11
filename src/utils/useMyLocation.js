import { useEffect, useState } from "react";

/* status: checking | unavailable | denied | error | ok      pos: { lat, lng, acc, at }
   enabled = false -> does nothing (no location permission prompt) */
export function useMyLocation(enabled = true) {
  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!("geolocation" in navigator)) { setStatus("unavailable"); return undefined; }
    setStatus("checking");
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() });
        setStatus("ok");
      },
      (e) => setStatus((old) => (e.code === 1 ? "denied" : old === "ok" ? old : "error")),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [attempt, enabled]);

  return { pos, status, retry: () => setAttempt((n) => n + 1) };
}