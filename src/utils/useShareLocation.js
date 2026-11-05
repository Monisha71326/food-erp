import { useEffect, useRef, useState } from "react";
import { sendLocation } from "@/data/liveLocationApi.js";

const MIN_GAP_MS = 10000; // send to the server at most once every 10 seconds

/* Sends the manager's position (from useMyLocation) to the server.
   state: idle | sending | sent | failed */
export function useShareLocation({ managerId, name, pos, enabled = true }) {
  const [state, setState] = useState("idle");
  const lastSent = useRef(0);
  const latest = useRef(pos);
  latest.current = pos;

  // When the position changes (throttled)
  useEffect(() => {
    if (!enabled || !pos || !managerId) return;
    if (Date.now() - lastSent.current < MIN_GAP_MS) return;
    push();
  }, [pos, enabled, managerId]); // eslint-disable-line

  // Heartbeat so the manager stays "Online" even when standing still
  useEffect(() => {
    if (!enabled || !managerId) return undefined;
    const t = setInterval(() => { if (latest.current) push(); }, 30000);
    return () => clearInterval(t);
  }, [enabled, managerId]); // eslint-disable-line

  function push() {
    const p = latest.current;
    if (!p) return;
    lastSent.current = Date.now();
    setState("sending");
    sendLocation({ managerId, name, lat: p.lat, lng: p.lng, acc: p.acc })
      .then(() => setState("sent"))
      .catch(() => setState("failed"));
  }

  return state;
}