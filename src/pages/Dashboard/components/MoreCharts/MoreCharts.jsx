import { useEffect, useState } from "react";
import "../InsightCharts/InsightCharts.css"; // shared .ic-* card styles + keyframes
import "./MoreCharts.css";

/* ---------- show / hide switches ----------
   false = hidden (code is kept), true = visible */
const SHOW = {
  cashFlow: false,   // Cash Flow
  busyHours: false,  // Busy Hours
};

/* ---------- helpers ---------- */
const gbp = (v) => (v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${Math.round(v)}`);
const jitter = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 0.9 + (h % 21) / 100; };
const scale = (base, k, tag) => base.map((v, i) => Math.round(v * k * jitter(tag + i)));

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

/* ---------- 1. Cash Flow (grouped bars) ---------- */
const CF_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const CF_IN = [48000, 53500, 58000, 56500, 63000, 67500, 64000, 72000];
const CF_OUT = [39000, 41500, 46000, 47500, 49000, 52500, 55000, 54000];

function CashFlow({ k }) {
  const inn = scale(CF_IN, k, "cfin");
  const out = scale(CF_OUT, k, "cfout");
  const [hover, setHover] = useState(null);

  const W = 640, H = 240, L = 46, R = 12, T = 12, B = 28;
  const max = Math.max(...inn) * 1.12;
  const slot = (W - L - R) / CF_MONTHS.length;
  const bw = Math.min(22, slot / 3);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const net = inn.reduce((a, b) => a + b, 0) - out.reduce((a, b) => a + b, 0);

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Cash Flow</h3><p>Net cash movement <b className="ic-good">{gbp(net)}</b></p></div>
        <div className="ic-legend">
          <span><i style={{ background: "#2f9e6f" }} />Inflow</span>
          <span><i style={{ background: "var(--maroon)" }} />Outflow</span>
        </div>
      </header>

      <div className="ic-chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="ic-svg" role="img" aria-label="Cash inflow and outflow by month">
          {[0, 1, 2, 3].map((g) => {
            const gy = T + (g * (H - T - B)) / 3;
            return (
              <g key={g}>
                <line x1={L} x2={W - R} y1={gy} y2={gy} className="ic-grid" />
                <text x={L - 8} y={gy + 4} textAnchor="end" className="ic-axis">{gbp(max * (1 - g / 3))}</text>
              </g>
            );
          })}
          {CF_MONTHS.map((m, i) => {
            const cx = L + slot * i + slot / 2;
            return (
              <g key={m} onMouseEnter={() => setHover(i)} className={hover === i ? "mc-grp on" : "mc-grp"}>
                <rect x={cx - slot / 2} y={T} width={slot} height={H - T - B} fill="transparent" />
                <rect x={cx - bw - 2} y={y(inn[i])} width={bw} height={H - B - y(inn[i])} rx="5"
                  className="mc-bar mc-in" style={{ "--i": i }} />
                <rect x={cx + 2} y={y(out[i])} width={bw} height={H - B - y(out[i])} rx="5"
                  className="mc-bar mc-out" style={{ "--i": i + 0.5 }} />
                <text x={cx} y={H - 8} textAnchor="middle" className="ic-axis">{m}</text>
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div className="ic-tip" style={{ left: `${((L + slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>{CF_MONTHS[hover]}</strong>
            <span><i style={{ background: "#2f9e6f" }} />Inflow {gbp(inn[hover])}</span>
            <span><i style={{ background: "var(--maroon)" }} />Outflow {gbp(out[hover])}</span>
            <span>Net <b>{gbp(inn[hover] - out[hover])}</b></span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 2. Receivables Ageing (stacked bar) ---------- */
const AGE = [
  { name: "Current", v: 42000, c: "#2f9e6f" },
  { name: "1-30 days", v: 21500, c: "#e0a526" },
  { name: "31-60 days", v: 12800, c: "#e5792f" },
  { name: "61-90 days", v: 6400, c: "var(--maroon)" },
  { name: "90+ days", v: 3100, c: "#6b0f24" },
];

function Ageing({ k }) {
  const vals = scale(AGE.map((a) => a.v), k, "age");
  const total = vals.reduce((a, b) => a + b, 0);
  const overdue = total - vals[0];

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Receivables Ageing</h3><p>Overdue <b className="ic-bad">{gbp(overdue)}</b> of {gbp(total)}</p></div>
      </header>
      <div className="mc-stack">
        {AGE.map((a, i) => (
          <div key={a.name} className="mc-stack-seg"
            style={{ width: `${(vals[i] / total) * 100}%`, background: a.c, animationDelay: `${0.6 + i * 0.12}s` }}
            title={`${a.name}: ${gbp(vals[i])}`} />
        ))}
      </div>
      <ul className="mc-age-list">
        {AGE.map((a, i) => (
          <li key={a.name}>
            <i style={{ background: a.c }} /><span>{a.name}</span>
            <em>{Math.round((vals[i] / total) * 100)}%</em><b>{gbp(vals[i])}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 3. Order Status (concentric rings) ---------- */
const STATUS = [
  { name: "Delivered", pct: 78, c: "#2f9e6f" },
  { name: "Dispatched", pct: 61, c: "var(--navy)" },
  { name: "Processing", pct: 44, c: "#e0a526" },
  { name: "Cancelled", pct: 12, c: "var(--maroon)" },
];

function OrderStatus({ k }) {
  const orders = Math.round(842 * k);
  const shown = useCountUp(orders);
  const radii = [52, 41, 30, 19];

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Order Status</h3><p>Fulfilment progress</p></div>
      </header>
      <div className="ic-donut-row">
        <svg viewBox="0 0 120 120" className="ic-donut" role="img" aria-label="Order status rings">
          <g transform="rotate(-90 60 60)">
            {STATUS.map((s, i) => (
              <g key={s.name}>
                <circle cx="60" cy="60" r={radii[i]} pathLength="100" className="mc-ring-track" />
                <circle cx="60" cy="60" r={radii[i]} pathLength="100" className="mc-ring"
                  style={{ stroke: s.c, strokeDasharray: `${s.pct} 100`, animationDelay: `${0.5 + i * 0.15}s` }} />
              </g>
            ))}
          </g>
          <text x="60" y="58" textAnchor="middle" className="ic-donut-big">{Math.round(shown)}</text>
          <text x="60" y="69" textAnchor="middle" className="ic-donut-sub">orders</text>
        </svg>
        <ul className="ic-donut-legend">
          {STATUS.map((s) => (
            <li key={s.name}><i style={{ background: s.c }} /><span>{s.name}</span><b>{s.pct}%</b></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 4. New Customers (area line) ---------- */
const GR_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const GR = [14, 18, 16, 22, 27, 25, 31, 36];

function CustomerGrowth({ k }) {
  const data = scale(GR, Math.max(k, 0.2), "gr");
  const total = data.reduce((a, b) => a + b, 0);
  const shown = useCountUp(total);
  const W = 300, H = 150, L = 10, R = 12, T = 14, B = 24;
  const max = Math.max(...data) * 1.15;
  const x = (i) => L + (i * (W - L - R)) / (data.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const pts = data.map((v, i) => [x(i), y(v)]);
  const line = smooth(pts);
  const area = `${line} L ${x(data.length - 1)} ${H - B} L ${x(0)} ${H - B} Z`;
  const last = pts[pts.length - 1];

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>New Customers</h3><p><b>{Math.round(shown)}</b> added in 8 months</p></div>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} className="ic-svg" role="img" aria-label="New customers by month">
        <defs>
          <linearGradient id="mcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--navy)", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "var(--navy)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="ic-grid" />
        <path d={area} fill="url(#mcArea)" className="ic-area" />
        <path d={line} pathLength="1" className="ic-line ic-line-exp" />
        <circle cx={last[0]} cy={last[1]} r="4.5" className="mc-pulse" />
        {GR_MONTHS.map((m, i) => (
          <text key={m} x={x(i)} y={H - 7} textAnchor="middle" className="ic-axis">{m}</text>
        ))}
      </svg>
    </section>
  );
}

/* ---------- 5. Busy Hours heatmap ---------- */
const HM_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HM_SLOTS = ["Morning", "Noon", "Afternoon", "Evening"];
const HM = [
  [0.45, 0.7, 0.85, 0.5], [0.5, 0.75, 0.9, 0.55], [0.4, 0.65, 0.8, 0.45], [0.55, 0.8, 0.95, 0.6],
  [0.6, 0.85, 1.0, 0.7], [0.3, 0.5, 0.55, 0.35], [0.15, 0.25, 0.3, 0.2],
];

function Heatmap({ k }) {
  const cell = (d, s) => Math.max(0.05, Math.min(1, HM[d][s] * jitter(`hm${d}${s}`) * (0.9 + (k % 0.2))));

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Busy Hours</h3><p>When orders come in</p></div>
      </header>
      <div className="mc-heat">
        <span />
        {HM_SLOTS.map((s) => <em key={s}>{s.slice(0, 3)}</em>)}
        {HM_DAYS.map((d, di) => (
          <div key={d} className="mc-heat-row">
            <em>{d}</em>
            {HM_SLOTS.map((s, si) => {
              const v = cell(di, si);
              return (
                <i key={s} className="mc-cell" title={`${d} ${s}: ${Math.round(v * 100)}% busy`}
                  style={{ "--v": v, animationDelay: `${0.6 + (di * 4 + si) * 0.025}s` }} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mc-heat-scale"><span>Quiet</span><div /><span>Busy</span></div>
    </section>
  );
}

/* ---------- export ---------- */
export default function MoreCharts({ k = 1 }) {
  /* both hidden -> the 3 remaining cards share one full row (no empty gaps) */
  if (!SHOW.cashFlow && !SHOW.busyHours) {
    return (
      <div className="grid more-grid-b">
        <Ageing k={k} />
        <OrderStatus k={k} />
        <CustomerGrowth k={k} />
      </div>
    );
  }

  return (
    <>
      <div className="grid more-grid-a">
        {SHOW.cashFlow && <CashFlow k={k} />}
        <Ageing k={k} />
      </div>
      <div className="grid more-grid-b">
        <OrderStatus k={k} />
        <CustomerGrowth k={k} />
        {SHOW.busyHours && <Heatmap k={k} />}
      </div>
    </>
  );
} 