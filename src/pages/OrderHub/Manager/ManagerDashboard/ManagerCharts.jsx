import { useEffect, useState } from "react";
import { gbp } from "@/data/orderHubStore.js";
import "./ManagerCharts.css";

const PALETTE = ["#a1122f", "#1e2a4a", "#e0a526", "#2f9e6f", "#2563eb", "#8b94a7"];

const statusColor = (s) => {
  const t = String(s || "").toLowerCase();
  if (t.includes("deliver")) return "#2f9e6f";
  if (t.includes("dispatch") || t.includes("ship")) return "#1e2a4a";
  if (t.includes("pick") || t.includes("process")) return "#e0a526";
  if (t.includes("pend")) return "#d97706";
  if (t.includes("confirm")) return "#2563eb";
  if (t.includes("cancel") || t.includes("reject")) return "#a1122f";
  return "#8b94a7";
};

function useCountUp(target, dur = 1100) {
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

const smooth = (pts) =>
  pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, "");

const Empty = ({ text }) => <p className="mg-empty">{text}</p>;

/* ---------- 1. Sales by client (horizontal bars) ---------- */
function SalesByClient({ orders, clientName, orderTotal }) {
  const map = {};
  orders.forEach((o) => { map[o.clientId] = (map[o.clientId] || 0) + orderTotal(o); });
  const rows = Object.entries(map)
    .map(([id, v]) => ({ name: clientName(id), v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.v));

  return (
    <section className="mg-card">
      <header className="mg-head"><h3>Sales by Client</h3><p>Total order value per store</p></header>
      {rows.length === 0 ? <Empty text="No orders yet." /> : (
        <ul className="mg-hbars">
          {rows.map((r, i) => (
            <li key={r.name + i}>
              <div className="mg-hbar-top"><span title={r.name}>{r.name}</span><b>{gbp(r.v)}</b></div>
              <div className="mg-hbar-track">
                <div className="mg-hbar-fill" style={{ width: `${(r.v / max) * 100}%`, background: PALETTE[i % PALETTE.length], animationDelay: `${0.15 + i * 0.1}s` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- 2. Order status (donut) ---------- */
function OrderStatus({ orders }) {
  const [active, setActive] = useState(null);
  const counts = {};
  orders.forEach((o) => { const s = o.status || "Unknown"; counts[s] = (counts[s] || 0) + 1; });
  const items = Object.entries(counts).map(([name, v]) => ({ name, v, c: statusColor(name) }));
  const sum = items.reduce((a, b) => a + b.v, 0);
  const R = 44, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = items.map((s, i) => {
    const len = (s.v / sum) * C;
    const seg = { ...s, i, len: Math.max(0, len - (items.length > 1 ? 2.5 : 0)), off: acc };
    acc += len;
    return seg;
  });
  const cur = active !== null ? segs[active] : null;

  return (
    <section className="mg-card">
      <header className="mg-head"><h3>Order Status</h3><p>Where your orders are now</p></header>
      {sum === 0 ? <Empty text="No orders yet." /> : (
        <div className="mg-donut-row">
          <svg viewBox="0 0 120 120" className="mg-donut" role="img" aria-label="Orders by status">
            <g transform="rotate(-90 60 60)">
              <circle cx="60" cy="60" r={R} className="mg-track" />
              {segs.map((s) => (
                <circle key={s.name} cx="60" cy="60" r={R} className={`mg-seg ${active === s.i ? "on" : ""}`}
                  style={{ stroke: s.c, strokeDasharray: `${s.len} ${C - s.len}`, strokeDashoffset: -s.off, "--c": C, animationDelay: `${0.15 + s.i * 0.12}s` }}
                  onMouseEnter={() => setActive(s.i)} onMouseLeave={() => setActive(null)} />
              ))}
            </g>
            <text x="60" y="58" textAnchor="middle" className="mg-donut-big">{cur ? cur.v : sum}</text>
            <text x="60" y="72" textAnchor="middle" className="mg-donut-sub">{cur ? cur.name : "orders"}</text>
          </svg>
          <ul className="mg-legend">
            {segs.map((s) => (
              <li key={s.name} className={active === s.i ? "on" : ""} onMouseEnter={() => setActive(s.i)} onMouseLeave={() => setActive(null)}>
                <i style={{ background: s.c }} /><span>{s.name}</span><b>{s.v}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---------- 3. Recent order value (line) ---------- */
function OrderValueTrend({ orders, orderTotal }) {
  const list = orders.slice(0, 8).reverse();
  const vals = list.map((o) => orderTotal(o));
  const W = 320, H = 170, L = 12, R = 14, T = 16, B = 26;
  const [hover, setHover] = useState(null);

  if (list.length < 2) {
    return (
      <section className="mg-card">
        <header className="mg-head"><h3>Recent Order Value</h3><p>Last orders, oldest to newest</p></header>
        <Empty text="Need at least 2 orders to draw a trend." />
      </section>
    );
  }

  const max = Math.max(...vals, 1) * 1.15;
  const x = (i) => L + (i * (W - L - R)) / (vals.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const line = smooth(pts);
  const area = `${line} L ${x(vals.length - 1)} ${H - B} L ${x(0)} ${H - B} Z`;
  const last = pts[pts.length - 1];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

  return (
    <section className="mg-card">
      <header className="mg-head"><h3>Recent Order Value</h3><p>Average <b>{gbp(avg)}</b> per order</p></header>
      <div className="mg-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="mg-svg" role="img" aria-label="Value of recent orders">
          <defs>
            <linearGradient id="mgArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "#a1122f", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "#a1122f", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="mg-grid" />
          <path d={area} fill="url(#mgArea)" className="mg-area" />
          <path d={line} pathLength="1" className="mg-line" />
          {hover !== null && <circle cx={pts[hover][0]} cy={pts[hover][1]} r="5" className="mg-dot" />}
          <circle cx={last[0]} cy={last[1]} r="4.5" className="mg-pulse" />
          {list.map((o, i) => (
            <g key={o.id}>
              <text x={x(i)} y={H - 8} textAnchor="middle" className="mg-axis">{String(o.id).slice(-4)}</text>
              <rect x={x(i) - 14} y={T} width="28" height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div className="mg-tip" style={{ left: `${(pts[hover][0] / W) * 100}%` }}>
            <strong>{list[hover].id}</strong><span>{gbp(vals[hover])}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 4. Visit verification (gauge) ---------- */
function VisitGauge({ visits }) {
  const total = visits.length;
  const ok = visits.filter((v) => v.verified).length;
  const pct = total ? Math.round((ok / total) * 100) : 0;
  const shown = useCountUp(pct);

  return (
    <section className="mg-card">
      <header className="mg-head"><h3>Visit Verification</h3><p>GPS verified store visits</p></header>
      {total === 0 ? <Empty text="No visits logged." /> : (
        <div className="mg-gauge-wrap">
          <svg viewBox="0 0 200 118" className="mg-gauge" role="img" aria-label={`${pct}% of visits GPS verified`}>
            <defs>
              <linearGradient id="mgGauge" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#2f9e6f" />
              </linearGradient>
            </defs>
            <path d="M 20 100 A 80 80 0 0 1 180 100" pathLength="100" className="mg-gauge-track" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" pathLength="100" className="mg-gauge-val" style={{ strokeDashoffset: 100 - pct }} />
            <text x="100" y="86" textAnchor="middle" className="mg-gauge-big">{Math.round(shown)}%</text>
            <text x="100" y="104" textAnchor="middle" className="mg-donut-sub">verified</text>
          </svg>
          <div className="mg-gauge-foot">
            <span><i style={{ background: "#2f9e6f" }} />Verified <b>{ok}</b></span>
            <span><i style={{ background: "#8b94a7" }} />Unverified <b>{total - ok}</b></span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- export ---------- */
export default function ManagerCharts({ orders, visits, clientName, orderTotal }) {
  return (
    <div className="mg-grid">
      <SalesByClient orders={orders} clientName={clientName} orderTotal={orderTotal} />
      <OrderStatus orders={orders} />
      <OrderValueTrend orders={orders} orderTotal={orderTotal} />
      <VisitGauge visits={visits} />
    </div>
  );
}