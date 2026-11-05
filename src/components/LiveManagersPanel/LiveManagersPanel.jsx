import { useEffect, useState } from "react";
import { HubCard } from "@/components/HubUI/HubUI.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { fetchLiveManagers } from "@/data/liveLocationApi.js";
import { useHub, manager, openVisitOf, minutesSince, fmtDateTime, fmtDuration } from "@/data/orderHubStore.js";
import "./LiveManagersPanel.css";

const agoText = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};

export default function LiveManagersPanel() {
  useHub(); // re-render when a manager checks in / out
  const [list, setList] = useState([]);
  const [err, setErr] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchLiveManagers()
        .then((d) => { if (alive) { setList(d); setErr(false); } })
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 5000);
    const t2 = setInterval(() => tick((n) => n + 1), 1000);
    return () => { alive = false; clearInterval(t); clearInterval(t2); };
  }, []);

  const online = list.filter((m) => m.online).length;

  return (
    <HubCard title="Managers - Live Location">
      {err && <p className="muted hub-small">Cannot reach the location server. Retrying...</p>}
      {!err && list.length === 0 && (
        <p className="muted">No manager has shared a location yet. Ask a manager to open the Manager Dashboard and allow location access.</p>
      )}
      {list.length > 0 && (
        <p className="muted hub-small">{online} online of {list.length} managers</p>
      )}
      <ul className="lm-list">
        {list.map((m) => {
          const open = openVisitOf(manager(m.managerId)); // store the manager has checked in to (or null)
          return (
            <li key={m.managerId} className="lm-row">
              <div>
                <b>{m.name || `Manager ${m.managerId}`}</b>
                <p className="muted hub-small">
                  {m.lat.toFixed(4)}, {m.lng.toFixed(4)} · Updated {agoText(Date.now() - m.at)}
                  {m.acc != null ? ` · Accuracy ±${Math.round(m.acc)} m` : ""}
                </p>
                {open && (
                  <p className="hub-small">
                    <b>In store: {open.client}</b> · Checked in {fmtDateTime(open.checkIn)} · {fmtDuration(minutesSince(open.checkIn))} so far
                  </p>
                )}
              </div>
              {open && <StatusPill tone="orange" status="In store" />}
              <StatusPill tone={m.online ? "green" : "gray"} status={m.online ? "Online" : "Offline"} />
              <a className="md-btn primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}>
                <i className="fa-solid fa-map-location-dot" /> View on map
              </a>
            </li>
          );
        })}
      </ul>
    </HubCard>
  );
}