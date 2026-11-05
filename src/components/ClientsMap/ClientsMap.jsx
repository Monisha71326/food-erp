import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./ClientsMap.css";

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/* direction from the manager to a store: 0 = north, 90 = east */
const toRad = (d) => (d * Math.PI) / 180;
const bearing = (lat1, lng1, lat2, lng2) => {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lng2 - lng1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const COMPASS = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
const compassOf = (deg) => COMPASS[Math.round(deg / 45) % 8];

/* rings every `step` km (3 rings) */
const RING_STEPS = [0.25, 0.5, 1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
const ringStepFor = (maxKm) => (maxKm > 0 ? RING_STEPS.find((s) => s * 3 >= maxKm) || 0 : 1);

/* store icon styles (cycled per store) */
const STYLES = [
  { ico: "fa-cart-shopping", bg: "#dbeafe", fg: "#2563eb" },
  { ico: "fa-bag-shopping", bg: "#e0e7ff", fg: "#4338ca" },
  { ico: "fa-basket-shopping", bg: "#dcfce7", fg: "#16a34a" },
  { ico: "fa-store", bg: "#dbeafe", fg: "#1d4ed8" },
  { ico: "fa-shop", bg: "#fef3c7", fg: "#d97706" },
  { ico: "fa-cart-flatbed", bg: "#fce7f3", fg: "#db2777" },
];
const styleOf = (i) => STYLES[i % STYLES.length];

/* curved route between two points (quadratic bezier). returns { pts, mid } */
const curve = (a, b, sign) => {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ctrl = [mid[0] - dy * 0.22 * sign, mid[1] + dx * 0.22 * sign];
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 1 / 28) {
    const u = 1 - t;
    pts.push([
      u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1],
    ]);
  }
  const m = 0.5;
  const midPt = [
    (1 - m) * (1 - m) * a[0] + 2 * (1 - m) * m * ctrl[0] + m * m * b[0],
    (1 - m) * (1 - m) * a[1] + 2 * (1 - m) * m * ctrl[1] + m * m * b[1],
  ];
  return { pts, mid: midPt };
};

