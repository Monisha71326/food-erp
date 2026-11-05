import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import OrderDetailsModal from "@/components/OrderDetailsModal/OrderDetailsModal.jsx";
import ClientsMap from "@/components/ClientsMap/ClientsMap.jsx";
import ManagerCharts from "./ManagerCharts.jsx";
import ManagerInsights from "./ManagerInsights.jsx"; // NEW
import StoreVisitCard from "./StoreVisitCard.jsx"; // check-in / check-out
import { HubCard, HubStatus, HubButton, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import {
  useHub, manager, client, managerOrders, orderTotal, gbp, haversineKm,
  fmtDateTime, fmtClock, fmtDuration,
} from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import { useShareLocation } from "@/utils/useShareLocation.js";
import "./ManagerDashboardPage.css";

const AT_STORE_KM = 0.3;
const fmtDist = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
const ring = (km) => (km < 1 ? { v: String(Math.round(km * 1000)), u: "m" } : { v: km.toFixed(1), u: "km" });
const toneOf = (km) => (km <= 1 ? "green" : km <= 2 ? "orange" : "gray");
const wordOf = (km) => (km <= AT_STORE_KM ? "At the store" : km <= 1 ? "Very close" : km <= 2 ? "Nearby" : "Far");

/* Direction from the manager to a client: 0 = north, 90 = east (right on the map), 270 = west (left on the map) */
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
const COMPASS_SHORT = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compassOf = (deg) => COMPASS[Math.round(deg / 45) % 8];
const compassShort = (deg) => COMPASS_SHORT[Math.round(deg / 45) % 8];
const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

/* Watches the browser location while the dashboard is open.
   status: checking | unavailable | denied | error | ok      pos: { lat, lng, acc, at } */
function useMyLocation() {
  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [attempt]);

  return { pos, status, retry: () => setAttempt((n) => n + 1) };
}

/* Big "live location" card at the top */
function LocationHero({ loc }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const ok = loc.status === "ok" && loc.pos;
  const bad = ["denied", "error", "unavailable"].includes(loc.status);
  const mode = ok ? "ok" : bad ? "bad" : "wait";
  const title = ok ? "Live location is on"
    : loc.status === "denied" ? "Location permission is blocked"
    : loc.status === "unavailable" ? "Location is not available in this browser"
    : loc.status === "error" ? "Could not get your location"
    : "Getting your location...";
  const ago = ok ? Math.max(0, Math.round((Date.now() - loc.pos.at) / 1000)) : null;

  return (
    <section className={`md-hero ${mode}`}>
      <span className="md-hero-dot" aria-hidden="true"><i className={`fa-solid ${ok ? "fa-location-crosshairs" : bad ? "fa-location-pin-lock" : "fa-satellite-dish"}`} /></span>
      <div className="md-hero-text">
        <b>{title}</b>
        {ok ? (
          <small>
            <span><i className="fa-solid fa-map-pin" /> {loc.pos.lat.toFixed(4)}, {loc.pos.lng.toFixed(4)}</span>
            <span><i className="fa-solid fa-bullseye" /> Accuracy about {Math.round(loc.pos.acc)} m</span>
            <span><i className="fa-solid fa-clock" /> Updated {ago}s ago</span>
          </small>
        ) : (
          <small>{bad ? "Allow location in the browser to see the clients near you." : "Please press Allow when the browser asks."}</small>
        )}
      </div>
      {bad && <HubButton size="sm" variant="ghost" icon="fa-rotate" onClick={loc.retry}>Retry</HubButton>}
    </section>
  );
}

