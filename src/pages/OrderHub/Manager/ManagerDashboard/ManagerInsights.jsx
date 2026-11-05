import { useEffect, useState } from "react";
import { gbp } from "@/data/orderHubStore.js";
import "./ManagerCharts.css"; // reuses .mg-card, .mg-head, .mg-empty
import "./ManagerInsights.css";

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
const short = (s, n = 8) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

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
      <Stat i={1} tone="t2" icon="fa-trophy" label="Biggest Order" value={biggest} format={gbp} sub="single order" />
      <Stat i={2} tone="t3" icon="fa-crown" label="Top Client" text={top ? clientName(top[0]) : "-"} sub={top ? gbp(top[1]) : "No orders yet"} />
      <Stat i={3} tone="t4" icon="fa-shield-check" label="GPS Verified" value={pct} format={(v) => `${Math.round(v)}%`} sub={`${ok} of ${visits.length} visits`} />
    </div>
  );
}

/* ---------- 1. Visits by client (vertical bars) ---------- */
function VisitsByClient({ visits }) {
  const map = {};
  visits.forEach((v) => { const n = v.client || "Unknown"; map[n] = (map[n] || 0) + 1; });
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const W = 320, H = 190, B = 34, T = 22;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const slot = (W - 20) / Math.max(rows.length, 1);
  const bw = Math.min(34, slot * 0.6);

  return (
    <section className="mg-card mi-card">
      <header className="mg-head"><h3>Visits by Client</h3><p>How often you visited each store</p></header>
      {rows.length === 0 ? <Empty text="No visits logged." /> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mi-svg" role="img" aria-label="Visits by client">
          <line x1="10" x2={W - 10} y1={H - B} y2={H - B} className="mi-base" />
          {rows.map(([name, n], i) => {
            const h = (n / max) * (H - B - T);
            const cx = 10 + slot * i + slot / 2;
            return (
              <g key={name}>
                <rect x={cx - bw / 2} y={H - B - h} width={bw} height={h} rx="7" className="mi-vbar" style={{ "--i": i }}>
                  <title>{name}: {n} visits</title>
                </rect>
                <text x={cx} y={H - B - h - 6} textAnchor="middle" className="mi-val" style={{ animationDelay: `${0.7 + i * 0.08}s` }}>{n}</text>
                <text x={cx} y={H - 14} textAnchor="middle" className="mi-axis">{short(name)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

/* ---------- 2. Visit distance (lollipop) ---------- */
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

/* ---------- 3. Order size (histogram) ---------- */
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

/* ---------- 4. Order pipeline (centred bars) ---------- */
const STAGES = [
  { name: "Pending", key: "pend", c: "#d97706" },
  { name: "Confirmed", key: "confirm", c: "#2563eb" },
  { name: "Picking", key: "pick", c: "#e0a526" },
  { name: "Dispatched", key: "dispatch", c: "#1e2a4a" },
  { name: "Delivered", key: "deliver", c: "#2f9e6f" },
  { name: "Cancelled", key: "cancel", c: "#a1122f" },
];

function Pipeline({ orders }) {
  const rows = STAGES.map((s) => ({
    ...s,
    n: orders.filter((o) => String(o.status || "").toLowerCase().includes(s.key)).length,
  }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const done = rows.find((r) => r.key === "deliver").n;

  return (
    <section className="mg-card mi-card">
      <header className="mg-head"><h3>Order Pipeline</h3><p>{orders.length ? <><b>{done}</b> of {orders.length} delivered</> : "Orders by stage"}</p></header>
      {orders.length === 0 ? <Empty text="No orders yet." /> : (
        <ul className="mi-pipe">
          {rows.map((r, i) => (
            <li key={r.name}>
              <span className="mi-pipe-name">{r.name}</span>
              <div className="mi-pipe-track">
                <div className="mi-pipe-fill" style={{ width: `${Math.max(r.n ? 8 : 0, (r.n / max) * 100)}%`, background: r.c, animationDelay: `${0.2 + i * 0.1}s` }} />
              </div>
              <b>{r.n}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- 5. Weekly activity (radar) ---------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeeklyActivity({ orders, visits }) {
  const ord = Array(7).fill(0), vis = Array(7).fill(0);
  const dayIdx = (d) => (d.getDay() + 6) % 7;
  orders.forEach((o) => { const d = orderDate(o); if (d) ord[dayIdx(d)]++; });
  visits.forEach((v) => { const d = toDate(v.date); if (d) vis[dayIdx(d)]++; });
  const total = ord.reduce((a, b) => a + b, 0) + vis.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...ord, ...vis);

  const C = 110, R = 78;
  const pt = (i, f) => {
    const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
    return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f];
  };
  const poly = (arr) => arr.map((v, i) => pt(i, v / max).join(",")).join(" ");
  const busiest = ord.map((v, i) => v + vis[i]).reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);

  return (
    <section className="mg-card mi-card">
      <header className="mg-head"><h3>Weekly Activity</h3><p>{total ? <>Busiest day: <b>{DAYS[busiest]}</b></> : "Orders and visits by weekday"}</p></header>
      {total === 0 ? <Empty text="No dated orders or visits yet." /> : (
        <div className="mi-radar-row">
          <svg viewBox="0 0 220 220" className="mi-radar" role="img" aria-label="Orders and visits by weekday">
            {[0.33, 0.66, 1].map((f) => (
              <polygon key={f} points={DAYS.map((_, i) => pt(i, f).join(",")).join(" ")} className="mi-ring" />
            ))}
            {DAYS.map((d, i) => {
              const [x, y] = pt(i, 1);
              const [lx, ly] = pt(i, 1.2);
              return (
                <g key={d}>
                  <line x1={C} y1={C} x2={x} y2={y} className="mi-ring" />
                  <text x={lx} y={ly + 3} textAnchor="middle" className="mi-axis">{d}</text>
                </g>
              );
            })}
            <polygon points={poly(ord)} className="mi-poly mi-poly-a" />
            <polygon points={poly(vis)} className="mi-poly mi-poly-b" />
          </svg>
          <ul className="mi-legend">
            <li><i style={{ background: "#a1122f" }} />Orders <b>{ord.reduce((a, b) => a + b, 0)}</b></li>
            <li><i style={{ background: "#2563eb" }} />Visits <b>{vis.reduce((a, b) => a + b, 0)}</b></li>
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---------- export ---------- */
export default function ManagerInsights({ orders, visits, clientName, orderTotal }) {
  return (
    <>
      <Highlights orders={orders} visits={visits} clientName={clientName} orderTotal={orderTotal} />
      <div className="mi-grid mi-grid-a">
        <VisitsByClient visits={visits} />
        <VisitDistance visits={visits} />
        <OrderSize orders={orders} orderTotal={orderTotal} />
      </div>
      <div className="mi-grid mi-grid-b">
        <Pipeline orders={orders} />
        <WeeklyActivity orders={orders} visits={visits} />
      </div>
    </>
  );
}