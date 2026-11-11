import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { gbp } from "@/data/orderHubStore.js";
import "./ManagerCharts.css"; // reuses .mg-card, .mg-head, .mg-empty
import "./ManagerInsights.css";

/* true = show, false = hide */
const SHOW_BIGGEST_ORDER = false;
const SHOW_GPS_VERIFIED = false;
const SHOW_VISIT_DISTANCE = false; // Visit Distance card
const SHOW_ORDER_SIZE = false;     // Order Size card

/* ---------- helpers ---------- */
function useCountUp(target, dur = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (t) => {
      start ??= t;
      const p = Math.min(1, (t - start) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

const Empty = ({ text }) => <p className="mg-empty">{text}</p>;
const toDate = (x) => { if (!x) return null; const d = new Date(x); return isNaN(d) ? null : d; };
const orderDate = (o) => toDate(o.date || o.createdAt || o.placedAt || o.orderDate);

/* ---------- highlight cards ---------- */
function Stat({ icon, tone, label, value, format, text, sub, i }) {
  const shown = useCountUp(value || 0);
  return (
    <div className={`mi-stat ${tone}`} style={{ "--i": i }}>
      <span className="mi-stat-ico"><i className={`fa-solid ${icon}`} /></span>
      <div className="mi-stat-body">
        <small>{label}</small>
        <b title={text || ""}>{text != null ? text : format(shown)}</b>
        {sub && <em>{sub}</em>}
      </div>
    </div>
  );
}

function Highlights({ orders, visits, clientName, orderTotal }) {
  const totals = orders.map((o) => orderTotal(o));
  const sum = totals.reduce((a, b) => a + b, 0);
  const avg = totals.length ? sum / totals.length : 0;
  const biggest = totals.length ? Math.max(...totals) : 0;

  const byClient = {};
  orders.forEach((o) => { byClient[o.clientId] = (byClient[o.clientId] || 0) + orderTotal(o); });
  const top = Object.entries(byClient).sort((a, b) => b[1] - a[1])[0];

  const ok = visits.filter((v) => v.verified).length;
  const pct = visits.length ? Math.round((ok / visits.length) * 100) : 0;

  return (
    <div className="mi-stats">
      <Stat i={0} tone="t1" icon="fa-receipt" label="Average Order" value={avg} format={gbp} sub={`${orders.length} orders`} />
      {SHOW_BIGGEST_ORDER && (
        <Stat i={1} tone="t2" icon="fa-trophy" label="Biggest Order" value={biggest} format={gbp} sub="single order" />
      )}
      <Stat i={2} tone="t3" icon="fa-crown" label="Top Client" text={top ? clientName(top[0]) : "-"} sub={top ? gbp(top[1]) : "No orders yet"} />
      {SHOW_GPS_VERIFIED && (
        <Stat i={3} tone="t4" icon="fa-shield-check" label="GPS Verified" value={pct} format={(v) => `${Math.round(v)}%`} sub={`${ok} of ${visits.length} visits`} />
      )}
    </div>
  );
}

/* ---------- 1. Visits by client (ring strip + scrollable tiles + popup) ---------- */
const VL_COLORS = ["#a1122f", "#1e2a4a", "#e0a526", "#2f9e6f", "#2563eb", "#8b94a7"];
const initialsOf = (name) =>
  String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const fmtDay = (d) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-");
const fmtWhen = (d, hasTime) =>
  !d ? "-" : hasTime
    ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : fmtDay(d);
const fmtClock = (d) => (d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-");
const fmtMin = (m) => {
  if (m == null || isNaN(m)) return "-";
  const t = Math.round(m);
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60), r = t % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};
const fmtKm = (k) => (k == null ? "-" : k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1)} km`);
const statusTone = (s) => {
  const t = String(s || "").toLowerCase();
  if (t.includes("deliver")) return "#2f9e6f";
  if (t.includes("dispatch") || t.includes("delivery") || t.includes("ship")) return "#1e2a4a";
  if (t.includes("pick") || t.includes("process")) return "#e0a526";
  if (t.includes("pend") || t.includes("placed")) return "#d97706";
  if (t.includes("confirm")) return "#2563eb";
  if (t.includes("cancel") || t.includes("reject")) return "#a1122f";
  return "#8b94a7";
};

function VisitModal({ row, color, orderTotal, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const tiles = [
    { icon: "fa-location-dot", label: "Total Visits", value: row.n },
    { icon: "fa-shield-check", label: "GPS Verified", value: `${row.ok}/${row.n}` },
    { icon: "fa-location-crosshairs", label: "Avg Distance", value: fmtKm(row.avgDist) },
    { icon: "fa-hourglass-half", label: "Time in Store", value: row.mins ? fmtMin(row.mins) : "-" },
    { icon: "fa-bag-shopping", label: "Orders", value: row.orders.length },
    { icon: "fa-sterling-sign", label: "Order Value", value: gbp(row.sum) },
  ];

  return createPortal(
    <div className="mi-modal-back" onClick={onClose} role="presentation">
      <div
        className="mi-modal"
        style={{ "--c": color }}
        role="dialog"
        aria-modal="true"
        aria-label={`${row.name} visit details`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mi-modal-head">
          <span className="mi-modal-ava">{initialsOf(row.name)}</span>
          <div className="mi-modal-title">
            <h3>{row.name}</h3>
            {row.active
              ? <span className="mi-vl-badge live"><i className="fa-solid fa-circle" /> In store now</span>
              : <span className="mi-modal-sub"><i className="fa-solid fa-clock" /> Last visit: {fmtWhen(row.last?.d, row.last?.hasTime)}</span>}
          </div>
          <button type="button" className="mi-modal-x" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="mi-modal-body">
          <div className="mi-modal-tiles">
            {tiles.map((t) => (
              <div className="mi-modal-tile" key={t.label}>
                <span><i className={`fa-solid ${t.icon}`} /></span>
                <div><small>{t.label}</small><b>{t.value}</b></div>
              </div>
            ))}
          </div>

          <h4 className="mi-modal-h">Visit Timeline <em>{row.list.length}</em></h4>
          <ul className="mi-tl">
            {row.list.map(({ v, d, hasTime }, k) => {
              const inStore = v.checkIn && !v.checkOut;
              return (
                <li key={v.id || k}>
                  <span className={`mi-tl-dot ${v.verified ? "ok" : ""}`} />
                  <div className="mi-tl-card">
                    <div className="mi-tl-top">
                      <b>{fmtWhen(d, hasTime)}</b>
                      <span className={`mi-pill ${v.verified ? "ok" : "no"}`}>
                        {v.verified ? "GPS verified" : "Unverified"}
                      </span>
                    </div>
                    <div className="mi-tl-meta">
                      {v.checkIn && (
                        <span><i className="fa-solid fa-right-to-bracket" /> In {fmtClock(toDate(v.checkIn))}</span>
                      )}
                      {v.checkOut && (
                        <span><i className="fa-solid fa-right-from-bracket" /> Out {fmtClock(toDate(v.checkOut))}</span>
                      )}
                      {inStore && <span className="mi-vl-badge live"><i className="fa-solid fa-circle" /> still in store</span>}
                      {v.checkIn && v.checkOut && (
                        <span><i className="fa-solid fa-hourglass-half" /> {fmtMin(v.durationMin)}</span>
                      )}
                      {v.distanceKm != null && (
                        <span><i className="fa-solid fa-location-crosshairs" /> {v.distanceKm.toFixed(2)} km from store</span>
                      )}
                    </div>
                    {v.note && <p><i className="fa-solid fa-comment-dots" /> <b>Check-in:</b> {v.note}</p>}
                    {v.checkOutRemark && <p><i className="fa-solid fa-comment" /> <b>Check-out:</b> {v.checkOutRemark}</p>}
                  </div>
                </li>
              );
            })}
          </ul>

          <h4 className="mi-modal-h">Orders <em>{row.orders.length}</em></h4>
          {row.orders.length === 0 ? (
            <p className="mi-modal-empty">No orders for this client.</p>
          ) : (
            <ul className="mi-ol">
              {row.orders.map((o, k) => (
                <li key={o.id || k}>
                  <b>{o.id}</b>
                  <span className="mi-pill" style={{ "--p": statusTone(o.status) }}>{o.status || "-"}</span>
                  <strong>{gbp(orderTotal(o))}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VisitsByClient({ visits, orders, clientName, orderTotal }) {
  const [openName, setOpenName] = useState(null);
  const [hot, setHot] = useState(null);

  const map = {};
  visits.forEach((v) => {
    const name = v.client || "Unknown";
    const e = map[name] || (map[name] = { name, n: 0, ok: 0, dist: [], mins: 0, active: false, list: [] });
    const d = toDate(v.checkIn || v.date);
    e.n += 1;
    if (v.verified) e.ok += 1;
    if (v.distanceKm != null) e.dist.push(v.distanceKm);
    if (v.durationMin != null) e.mins += v.durationMin;
    if (v.checkIn && !v.checkOut) e.active = true;
    e.list.push({ v, d, hasTime: !!v.checkIn });
  });

  /* no slice: every store is listed, the list scrolls inside the card */
  const rows = Object.values(map)
    .map((e) => {
      e.list.sort((a, b) => (b.d?.getTime() || 0) - (a.d?.getTime() || 0));
      const own = orders.filter((o) => clientName(o.clientId) === e.name);
      return {
        ...e,
        last: e.list[0],
        avgDist: e.dist.length ? e.dist.reduce((a, b) => a + b, 0) / e.dist.length : null,
        orders: own,
        sum: own.reduce((s, o) => s + orderTotal(o), 0),
      };
    })
    .sort((a, b) => b.n - a.n);

  const total = visits.length;
  const verified = visits.filter((v) => v.verified).length;
  const max = Math.max(1, ...rows.map((r) => r.n));
  const openIdx = rows.findIndex((r) => r.name === openName);
  const openRow = openIdx >= 0 ? rows[openIdx] : null;

  /* mini ring */
  const R = 52, CIRC = 2 * Math.PI * R;
  let acc = 0;
  const segs = rows.map((r, i) => {
    const len = (r.n / Math.max(total, 1)) * CIRC;
    const s = { i, name: r.name, len: Math.max(0, len - (rows.length > 1 ? 3 : 0)), off: acc };
    acc += len;
    return s;
  });
  const cur = hot !== null ? rows[hot] : null;

  return (
    <section className="mg-card mi-card mi-vc">
      <header className="mg-head">
        <h3>Visits by Client</h3>
        <p>{total ? "Click a store for the full visit timeline" : "How often you visited each store"}</p>
      </header>

      {rows.length === 0 ? <Empty text="No visits logged." /> : (
        <>
          <div className="mi-vc-strip">
            <svg viewBox="0 0 140 140" className="mi-vc-ring" role="img" aria-label="Visit share by client">
              <g transform="rotate(-90 70 70)">
                <circle cx="70" cy="70" r={R} className="mi-vc-track" />
                {segs.map((s) => (
                  <circle
                    key={s.name}
                    cx="70" cy="70" r={R}
                    className={`mi-vc-seg${hot === s.i ? " on" : ""}`}
                    style={{ stroke: VL_COLORS[s.i % VL_COLORS.length], strokeDasharray: `${s.len} ${CIRC - s.len}`, strokeDashoffset: -s.off, "--circ": CIRC, animationDelay: `${0.15 + s.i * 0.12}s` }}
                  />
                ))}
              </g>
              <text x="70" y="78" textAnchor="middle" className="mi-vc-big">{cur ? cur.n : total}</text>
            </svg>
            <div className="mi-vc-facts">
              <div><b>{rows.length}</b><small>stores</small></div>
              <div><b>{verified}</b><small>verified</small></div>
              <div><b>{total - verified}</b><small>unverified</small></div>
            </div>
          </div>

          <ul className="mi-vc-list">
            {rows.map((r, i) => {
              const col = VL_COLORS[i % VL_COLORS.length];
              const share = Math.round((r.n / Math.max(total, 1)) * 100);
              return (
                <li key={r.name} style={{ "--i": Math.min(i, 8), "--c": col }}>
                  <button
                    type="button"
                    className="mi-vc-tile"
                    onClick={() => setOpenName(r.name)}
                    onMouseEnter={() => setHot(i)}
                    onMouseLeave={() => setHot(null)}
                    aria-haspopup="dialog"
                  >
                    <span className="mi-vc-ava">{initialsOf(r.name)}</span>
                    <div className="mi-vc-mid">
                      <b title={r.name}>{r.name}</b>
                      {r.active
                        ? <span className="mi-vl-badge live"><i className="fa-solid fa-circle" /> In store now</span>
                        : <small>{fmtDay(r.last?.d)} · {r.ok} verified · {r.orders.length} orders</small>}
                      <div className="mi-vc-bar"><i style={{ width: `${(r.n / max) * 100}%` }} /></div>
                    </div>
                    <div className="mi-vc-cnt">
                      <strong>{r.n}</strong>
                      <small>{share}%</small>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {openRow && (
        <VisitModal
          row={openRow}
          color={VL_COLORS[openIdx % VL_COLORS.length]}
          orderTotal={orderTotal}
          onClose={() => setOpenName(null)}
        />
      )}
    </section>
  );
}

/* ---------- 2. Visit distance (lollipop) - hidden by SHOW_VISIT_DISTANCE ---------- */
function VisitDistance({ visits }) {
  const list = visits.filter((v) => v.distanceKm != null).slice(0, 10);
  const W = 320, H = 190, L = 34, R = 10, T = 16, B = 30;
  const max = Math.max(0.5, ...list.map((v) => v.distanceKm)) * 1.15;
  const y = (k) => T + (1 - k / max) * (H - T - B);
  const slot = (W - L - R) / Math.max(list.length, 1);
  const near = list.filter((v) => v.distanceKm <= 0.3).length;

  return (
    <section className="mg-card mi-card">
      <header className="mg-head"><h3>Visit Distance</h3><p>{list.length ? <><b>{near}</b> of {list.length} within 300 m of the store</> : "Distance from store at check-in"}</p></header>
      {list.length === 0 ? <Empty text="No visit distance recorded." /> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mi-svg" role="img" aria-label="Distance from store for each visit">
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="mi-base" />
          <line x1={L} x2={W - R} y1={y(0.3)} y2={y(0.3)} className="mi-thresh" />
          <text x={L - 4} y={y(0.3) + 3} textAnchor="end" className="mi-axis">0.3</text>
          <text x={L - 4} y={T + 3} textAnchor="end" className="mi-axis">{max.toFixed(1)}</text>
          <text x={L - 4} y={H - B + 3} textAnchor="end" className="mi-axis">0</text>
          {list.map((v, i) => {
            const cx = L + slot * i + slot / 2;
            const good = v.distanceKm <= 0.3;
            const col = good ? "#2f9e6f" : "#d97706";
            const top = y(v.distanceKm);
            return (
              <g key={i}>
                <rect x={cx - 1} y={top} width="2" height={H - B - top} className="mi-stem" style={{ fill: col, "--i": i }} />
                <circle cx={cx} cy={top} r="6" className="mi-pop" style={{ fill: col, "--i": i }}>
                  <title>{v.client}: {v.distanceKm.toFixed(2)} km</title>
                </circle>
                <text x={cx} y={H - 12} textAnchor="middle" className="mi-axis">{i + 1}</text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

/* ---------- 3. Order size (histogram) - hidden by SHOW_ORDER_SIZE ---------- */
function OrderSize({ orders, orderTotal }) {
  const vals = orders.map((o) => orderTotal(o));
  const W = 320, H = 190, B = 34, T = 22;

  let buckets = [];
  if (vals.length) {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const n = hi === lo ? 1 : 5;
    const step = (hi - lo) / n || 1;
    buckets = Array.from({ length: n }, (_, i) => ({ lo: lo + step * i, n: 0 }));
    vals.forEach((v) => { buckets[Math.min(n - 1, Math.floor((v - lo) / step))].n++; });
  }
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const best = buckets.reduce((bi, b, i, a) => (b.n > a[bi].n ? i : bi), 0);
  const slot = (W - 20) / Math.max(buckets.length, 1);

  return (
    <section className="mg-card mi-card">
      <header className="mg-head"><h3>Order Size</h3><p>How many orders fall in each value range</p></header>
      {buckets.length === 0 ? <Empty text="No orders yet." /> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mi-svg" role="img" aria-label="Order value histogram">
          <line x1="10" x2={W - 10} y1={H - B} y2={H - B} className="mi-base" />
          {buckets.map((b, i) => {
            const h = (b.n / max) * (H - B - T);
            const x = 10 + slot * i + 3;
            return (
              <g key={i}>
                <rect x={x} y={H - B - h} width={slot - 6} height={h} rx="6" className={`mi-vbar ${i === best ? "best" : ""}`} style={{ "--i": i }}>
                  <title>{b.n} orders from {gbp(b.lo)}</title>
                </rect>
                <text x={x + (slot - 6) / 2} y={H - B - h - 6} textAnchor="middle" className="mi-val" style={{ animationDelay: `${0.7 + i * 0.08}s` }}>{b.n}</text>
                <text x={x + (slot - 6) / 2} y={H - 14} textAnchor="middle" className="mi-axis">{gbp(b.lo)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

/* ---------- 4. Order pipeline (hero bar + one-line stage rows) ---------- */
const STAGES = [
  { name: "Placed", icon: "fa-clipboard-list", c: "#d97706" },
  { name: "With Delivery Partner", icon: "fa-truck", c: "#1e2a4a" },
  { name: "Partially Delivered", icon: "fa-box-open", c: "#e0a526" },
  { name: "Delivered & Invoiced", icon: "fa-circle-check", c: "#2f9e6f" },
];

function Pipeline({ orders }) {
  const total = orders.length;
  const rows = STAGES.map((s) => ({ ...s, n: orders.filter((o) => o.status === s.name).length }));
  const done = rows[rows.length - 1].n;
  const pctDone = total ? Math.round((done / total) * 100) : 0;

  return (
    <section className="mg-card mi-card mi-pp">
      <header className="mg-head">
        <h3>Order Pipeline</h3>
        <p>{total ? <><b>{done}</b> of {total} delivered</> : "Orders by stage"}</p>
      </header>

      {total === 0 ? <Empty text="No orders yet." /> : (
        <>
          <div className="mi-pp-hero">
            <div className="mi-pp-big"><strong>{pctDone}</strong><span>%</span><small>done</small></div>
            <div className="mi-pp-stack" role="img" aria-label="Orders by stage">
              {rows.map((r, i) => (
                <i
                  key={r.name}
                  title={`${r.name}: ${r.n}`}
                  style={{ flexGrow: r.n, background: r.c, animationDelay: `${0.15 + i * 0.1}s` }}
                />
              ))}
            </div>
          </div>

          <ul className="mi-pp-list">
            {rows.map((r, i) => {
              const pct = Math.round((r.n / total) * 100);
              return (
                <li key={r.name} className="mi-pp-row" style={{ "--c": r.c, "--i": i }}>
                  <span className="mi-pp-ico"><i className={`fa-solid ${r.icon}`} /></span>
                  <div className="mi-pp-main">
                    <div className="mi-pp-line">
                      <b title={r.name}>{r.name}</b>
                      <strong>{r.n}</strong>
                    </div>
                    <div className="mi-pp-bar"><i style={{ width: `${pct}%` }} /></div>
                  </div>
                  <em>{pct}%</em>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------- 5. Weekly activity (vertical bars: orders + visits per day) ---------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeeklyActivity({ orders, visits }) {
  const ord = Array(7).fill(0), vis = Array(7).fill(0);
  const dayIdx = (d) => (d.getDay() + 6) % 7;
  orders.forEach((o) => { const d = orderDate(o); if (d) ord[dayIdx(d)]++; });
  visits.forEach((v) => { const d = toDate(v.date); if (d) vis[dayIdx(d)]++; });
  const tot = ord.map((v, i) => v + vis[i]);
  const total = tot.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...ord, ...vis);
  const sumOrd = ord.reduce((a, b) => a + b, 0);
  const sumVis = vis.reduce((a, b) => a + b, 0);
  const busiest = tot.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);

  return (
    <section className="mg-card mi-card mi-wk">
      <header className="mg-head"><h3>Weekly Activity</h3><p>Orders and visits by weekday</p></header>
      {total === 0 ? <Empty text="No dated orders or visits yet." /> : (
        <>
          <div className="mi-wk-top">
            <div className="mi-wk-hero">
              <span className="mi-wk-ico"><i className="fa-solid fa-fire" /></span>
              <div>
                <small>Busiest day</small>
                <strong>{DAYS[busiest]}</strong>
              </div>
              <em>{tot[busiest]} total</em>
            </div>
            <ul className="mi-legend">
              <li><i style={{ background: "#a1122f" }} />Orders <b>{sumOrd}</b></li>
              <li><i style={{ background: "#2563eb" }} />Visits <b>{sumVis}</b></li>
            </ul>
          </div>

          <div className="mi-wk-chart" role="img" aria-label="Orders and visits by weekday">
            {DAYS.map((d, i) => (
              <div key={d} className={`mi-wk-col${i === busiest ? " top" : ""}`} style={{ "--i": i }}>
                <div className="mi-wk-bars">
                  <span className="mi-wk-bw a" style={{ height: `${(ord[i] / max) * 100}%` }} title={`${d} orders: ${ord[i]}`}>
                    {ord[i] > 0 && <b>{ord[i]}</b>}<i />
                  </span>
                  <span className="mi-wk-bw b" style={{ height: `${(vis[i] / max) * 100}%` }} title={`${d} visits: ${vis[i]}`}>
                    {vis[i] > 0 && <b>{vis[i]}</b>}<i />
                  </span>
                </div>
                <small>{d}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- export: ONE flowing grid - add any new card inside it ---------- */
export default function ManagerInsights({ orders, visits, clientName, orderTotal }) {
  return (
    <>
      <Highlights orders={orders} visits={visits} clientName={clientName} orderTotal={orderTotal} />
      <div className="mi-grid">
        <VisitsByClient visits={visits} orders={orders} clientName={clientName} orderTotal={orderTotal} />
        <Pipeline orders={orders} />
        <WeeklyActivity orders={orders} visits={visits} />
        {SHOW_VISIT_DISTANCE && <VisitDistance visits={visits} />}
        {SHOW_ORDER_SIZE && <OrderSize orders={orders} orderTotal={orderTotal} />}
      </div>
    </>
  );
}