/* Clients near the manager, with a map, distance + direction, and a picker for one client */
function NearbyClients({ loc, clients }) {
  const [radius, setRadius] = useState("all"); // "1" | "2" | "all"
  const [pick, setPick] = useState(""); // "" = every client, otherwise one client id

  const withGeo = clients.filter((c) => c.lat != null && c.lng != null);
  const noGeo = clients.length - withGeo.length;
  const rows = loc.pos
    ? withGeo
        .map((c) => ({
          c,
          km: haversineKm(loc.pos.lat, loc.pos.lng, c.lat, c.lng),
          deg: bearing(loc.pos.lat, loc.pos.lng, c.lat, c.lng),
        }))
        .sort((a, b) => a.km - b.km)
    : [];
  const count = (km) => rows.filter((r) => r.km <= km).length;
  const byRadius = radius === "all" ? rows : rows.filter((r) => r.km <= Number(radius));
  const picked = pick ? rows.find((r) => String(r.c.id) === pick) : null;
  const shown = picked ? [picked] : byRadius;
  const nearest = rows[0];

  const chips = [
    { id: "1", label: "Within 1 km", n: count(1) },
    { id: "2", label: "Within 2 km", n: count(2) },
    { id: "all", label: "All clients", n: rows.length },
  ];

  let body;
  if (!loc.pos) {
    body = (
      <div className="md-near-msg">
        <i className={`fa-solid ${loc.status === "denied" ? "fa-location-pin-lock" : "fa-location-crosshairs"}`} />
        <p>
          {loc.status === "denied"
            ? <>Click the lock icon next to the web address, set <b>Location</b> to <b>Allow</b>, then reload the page.</>
            : loc.status === "unavailable" || loc.status === "error"
              ? "Your location could not be read. Check GPS / Wi-Fi, and open the site on https or localhost."
              : "Waiting for your location..."}
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="md-tiles">
          <div className="md-tile g"><i className="fa-solid fa-bullseye" /><div><small>Within 1 km</small><b>{count(1)}</b></div></div>
          <div className="md-tile o"><i className="fa-solid fa-circle-dot" /><div><small>Within 2 km</small><b>{count(2)}</b></div></div>
          <div className="md-tile b">
            <i className="fa-solid fa-route" />
            <div>
              <small>Nearest client</small>
              <b className="sm">{nearest ? nearest.c.name : "-"}</b>
              {nearest && <em>{fmtDist(nearest.km)} away</em>}
            </div>
          </div>
        </div>

        <div className="md-near-chips" role="group" aria-label="Distance filter">
          {chips.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={`md-near-chip${!picked && radius === ch.id ? " on" : ""}`}
              aria-pressed={!picked && radius === ch.id}
              onClick={() => { setRadius(ch.id); setPick(""); }}
            >
              {ch.label} <b>{ch.n}</b>
            </button>
          ))}
        </div>

        {rows.length > 0 && (
          <div className="md-pick-wrap">
            <span className="md-pick-label">Choose a client</span>
            <div className="md-pick" role="group" aria-label="Choose a client">
              <button type="button" className={`md-pick-item all${!picked ? " on" : ""}`} aria-pressed={!picked} onClick={() => setPick("")}>
                <span className="md-pick-ico"><i className="fa-solid fa-store" /></span>
                <span className="md-pick-txt"><b>All clients</b><small>{rows.length} stores</small></span>
              </button>
              {rows.map(({ c, km, deg }) => {
                const on = picked && picked.c.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`md-pick-item t-${toneOf(km)}${on ? " on" : ""}`}
                    aria-pressed={!!on}
                    title={c.name}
                    onClick={() => setPick(String(c.id))}
                  >
                    <span className="md-pick-ico">{initials(c.name)}</span>
                    <span className="md-pick-txt"><b>{c.name}</b><small>{fmtDist(km)} · {compassShort(deg)}</small></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {picked && (
          <div className={`md-focus t-${toneOf(picked.km)}`}>
            <span className="md-focus-arrow" aria-hidden="true">
              <i className="fa-solid fa-location-arrow" style={{ transform: `rotate(${picked.deg - 45}deg)` }} />
            </span>
            <div className="md-focus-main">
              <small>{picked.c.name} is</small>
              <b>{fmtDist(picked.km)} <em>{compassOf(picked.deg)} of you</em></b>
            </div>
            <span className="md-focus-word">{wordOf(picked.km)}</span>
          </div>
        )}

        <ClientsMap pos={loc.pos} rows={shown} />

        {shown.length === 0 ? (
          <div className="md-near-msg">
            <i className="fa-solid fa-store-slash" />
            <p>{radius === "all" ? "No client has a store location saved." : `No client store within ${radius} km of you.`}</p>
            {radius !== "all" && <HubButton size="sm" variant="ghost" onClick={() => setRadius("all")}>Show all clients</HubButton>}
          </div>
        ) : (
          <ul className="md-nc-grid">
            {shown.map(({ c, km, deg }, i) => {
              const r = ring(km);
              const addr = c.address && c.address !== "-" ? c.address : "No address saved";
              return (
                <li key={c.id} className={`md-nc t-${toneOf(km)}`} style={{ "--i": Math.min(i, 10), "--p": `${Math.max(6, Math.min(100, (1 - km / 2) * 100))}%` }}>
                  <div className="md-nc-top">
                    <span className="md-nc-ring"><b>{r.v}</b><small>{r.u}</small></span>
                    <div className="md-nc-info">
                      <b title={c.name}>{c.name}</b>
                      <small title={addr}>{addr}{c.pincode ? `, ${c.pincode}` : ""}</small>
                    </div>
                    <StatusPill tone={toneOf(km)} status={wordOf(km)} />
                  </div>
                  <div className="md-nc-bar" aria-hidden="true"><i /></div>
                  <div className="md-nc-meta">
                    <span><i className="fa-solid fa-location-arrow" style={{ transform: `rotate(${deg - 45}deg)` }} /> {compassOf(deg)} of you</span>
                    <span><i className="fa-solid fa-user" /> {c.contact || "-"}</span>
                    <span><i className="fa-solid fa-phone" /> {c.phone || "No phone"}</span>
                  </div>
                  <div className="md-nc-actions">
                    <a className="md-btn primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}>
                      <i className="fa-solid fa-diamond-turn-right" /> Directions
                    </a>
                    {c.phone && (
                      <a className="md-btn" href={`tel:${String(c.phone).replace(/\s+/g, "")}`}>
                        <i className="fa-solid fa-phone" /> Call
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {noGeo > 0 && (
          <p className="md-near-note">
            <i className="fa-solid fa-circle-info" /> {noGeo} client{noGeo === 1 ? " has" : "s have"} no store location saved, so the distance cannot be shown.
          </p>
        )}
      </>
    );
  }

  return (
    <HubCard title="Nearby Clients">
      <p className="md-near-lead muted hub-small">Client stores close to your current location, nearest first.</p>
      {body}
    </HubCard>
  );
}

export default function ManagerDashboardPage() {
  const s = useHub();
  const [selected, setSelected] = useState(null);
  const loc = useMyLocation();
  const m = manager(s.session.managerId);
  useShareLocation({ managerId: m.id, name: m.name, pos: loc.pos }); // sends the location to the server
  const orders = managerOrders(m.id);
  const total = orders.reduce((sum, o) => sum + orderTotal(o), 0);
  const covered = m.clientIds.map((id) => client(id)).filter(Boolean);

  const items = [
    { label: "Visits This Week", value: m.visits.length, dec: 0, icon: "fa-location-dot", tone: "blue" },
    { label: "Orders", value: orders.length, dec: 0, icon: "fa-bag-shopping", tone: "purple" },
    { label: "Total Sale Value", value: total, dec: 2, money: true, icon: "fa-sterling-sign", tone: "green" },
    { label: "Clients Covered", value: m.clientIds.length, dec: 0, icon: "fa-store", tone: "orange" },
  ];
  const columns = [
    { key: "id", label: "Order", sortable: true, render: (r) => <TableLink onClick={() => setSelected(r)}>{r.id}</TableLink> },
    { key: "client", label: "Client", render: (r) => client(r.clientId)?.name || "-" },
    { key: "total", label: "Total", align: "right", sortable: true, sortValue: orderTotal, render: (r) => gbp(orderTotal(r)) },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
  ];

  const clientName = (id) => client(id)?.name || "Unknown";

  return (
    <div className="page-anim manager-dashboard-page">
      <PageHeader eyebrow="AREA MANAGER" title={`${m.name}'s Dashboard`} subtitle={`Covering ${covered.map((c) => c.name).join(", ")}`} icon="fa-gauge-high" actions={<ViewingAs kind="manager" />} showPrint={false} />

      <LocationHero loc={loc} />
      <SummaryStrip items={items} columns={4} />

      {/* Enter store / Leave store (check-in / check-out) */}
      <StoreVisitCard m={m} loc={loc} />

      <div className="md-near">
        <NearbyClients loc={loc} clients={covered} />
      </div>

      {/* Animated charts from this manager's real orders + visits */}
      <ManagerCharts
        orders={orders}
        visits={m.visits}
        clientName={clientName}
        orderTotal={orderTotal}
      />

      {/* NEW: highlight cards + more animated charts */}
      <ManagerInsights
        orders={orders}
        visits={m.visits}
        clientName={clientName}
        orderTotal={orderTotal}
      />

      <div className="hub-grid cols-2 md-grid">
        <HubCard title="Visit Log">
          {m.visits.length ? (
            <ul className="md-visits">
              {m.visits.map((v, i) => (
                <li key={v.id || i}>
                  {v.photoDataUrl ? <img src={v.photoDataUrl} alt="Store visit" /> : <span className="md-nophoto"><i className="fa-solid fa-store" /></span>}
                  <div>
                    <div className="hub-row">
                      <b>{v.client}</b>
                      {v.checkIn && !v.checkOut
                        ? <StatusPill tone="orange" status="In store" />
                        : <StatusPill tone={v.verified ? "green" : "gray"} status={v.verified ? "GPS verified" : "Unverified"} />}
                    </div>
                    {v.checkIn ? (
                      <p className="muted hub-small">
                        In: {fmtDateTime(v.checkIn)}
                        {v.checkOut ? ` · Out: ${fmtClock(v.checkOut)} · ${fmtDuration(v.durationMin)}` : " · still in store"}
                        {v.distanceKm != null ? ` · ${v.distanceKm.toFixed(2)}km from store` : ""}
                      </p>
                    ) : (
                      <p className="muted hub-small">
                        {fmtDate(v.date)}{v.time ? ` - ${v.time}` : ""}{v.distanceKm != null ? ` - ${v.distanceKm.toFixed(2)}km from store` : ""}
                      </p>
                    )}
                    {v.note && <p className="muted hub-small">Check-in remark: {v.note}</p>}
                    {v.checkOutRemark && <p className="muted hub-small">Check-out remark: {v.checkOutRemark}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No visits logged.</p>}
        </HubCard>
        <HubCard title="Recent Orders">
          <DataTable columns={columns} rows={orders.slice(0, 6)} entity="orders" searchPlaceholder="Search orders" />
        </HubCard>
      </div>

      {selected && <OrderDetailsModal order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}