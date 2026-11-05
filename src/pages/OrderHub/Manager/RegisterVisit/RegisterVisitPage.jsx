import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubCard, Field, HubButton, HubNotice, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import {
  useHub, manager, client, registerVisit, checkOutVisit, haversineKm,
  openVisitOf, minutesSince, fmtClock, fmtDateTime, fmtDuration,
} from "@/data/orderHubStore.js";
import "./RegisterVisitPage.css";

/* Draw the date + store name on the bottom of a photo and return a JPEG data URL */
function stamp(source, w, h, lines) {
  const cnv = document.createElement("canvas");
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext("2d");
  if (source) ctx.drawImage(source, 0, 0, w, h);
  const barH = 20 + lines.length * 20;
  ctx.fillStyle = "rgba(14, 26, 58, 0.78)";
  ctx.fillRect(0, h - barH, w, barH);
  ctx.fillStyle = "#fff";
  ctx.font = "600 14px Inter, Arial, sans-serif";
  ctx.textBaseline = "top";
  lines.forEach((t, i) => ctx.fillText(t, 12, h - barH + 10 + i * 20));
  return cnv.toDataURL("image/jpeg", 0.85);
}
function placeholderPhoto(w, h, label) {
  const cnv = document.createElement("canvas");
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#9a0f2e"); g.addColorStop(1, "#0e1a3a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "800 90px Inter, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText((label || "M")[0].toUpperCase(), w / 2, h / 2 - 20);
  ctx.font = "600 15px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("Camera unavailable - placeholder photo", w / 2, h / 2 + 60);
  return cnv;
}

