import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubCard, Field, HubButton, HubNotice } from "@/components/HubUI/HubUI.jsx";
import {
  client, registerVisit, checkOutVisit, haversineKm,
  openVisitOf, minutesSince, fmtClock, fmtDateTime, fmtDuration,
} from "@/data/orderHubStore.js";

/* Simple popup. Rendered into document.body (portal) so the page's transform / animation
   containers cannot break position: fixed. */
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // page does not scroll behind the popup
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="sv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sv-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sv-modal-head">
          <h3>{title}</h3>
          <button type="button" className="sv-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="sv-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* Store visit card for the Manager Dashboard.
   m = the area manager,  loc = { pos, status } from the dashboard's live location hook.
   "Enter store" and "Leave store" both open a popup and need a remark.
   Enter store no longer needs a location check - only a remark. */
export default function StoreVisitCard({ m, loc }) {
  const [clientId, setClientId] = useState(m.clientIds[0]);
  const [modal, setModal] = useState(null);     // null | "in" | "out"
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const clearForm = () => { setRemark(""); setErr(""); setBusy(false); };
  const openModal = (kind) => { clearForm(); setDone(""); setModal(kind); };
  const closeModal = () => { clearForm(); setModal(null); };
  useEffect(() => { clearForm(); setModal(null); setClientId(m.clientIds[0]); setDone(""); /* eslint-disable-next-line */ }, [m.id]);

  const c = client(clientId) || client(m.clientIds[0]);
  const open = openVisitOf(m);
  const todayStr = new Date().toDateString();
  const todays = m.visits.filter((v) => v.checkIn && new Date(v.checkIn).toDateString() === todayStr);

  /* distance is still saved with the visit when GPS is available, but it no longer blocks check-in */
  const hasGeo = c && c.lat != null && c.lng != null;
  const km = loc && loc.pos && hasGeo ? haversineKm(loc.pos.lat, loc.pos.lng, c.lat, c.lng) : null;
  const remarkOk = remark.trim().length >= 3;

  /* ENTER STORE = check in */
  const confirmEnter = async () => {
    setErr(""); setBusy(true);
    const r = await registerVisit(m.id, {
      clientId: c.id,
      lat: loc && loc.pos ? loc.pos.lat : undefined,
      lng: loc && loc.pos ? loc.pos.lng : undefined,
      distanceKm: km,
      remark,
    });
    setBusy(false);
    if (!r.ok) { setErr(r.msg); return; }
    clearForm(); setModal(null); setDone(r.msg);
  };

  /* LEAVE STORE = check out */
  const confirmLeave = async () => {
    setErr(""); setBusy(true);
    const r = await checkOutVisit(m.id, open.id, { remark });
    setBusy(false);
    if (!r.ok) { setErr(r.msg); return; }
    clearForm(); setModal(null); setDone(r.msg);
  };

  return (
    <HubCard title="Store Visit (Check in / Check out)" className="sv-card">
      {open ? (
        <div className="sv-instore">
          <StatusPill tone="orange" status="In store" />
          <h3 className="sv-name">{open.client}</h3>
          <p className="muted">Checked in: <b>{fmtDateTime(open.checkIn)}</b></p>
          <p className="sv-elapsed">{fmtDuration(minutesSince(open.checkIn))} <span className="muted">in store so far</span></p>
          <HubButton icon="fa-door-open" onClick={() => openModal("out")}>Leave store (Check out)</HubButton>
        </div>
      ) : (
        <div className="sv-start">
          <Field label="Store">
            <select value={c.id} onChange={(e) => setClientId(e.target.value)}>
              {m.clientIds.map((id) => <option key={id} value={id}>{client(id).name} - {client(id).address}</option>)}
            </select>
          </Field>
          <HubButton icon="fa-door-closed" onClick={() => openModal("in")}>Enter store (Check in)</HubButton>
        </div>
      )}
      <HubNotice tone="green">{done}</HubNotice>

      <h4 className="sv-sub">Today's visits</h4>
      {todays.length ? (
        <div className="sv-table-wrap">
          <table className="sv-table">
            <thead><tr><th>Store</th><th>Check-in</th><th>Check-out</th><th>Duration</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
              {todays.map((v) => (
                <tr key={v.id}>
                  <td>{v.client}</td>
                  <td>{fmtClock(v.checkIn)}</td>
                  <td>{v.checkOut ? fmtClock(v.checkOut) : "-"}</td>
                  <td>{fmtDuration(v.checkOut ? v.durationMin : minutesSince(v.checkIn))}</td>
                  <td><StatusPill tone={v.checkOut ? "green" : "orange"} status={v.checkOut ? "Completed" : "In store"} /></td>
                  <td className="sv-remarks">
                    {v.note ? <div>In: {v.note}</div> : null}
                    {v.checkOutRemark ? <div>Out: {v.checkOutRemark}</div> : null}
                    {!v.note && !v.checkOutRemark ? "-" : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted hub-small">No visits yet today.</p>}

      {/* ---------- popup: ENTER STORE ---------- */}
      {modal === "in" && (
        <Modal title={`Enter store - ${c.name}`} onClose={closeModal}>
          <div className="sv-row"><b>Remark <span className="sv-req">*</span></b></div>
          <textarea
            className="sv-remark"
            rows={3}
            maxLength={300}
            placeholder="Why are you visiting? e.g. Reviewed stock, took new order"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />

          <HubNotice tone="red">{err}</HubNotice>
          <div className="sv-actions">
            <HubButton variant="ghost" onClick={closeModal}>Cancel</HubButton>
            <HubButton icon="fa-door-closed" disabled={!remarkOk || busy} onClick={confirmEnter}>Enter store</HubButton>
          </div>
        </Modal>
      )}

      {/* ---------- popup: LEAVE STORE ---------- */}
      {modal === "out" && open && (
        <Modal title={`Leave store - ${open.client}`} onClose={closeModal}>
          <p className="muted">Checked in: <b>{fmtDateTime(open.checkIn)}</b></p>
          <p className="sv-elapsed">{fmtDuration(minutesSince(open.checkIn))} <span className="muted">in store</span></p>

          <div className="sv-row"><b>Remark <span className="sv-req">*</span></b></div>
          <textarea
            className="sv-remark"
            rows={3}
            maxLength={300}
            placeholder="What was done in the store? e.g. Order taken, shelf checked"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />

          <HubNotice tone="red">{err}</HubNotice>
          <div className="sv-actions">
            <HubButton variant="ghost" onClick={closeModal}>Cancel</HubButton>
            <HubButton icon="fa-door-open" disabled={!remarkOk || busy} onClick={confirmLeave}>Leave store</HubButton>
          </div>
        </Modal>
      )}
    </HubCard>
  );
}