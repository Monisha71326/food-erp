import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Clock, Expand, ExternalLink, LocateFixed, MapPin, Minimize, Navigation, Radio, Scan, Search, Store, Target, WifiOff,
} from "lucide-react";
import { HubCard } from "@/components/HubUI/HubUI.jsx";
import { fetchLiveManagers } from "@/data/liveLocationApi.js";
import { useHub, manager, openVisitOf, minutesSince, fmtDateTime, fmtDuration } from "@/data/orderHubStore.js";
import "./LiveManagersPanel.css";

const ONLINE_MS = 2 * 60 * 1000; // online = updated in the last 2 minutes
const TRAIL_MAX = 40;
const FILTERS = [["all", "All"], ["online", "Online"], ["store", "In store"], ["offline", "Offline"]];
const CARTO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const TILES = {
  street: { label: "Street", url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", sub: "abcd", attr: CARTO },
  sat: { label: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Tiles &copy; Esri" },
  dark: { label: "Dark", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", sub: "abcd", attr: CARTO },
};

const agoText = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};
const stampOf = (m) => {
  const t = typeof m.at === "number" ? m.at : Date.parse(m.at);
  return Number.isFinite(t) ? t : 0;
};
const clean = (s = "") => String(s).replace(/[^A-Za-z0-9 ]/g, "");
const initials = (name = "") => clean(name).split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "M";
const firstName = (name = "") => clean(name).split(" ").filter(Boolean)[0] || "Manager";
const todayStr = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const pinIcon = (name, { online, store, selected }) =>
  L.divIcon({
    className: "lm-pin",
    html: `<span class="lm-pin-pulse ${online ? "on" : ""}"></span>
           <span class="lm-pin-dot ${online ? "" : "off"} ${store ? "store" : ""} ${selected ? "sel" : ""}">${initials(name)}</span>
           <span class="lm-pin-tag">${firstName(name)}</span>`,
    iconSize: [48, 64],
    iconAnchor: [24, 24],
  });

export default function LiveManagersPanel() {
  useHub(); // re-render when a manager checks in / out
  const [list, setList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  const [refreshed, setRefreshed] = useState(0);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [style, setStyle] = useState("street");
  const [follow, setFollow] = useState(false);
  const [full, setFull] = useState(false);
  const [, tick] = useState(0);

  const shellEl = useRef(null);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const markers = useRef(new Map());
  const polys = useRef(new Map());
  const trails = useRef(new Map());
  const circleRef = useRef(null);
  const fitted = useRef(false);
  const visibleRef = useRef([]);
  const followRef = useRef(false);
  followRef.current = follow;

  /* poll the location server every 5 s, and remember each manager's recent path */
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchLiveManagers()
        .then((d) => {
          if (!alive) return;
          const rowsIn = Array.isArray(d) ? d : [];
          rowsIn.forEach((m) => {
            if (typeof m.lat !== "number" || typeof m.lng !== "number") return;
            const t = trails.current.get(m.managerId) || [];
            const last = t[t.length - 1];
            if (!last || last[0] !== m.lat || last[1] !== m.lng) {
              t.push([m.lat, m.lng]);
              if (t.length > TRAIL_MAX) t.shift();
              trails.current.set(m.managerId, t);
            }
          });
          setList(rowsIn); setErr(false); setLoaded(true); setRefreshed(Date.now());
        })
        .catch(() => alive && (setErr(true), setLoaded(true)));
    load();
    const t = setInterval(load, 5000);
    const t2 = setInterval(() => tick((n) => n + 1), 1000);
    return () => { alive = false; clearInterval(t); clearInterval(t2); };
  }, []);

  /* create the map once */
  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: false }).setView([20, 0], 2);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("dragstart", () => setFollow(false)); // moving the map by hand stops Follow
    mapRef.current = map;
    const store = markers.current, pl = polys.current;
    const fix = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(fix); map.remove(); mapRef.current = null; tileRef.current = null; store.clear(); pl.clear(); circleRef.current = null; fitted.current = false; };
  }, []);

  /* map style (street / satellite / dark) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const t = TILES[style];
    tileRef.current = L.tileLayer(t.url, { maxZoom: 19, subdomains: t.sub || "abc", attribution: t.attr }).addTo(map);
    tileRef.current.bringToBack();
  }, [style]);

  /* fullscreen (native, works inside any layout) */
  useEffect(() => {
    const h = () => { setFull(document.fullscreenElement === shellEl.current); setTimeout(() => mapRef.current?.invalidateSize(), 120); };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : shellEl.current?.requestFullscreen?.());

  /* ---- derived rows ---- */
  const rows = list.map((m) => {
    const ts = stampOf(m);
    return { ...m, ts, online: m.online ?? Date.now() - ts < ONLINE_MS, open: openVisitOf(manager(m.managerId)) };
  });
  const counts = {
    all: rows.length,
    online: rows.filter((r) => r.online).length,
    store: rows.filter((r) => r.open).length,
    offline: rows.filter((r) => !r.online).length,
  };
  const needle = q.trim().toLowerCase();
  const visible = rows
    .filter((r) => filter === "all" || (filter === "online" && r.online) || (filter === "store" && r.open) || (filter === "offline" && !r.online))
    .filter((r) => !needle || String(r.name || r.managerId).toLowerCase().includes(needle))
    .sort((a, b) => Number(b.online) - Number(a.online) || b.ts - a.ts);
  visibleRef.current = visible;
  const current = visible.find((r) => r.managerId === selected) || visible[0] || null;
  const sig = visible.map((r) => `${r.managerId}|${r.lat}|${r.lng}|${r.online ? 1 : 0}|${r.open ? 1 : 0}|${r.acc}`).join(";") + `#${current?.managerId}`;

  /* keep markers, trails and accuracy circle in step with the list */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    visibleRef.current.forEach((m) => {
      if (typeof m.lat !== "number" || typeof m.lng !== "number") return;
      const id = m.managerId, sel = id === current?.managerId, ll = [m.lat, m.lng];
      const look = { online: m.online, store: !!m.open, selected: sel };
      const key = `${m.name}|${m.online}|${!!m.open}|${sel}`;
      seen.add(id);

      let mk = markers.current.get(id);
      if (!mk) {
        mk = L.marker(ll, { icon: pinIcon(m.name || id, look) }).on("click", () => setSelected(id)).addTo(map);
        mk._k = key;
        markers.current.set(id, mk);
      } else {
        mk.setLatLng(ll); // same element => the pin glides smoothly (see CSS)
        if (mk._k !== key) { mk.setIcon(pinIcon(m.name || id, look)); mk._k = key; }
      }
      mk.setZIndexOffset(sel ? 1000 : 0);

      const path = trails.current.get(id) || [];
      if (path.length > 1) {
        const st = { color: sel ? "#9a0f2e" : "#2b3190", weight: sel ? 4 : 3, opacity: sel ? 0.85 : 0.45, dashArray: sel ? null : "6 8" };
        let pl = polys.current.get(id);
        if (!pl) { pl = L.polyline(path, st).addTo(map); polys.current.set(id, pl); }
        else { pl.setLatLngs(path); pl.setStyle(st); }
      }
    });
    markers.current.forEach((mk, id) => { if (!seen.has(id)) { mk.remove(); markers.current.delete(id); } });
    polys.current.forEach((pl, id) => { if (!seen.has(id)) { pl.remove(); polys.current.delete(id); } });

    circleRef.current?.remove(); circleRef.current = null;
    if (current && current.acc > 0) {
      circleRef.current = L.circle([current.lat, current.lng], { radius: current.acc, color: "#2b3190", weight: 1, fillColor: "#2b3190", fillOpacity: 0.12, interactive: false }).addTo(map);
    }
    if (!fitted.current && seen.size) { fitAll(); fitted.current = true; }
    else if (followRef.current && current) map.panTo([current.lat, current.lng], { animate: true, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const fitAll = () => {
    const map = mapRef.current;
    const pts = [...markers.current.values()].map((mk) => mk.getLatLng());
    if (!map || !pts.length) return;
    if (pts.length === 1) map.flyTo(pts[0], 15, { duration: 0.8 });
    else map.flyToBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 15, duration: 0.8 });
  };
  const focus = (m) => { setSelected(m.managerId); mapRef.current?.flyTo([m.lat, m.lng], 16, { duration: 0.9 }); };

  const open = current?.open;
  const visitsToday = current ? (manager(current.managerId)?.visits || []).filter((v) => v.date === todayStr()).slice(0, 3) : [];
  const gmaps = current ? `https://www.google.com/maps?q=${current.lat},${current.lng}` : "https://www.google.com/maps";
  const nav = current ? `https://www.google.com/maps/dir/?api=1&destination=${current.lat},${current.lng}` : gmaps;

  return (
    <HubCard title="Managers - Live Location">
      <div className="lm-stats">
        <div className="lm-stat green"><span className="lm-stat-ico"><Radio size={20} /></span><div><small>Online now</small><b>{counts.online}</b></div></div>
        <div className="lm-stat orange"><span className="lm-stat-ico"><Store size={20} /></span><div><small>In a store</small><b>{counts.store}</b></div></div>
        <div className="lm-stat blue"><span className="lm-stat-ico"><WifiOff size={20} /></span><div><small>Offline</small><b>{counts.offline}</b></div></div>
      </div>

      <div className="lm-chips" role="tablist" aria-label="Filter managers">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={`lm-chip ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>
            {label} <i>{counts[id]}</i>
          </button>
        ))}
      </div>

      <div ref={shellEl} className={`lm-shell ${full ? "full" : ""}`}>
        {/* ---- left navy panel ---- */}
        <aside className="lm-side">
          <div className="lm-side-head">
            <span className="lm-side-ico"><MapPin size={22} /></span>
            <h3>Live Managers</h3>
            <p>Tap a manager to jump to their location</p>
          </div>
          <label className="lm-search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search manager" aria-label="Search manager" />
          </label>
          <div className="lm-side-list">
            {!loaded && [0, 1, 2].map((i) => <div key={i} className="lm-skel" />)}
            {loaded && visible.length === 0 && (
              <p className="lm-empty">
                {err ? "Location server is not reachable. Start it with npm start and this list will fill in."
                  : rows.length ? "No managers match your search."
                  : "No manager has shared a location yet. Ask a manager to open the Manager Dashboard and allow location."}
              </p>
            )}
            {visible.map((m) => (
              <button type="button" key={m.managerId} className={`lm-item ${current?.managerId === m.managerId ? "active" : ""}`} onClick={() => focus(m)}>
                <span className={`lm-av ${m.online ? "" : "off"}`}>{initials(m.name)}<i className={`lm-dot ${m.online ? "on" : ""}`} /></span>
                <span className="lm-item-text">
                  <b>{m.name || `Manager ${m.managerId}`}</b>
                  <small>{m.online ? "Online" : "Offline"} · {m.ts ? agoText(Date.now() - m.ts) : "-"}</small>
                  {m.open && <small className="lm-store"><Store size={11} /> {m.open.client} · {fmtDuration(minutesSince(m.open.checkIn))}</small>}
                </span>
                <Navigation size={15} className="lm-go" />
              </button>
            ))}
          </div>
        </aside>

        {/* ---- map ---- */}
        <div className="lm-mapwrap">
          <div ref={mapEl} className="lm-map" />

          <div className={`lm-live ${err ? "bad" : ""}`}>
            <i /> {err ? "Reconnecting..." : `Live${refreshed ? ` · updated ${agoText(Date.now() - refreshed)}` : ""}`}
          </div>

          <div className="lm-styles" role="group" aria-label="Map style">
            {Object.entries(TILES).map(([id, t]) => (
              <button key={id} type="button" className={style === id ? "on" : ""} aria-pressed={style === id} onClick={() => setStyle(id)}>{t.label}</button>
            ))}
          </div>

          <div className="lm-tools">
            <button type="button" onClick={fitAll} disabled={!visible.length} title="Fit all managers" aria-label="Fit all managers"><Scan size={17} /></button>
            <button type="button" className={follow ? "on" : ""} onClick={() => { setFollow((f) => !f); if (current) focus(current); }} disabled={!current} title="Follow selected manager" aria-pressed={follow} aria-label="Follow selected manager"><LocateFixed size={17} /></button>
            <button type="button" onClick={toggleFull} title={full ? "Exit full screen" : "Full screen"} aria-label={full ? "Exit full screen" : "Full screen"}>{full ? <Minimize size={17} /> : <Expand size={17} />}</button>
          </div>

          {current && (
            <div className="lm-card">
              <div className="lm-card-top">
                <span className={`lm-av sm ${current.online ? "" : "off"}`}>{initials(current.name)}</span>
                <div>
                  <b>{current.name || `Manager ${current.managerId}`}</b>
                  <span className={`lm-badge ${current.online ? "on" : ""}`}>{current.online ? "Online" : "Offline"}</span>
                  {follow && <span className="lm-badge follow">Following</span>}
                </div>
              </div>
              <ul>
                <li><Clock size={13} /> Updated {current.ts ? agoText(Date.now() - current.ts) : "-"}</li>
                <li><Target size={13} /> {current.acc != null ? `Accuracy ±${Math.round(current.acc)} m` : "Accuracy unknown"}</li>
                <li><MapPin size={13} /> {current.lat.toFixed(4)}, {current.lng.toFixed(4)}</li>
                {open && <li className="store"><Store size={13} /> In {open.client} since {fmtDateTime(open.checkIn)}</li>}
              </ul>

              {visitsToday.length > 0 && (
                <div className="lm-visits">
                  <p>Today's visits</p>
                  {visitsToday.map((v) => (
                    <div key={v.id} className="lm-visit">
                      <i className={v.checkIn && !v.checkOut ? "live" : ""} />
                      <span>{v.client}</span>
                      <small>{v.time}{v.durationMin ? ` · ${fmtDuration(v.durationMin)}` : v.checkIn && !v.checkOut ? " · now" : ""}</small>
                    </div>
                  ))}
                </div>
              )}

              <div className="lm-card-actions">
                <a className="lm-btn primary" href={nav} target="_blank" rel="noreferrer"><Navigation size={14} /> Directions</a>
                <a className="lm-btn" href={gmaps} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Google Maps</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </HubCard>
  );
}