/* pos: { lat, lng, acc }    rows: [{ c: client, km }]    onPick(clientId): optional */
export default function ClientsMap({ pos, rows, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastKey = useRef("");
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const [detailId, setDetailId] = useState(null); // store whose details are open in the left panel

  const maxKm = rows.reduce((m, r) => Math.max(m, r.km), 0);
  const step = rows.length ? ringStepFor(maxKm) : 0;

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    if (rows.length === 0) {
      map.setView([pos.lat, pos.lng], 15);
      return;
    }
    const pts = [[pos.lat, pos.lng], ...rows.map(({ c }) => [c.lat, c.lng])];
    map.fitBounds(L.latLngBounds(pts), { padding: [110, 110], maxZoom: 16 });
  };

  /* open the details of one store and zoom the map to "me + that store" */
  const openDetail = (id) => {
    setDetailId(id);
    pickRef.current?.(id);
    const r = rows.find((x) => x.c.id === id);
    const map = mapRef.current;
    if (r && map) {
      map.fitBounds(L.latLngBounds([[pos.lat, pos.lng], [r.c.lat, r.c.lng]]), { padding: [110, 110], maxZoom: 16 });
    }
  };
  const closeDetail = () => {
    setDetailId(null);
    fitAll();
  };
  const openRef = useRef(openDetail);
  openRef.current = openDetail;

  // create the map once
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: false, scrollWheelZoom: false }).setView([pos.lat, pos.lng], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      lastKey.current = "";
    };
  }, []); // eslint-disable-line

  // redraw when position / client list changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const me = [pos.lat, pos.lng];

    // glowing distance rings
    if (step) {
      for (let i = 3; i >= 1; i -= 1) {
        L.circle(me, {
          radius: step * i * 1000,
          color: "#3b82f6",
          weight: 1.5,
          opacity: 0.5,
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(layer);
      }
    }
    if (pos.acc != null && pos.acc <= 1000) {
      L.circle(me, { radius: pos.acc, color: "#2563eb", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(layer);
    }

    // curved dotted routes + distance pills
    rows.forEach(({ c, km }, i) => {
      const pt = [c.lat, c.lng];
      const { pts, mid } = curve(me, pt, i % 2 === 0 ? 1 : -1);
      // white casing under the dashes
      L.polyline(pts, { color: "#ffffff", weight: 6, opacity: 0.85, interactive: false }).addTo(layer);
      L.polyline(pts, { color: "#1d4ed8", weight: 3.5, opacity: 1, dashArray: "2 8", lineCap: "round", interactive: false }).addTo(layer);
      L.marker(mid, {
        icon: L.divIcon({ className: "", html: `<span class="cm-km">${fmtKm(km)}</span>`, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      }).addTo(layer);
    });

    // store pins + white name cards
    rows.forEach(({ c, km }, i) => {
      const s = styleOf(i);
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className: "",
          html: '<i class="fa-solid fa-location-dot cm-store-pin"></i>',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          tooltipAnchor: [0, -34],
        }),
        title: c.name,
      })
        .on("click", () => openRef.current?.(c.id))
        .bindTooltip(
          `<span class="cm-card">` +
            `<span class="cm-card-ico" style="background:${s.bg};color:${s.fg}"><i class="fa-solid ${s.ico}"></i></span>` +
            `<span class="cm-card-txt"><b>${esc(c.name)}</b><em>${fmtKm(km)}</em></span></span>`,
          { permanent: true, direction: "top", className: "cm-tip" },
        )
        .addTo(layer);
    });

    // the manager (pulse + big blue pin + tag below)
    L.marker(me, {
      icon: L.divIcon({
        className: "",
        html: '<span class="cm-pulse"></span><span class="cm-pulse cm-pulse2"></span><i class="fa-solid fa-location-dot cm-me-pin"></i>',
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        tooltipAnchor: [0, 12],
      }),
      zIndexOffset: 1000,
    })
      .bindTooltip(
        `<span class="cm-me-tag"><i class="fa-solid fa-location-arrow"></i><b>Current Location</b></span>`,
        { permanent: true, direction: "bottom", className: "cm-tip" },
      )
      .addTo(layer);

    // zoom-to-fit only when client set changes
    const key = rows.map((r) => r.c.id).join(",");
    if (key !== lastKey.current) {
      lastKey.current = key;
      fitAll();
    }
  }, [pos, rows]); // eslint-disable-line

  const center = () => mapRef.current?.setView([pos.lat, pos.lng], 16);

  /* details of the opened store (null if none, or if it is no longer in the list) */
  const detailIdx = rows.findIndex((r) => String(r.c.id) === String(detailId));
  const detail = detailIdx >= 0 ? rows[detailIdx] : null;

  let detailView = null;
  if (detail) {
    const { c, km } = detail;
    const s = styleOf(detailIdx);
    const deg = bearing(pos.lat, pos.lng, c.lat, c.lng);
    const addr = c.address && c.address !== "-" ? `${c.address}${c.pincode ? `, ${c.pincode}` : ""}` : "No address saved";
    detailView = (
      <div className="cm-detail">
        <button type="button" className="cm-back" onClick={closeDetail}>
          <i className="fa-solid fa-arrow-left" /> All stores
        </button>

        <div className="cm-d-head">
          <span className="cm-li-ico" style={{ background: s.bg, color: s.fg }}>
            <i className={`fa-solid ${s.ico}`} />
          </span>
          <h4>{c.name}</h4>
        </div>

        <div className="cm-d-dist">
          <b>{fmtKm(km)}</b>
          <small>
            <i className="fa-solid fa-location-arrow" style={{ transform: `rotate(${deg - 45}deg)` }} />
            {compassOf(deg)} of you
          </small>
        </div>

        <dl className="cm-d-list">
          <div>
            <dt><i className="fa-solid fa-location-crosshairs" /></dt>
            <dd>
              <span>Current location</span>
              {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
              {pos.acc != null ? ` (about ${Math.round(pos.acc)} m accuracy)` : ""}
            </dd>
          </div>
          <div>
            <dt><i className="fa-solid fa-location-dot" /></dt>
            <dd><span>Address</span>{addr}</dd>
          </div>
          <div>
            <dt><i className="fa-solid fa-user" /></dt>
            <dd><span>Contact</span>{c.contact || "-"}</dd>
          </div>
          <div>
            <dt><i className="fa-solid fa-phone" /></dt>
            <dd><span>Phone</span>{c.phone || "No phone"}</dd>
          </div>
        </dl>

        <div className="cm-d-actions">
          <a
            className="cm-d-btn primary"
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
          >
            <i className="fa-solid fa-diamond-turn-right" /> Directions
          </a>
          {c.phone && (
            <a className="cm-d-btn" href={`tel:${String(c.phone).replace(/\s+/g, "")}`}>
              <i className="fa-solid fa-phone" /> Call
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="clients-map">
      <div className="clients-map-stage">
        {/* left panel: store list, or the details of one store */}
        <aside className="cm-panel">
          {detailView || (
            <>
              <div className="cm-panel-logo">
                <i className="fa-solid fa-location-dot" />
              </div>
              <h3>Nearby Stores</h3>
              <p>Stores around your current location</p>

              <ul>
                {rows.map(({ c, km }, i) => {
                  const s = styleOf(i);
                  return (
                    <li
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(c.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openDetail(c.id)}
                      title={c.name}
                    >
                      <span className="cm-li-ico" style={{ background: s.bg, color: s.fg }}>
                        <i className={`fa-solid ${s.ico}`} />
                      </span>
                      <span className="cm-li-txt">
                        <b>{c.name}</b>
                        <small>
                          <i className="fa-solid fa-location-dot" /> {fmtKm(km)}
                        </small>
                      </span>
                      <i className="fa-solid fa-chevron-right cm-li-arrow" />
                    </li>
                  );
                })}
                {rows.length === 0 && <li className="cm-empty">No stores found nearby</li>}
              </ul>
            </>
          )}
        </aside>

        {/* map */}
        <div className="cm-mapwrap">
          <div ref={elRef} className="clients-map-canvas" />

          <div className="cm-compass" aria-hidden="true">
            <i className="fa-solid fa-location-arrow" />
            <b>N</b>
          </div>

          <div className="cm-ctrl">
            <button type="button" onClick={center} title="Go to current location" aria-label="Go to current location"><i className="fa-solid fa-location-crosshairs" /></button>
            <button type="button" onClick={() => mapRef.current?.zoomIn()} title="Zoom in" aria-label="Zoom in"><i className="fa-solid fa-plus" /></button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} title="Zoom out" aria-label="Zoom out"><i className="fa-solid fa-minus" /></button>
          </div>
        </div>
      </div>

      <div className="clients-map-bar">
        {step > 0 && <span><i className="fa-regular fa-circle-dot" /> Circles every {fmtKm(step)}</span>}
        <span className="cm-spacer" />
        <button type="button" className="cm-btn" onClick={() => { setDetailId(null); fitAll(); }}>
          <i className="fa-solid fa-expand" /> Fit all stores
        </button>
        <a className="cm-btn" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}>
          <i className="fa-solid fa-map-location-dot" /> Open in Google Maps
        </a>
      </div>
    </div>
  );
}