export default function RegisterVisitPage() {
  const s = useHub();
  const m = manager(s.session.managerId);
  const [clientId, setClientId] = useState(m.clientIds[0]);
  const [loc, setLoc] = useState(null);       // { verified, distanceKm, source }
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState("");
  const [photo, setPhoto] = useState(null);   // data URL
  const [camera, setCamera] = useState(false); // live camera showing
  const [camNote, setCamNote] = useState("");
  const [done, setDone] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [, tick] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // refresh the "time in store" numbers every 30 seconds
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => stopStream, []);

  // switching manager or store resets the form
  const reset = (nextClient) => {
    stopStream(); setClientId(nextClient); setLoc(null); setLocErr(""); setPhoto(null);
    setCamera(false); setCamNote(""); setDone(""); setSaveErr("");
  };
  useEffect(() => { reset(m.clientIds[0]); /* eslint-disable-next-line */ }, [m.id]);

  const c = client(clientId) || client(m.clientIds[0]);
  const open = openVisitOf(m); // the store the manager is inside right now (or null)
  const todayStr = new Date().toDateString();
  const todays = m.visits.filter((v) => v.checkIn && new Date(v.checkIn).toDateString() === todayStr);
  const stampLines = () => [new Date().toLocaleString("en-GB"), `${c.name} - ${c.address}`];

  const setDistance = (distanceKm, source, coords) => setLoc({ distanceKm, source, coords, verified: distanceKm <= 0.3 }); // the server re-checks real GPS

  const checkGps = () => {
    setLocBusy(true); setLocErr("");
    if (!("geolocation" in navigator)) { setLocBusy(false); setLocErr("Location is not supported here - use the simulate buttons."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocBusy(false); setDistance(haversineKm(pos.coords.latitude, pos.coords.longitude, c.lat, c.lng), "real GPS", { lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      (e) => { setLocBusy(false); setLocErr(`Location not available (${e.code === 1 ? "permission denied" : "timed out"}) - try the simulate buttons.`); },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 },
    );
  };

  const openCamera = async () => {
    setCamNote("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamera(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 0);
    } catch {
      setPhoto(stamp(placeholderPhoto(480, 360, c.name), 480, 360, stampLines()));
      setCamNote("Camera isn't available here - a placeholder photo was stamped instead.");
    }
  };
  const capture = () => {
    const v = videoRef.current;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    tmp.getContext("2d").drawImage(v, 0, 0, w, h);
    setPhoto(stamp(tmp, w, h, stampLines()));
    stopStream(); setCamera(false);
  };

  /* ENTER STORE = check in (saves the check-in time) */
  const enterStore = async () => {
    setSaveErr(""); setDone("");
    const r = await registerVisit(m.id, { clientId: c.id, lat: loc.coords?.lat, lng: loc.coords?.lng, distanceKm: loc.distanceKm, photoDataUrl: photo });
    if (!r.ok) { setSaveErr(r.msg); return; }
    setDone(r.msg);
    setLoc(null); setPhoto(null); setCamNote("");
  };

  /* LEAVE STORE = check out (saves the check-out time + duration) */
  const leaveStore = async () => {
    setSaveErr(""); setDone("");
    const r = await checkOutVisit(m.id, open.id);
    if (!r.ok) { setSaveErr(r.msg); return; }
    setDone(r.msg);
  };

  return (
    <div className="page-anim register-visit-page">
      <PageHeader eyebrow="AREA MANAGER" title="Register a Visit" subtitle="Verify your location and photo, tap Enter store to check in, and Leave store when you finish." icon="fa-location-dot" actions={<ViewingAs kind="manager" />} />

      <HubCard className="rv-card">
        {open ? (
          /* ---- manager is inside a store: show the live timer + Leave store ---- */
          <div className="rv-instore">
            <StatusPill tone="orange" status="In store" />
            <h3 className="rv-step">{open.client}</h3>
            <p className="muted">Checked in: <b>{fmtDateTime(open.checkIn)}</b></p>
            <p className="rv-elapsed">{fmtDuration(minutesSince(open.checkIn))} <span className="muted">in store so far</span></p>
            <HubButton icon="fa-door-open" onClick={leaveStore}>Leave store (Check out)</HubButton>
          </div>
        ) : (
          /* ---- not in a store: verify location + photo, then Enter store ---- */
          <>
            <Field label="Store">
              <select value={c.id} onChange={(e) => reset(e.target.value)}>
                {m.clientIds.map((id) => <option key={id} value={id}>{client(id).name} - {client(id).address}</option>)}
              </select>
            </Field>

            <div className="hub-divider" />
            <h3 className="rv-step">1. Confirm your location</h3>
            <div className="rv-status">
              {loc ? (
                <>
                  <StatusPill tone={loc.verified ? "green" : "red"} status={loc.verified ? "Verified" : "Too far"} />{" "}
                  <span className="muted">
                    {loc.verified ? `${(loc.distanceKm * 1000).toFixed(0)}m` : `${loc.distanceKm.toFixed(2)}km`} from {c.name} ({loc.source})
                    {!loc.verified && " - move closer, or use simulate"}
                  </span>
                </>
              ) : <span className="muted">{locBusy ? "Getting your location..." : "Not checked yet."}</span>}
            </div>
            <HubNotice tone="orange">{locErr}</HubNotice>
            <div className="hub-row rv-btns">
              <HubButton size="sm" icon="fa-crosshairs" onClick={checkGps} disabled={locBusy}>Check my GPS location</HubButton>
              <HubButton size="sm" variant="ghost" onClick={() => setDistance(0.04, "simulated")}>Simulate: I'm at the store</HubButton>
              <HubButton size="sm" variant="ghost" onClick={() => setDistance(3.8, "simulated")}>Simulate: I'm elsewhere</HubButton>
            </div>
            <p className="muted hub-small">Simulate buttons are for demos, in case the browser can't share real location.</p>

            <div className="hub-divider" />
            <h3 className="rv-step">2. Take a store photo</h3>
            {camera && (
              <div className="rv-cam">
                <video ref={videoRef} autoPlay playsInline muted />
                <HubButton size="sm" icon="fa-camera" onClick={capture}>Capture photo</HubButton>
              </div>
            )}
            {!camera && !photo && <HubButton size="sm" icon="fa-camera" onClick={openCamera}>Open camera</HubButton>}
            {!camera && photo && (
              <div className="rv-photo">
                <img src={photo} alt="Captured store" />
                <HubButton size="sm" variant="ghost" icon="fa-rotate-left" onClick={() => { setPhoto(null); setCamNote(""); }}>Retake photo</HubButton>
              </div>
            )}
            <HubNotice>{camNote}</HubNotice>

            <div className="hub-divider" />
            <HubButton icon="fa-door-closed" disabled={!(loc?.verified && photo)} onClick={enterStore}>Enter store (Check in)</HubButton>
          </>
        )}
        <HubNotice tone="red">{saveErr}</HubNotice>
        <HubNotice tone="green">{done}</HubNotice>
      </HubCard>

      <HubCard title="Today's visits" className="rv-card">
        {todays.length ? (
          <div className="rv-table-wrap">
            <table className="rv-table">
              <thead>
                <tr><th>Store</th><th>Check-in</th><th>Check-out</th><th>Duration</th><th>Status</th></tr>
              </thead>
              <tbody>
                {todays.map((v) => (
                  <tr key={v.id}>
                    <td>{v.client}</td>
                    <td>{fmtClock(v.checkIn)}</td>
                    <td>{v.checkOut ? fmtClock(v.checkOut) : "-"}</td>
                    <td>{fmtDuration(v.checkOut ? v.durationMin : minutesSince(v.checkIn))}</td>
                    <td><StatusPill tone={v.checkOut ? "green" : "orange"} status={v.checkOut ? "Completed" : "In store"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No visits yet today.</p>}
      </HubCard>
    </div>
  );
}