import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubCard } from "@/components/HubUI/HubUI.jsx";
import { useHub, openVisitOf, minutesSince, fmtClock, fmtDateTime, fmtDuration } from "@/data/orderHubStore.js";

/* Admin view: where is each area manager right now, when did they check in, and today's finished visits */
export default function ManagerVisitsPanel() {
  const s = useHub();
  const [, tick] = useState(0);

  // refresh "time so far" every 30 seconds
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const today = new Date().toDateString();
  const rows = s.areaManagers.map((m) => ({
    m,
    open: openVisitOf(m),
    done: m.visits.filter((v) => v.checkIn && v.checkOut && new Date(v.checkIn).toDateString() === today),
  }));

  return (
    <HubCard title="Manager store visits (check-in / check-out)">
      {rows.length === 0 && <p className="muted">No area managers yet.</p>}
      {rows.map(({ m, open, done }) => (
        <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div className="hub-row">
            <b>{m.name}</b>
            {open ? <StatusPill tone="orange" status="In store" /> : <StatusPill tone="gray" status="Not in a store" />}
          </div>
          {open && (
            <p className="hub-small">
              At <b>{open.client}</b> since {fmtDateTime(open.checkIn)} ({fmtDuration(minutesSince(open.checkIn))} so far)
              {open.note ? ` · Remark: ${open.note}` : ""}
            </p>
          )}
          {done.length > 0 && (
            <ul className="hub-small muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {done.map((v) => (
                <li key={v.id}>
                  {v.client}: {fmtClock(v.checkIn)} to {fmtClock(v.checkOut)} ({fmtDuration(v.durationMin)})
                  {v.note ? ` · In: ${v.note}` : ""}{v.checkOutRemark ? ` · Out: ${v.checkOutRemark}` : ""}
                </li>
              ))}
            </ul>
          )}
          {!open && done.length === 0 && <p className="hub-small muted">No visits today.</p>}
        </div>
      ))}
    </HubCard>
  );
}