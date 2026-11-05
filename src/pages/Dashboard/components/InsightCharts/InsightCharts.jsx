import { useEffect, useState } from "react";
import "./InsightCharts.css";

/* ---------- helpers ---------- */
const gbp = (v) => (v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${Math.round(v)}`);
const PALETTE = ["var(--maroon)", "var(--navy)", "#e0a526", "#2f9e6f", "#8b94a7"];

/* same label -> same small variation, so charts do not all move together */
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

/* smooth curve through points */
const smooth = (pts) =>
  pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, "");

/* ---------- 1. Revenue vs Expenses (line + area) ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REV = [42000, 46500, 44000, 52000, 57500, 55000, 61000, 64500, 60000, 68000, 72500, 78000];
const EXP = [31000, 33500, 32000, 36500, 39000, 38000, 41500, 43000, 41000, 45500, 47000, 50500];

function RevenueExpenses({ k }) {
  const rev = scale(REV, k, "rev");
  const exp = scale(EXP, k, "exp");
  const [hover, setHover] = useState(null);

  const W = 640, H = 250, L = 46, R = 14, T = 14, B = 28;
  const max = Math.max(...rev) * 1.12;
  const x = (i) => L + (i * (W - L - R)) / (MONTHS.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const rp = rev.map((v, i) => [x(i), y(v)]);
  const ep = exp.map((v, i) => [x(i), y(v)]);
  const rLine = smooth(rp);
  const rArea = `${rLine} L ${x(MONTHS.length - 1)} ${H - B} L ${x(0)} ${H - B} Z`;
  const totalRev = rev.reduce((a, b) => a + b, 0);
  const totalExp = exp.reduce((a, b) => a + b, 0);

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div>
          <h3>Revenue vs Expenses</h3>
          <p>Net profit <b className="ic-good">{gbp(totalRev - totalExp)}</b></p>
        </div>
        <div className="ic-legend">
          <span><i style={{ background: "var(--maroon)" }} />Revenue</span>
          <span><i style={{ background: "var(--navy)" }} />Expenses</span>
        </div>
      </header>

      <div className="ic-chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="ic-svg" role="img" aria-label="Revenue versus expenses by month">
          <defs>
            <linearGradient id="icArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--maroon)", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "var(--maroon)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3].map((g) => {
            const gy = T + (g * (H - T - B)) / 3;
            return (
              <g key={g}>
                <line x1={L} x2={W - R} y1={gy} y2={gy} className="ic-grid" />
                <text x={L - 8} y={gy + 4} textAnchor="end" className="ic-axis">{gbp(max * (1 - g / 3))}</text>
              </g>
            );
          })}
          {MONTHS.map((m, i) => (
            <text key={m} x={x(i)} y={H - 8} textAnchor="middle" className="ic-axis">{m}</text>
          ))}

          <path d={rArea} fill="url(#icArea)" className="ic-area" />
          <path d={smooth(ep)} pathLength="1" className="ic-line ic-line-exp" />
          <path d={rLine} pathLength="1" className="ic-line ic-line-rev" />

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="ic-cursor" />
              <circle cx={x(hover)} cy={y(rev[hover])} r="5" className="ic-dot ic-dot-rev" />
              <circle cx={x(hover)} cy={y(exp[hover])} r="5" className="ic-dot ic-dot-exp" />
            </g>
          )}
          {MONTHS.map((m, i) => (
            <rect key={m} x={x(i) - (W - L - R) / 22} y={T} width={(W - L - R) / 11} height={H - T - B}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} />
          ))}
        </svg>

        {hover !== null && (
          <div className="ic-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <strong>{MONTHS[hover]}</strong>
            <span><i style={{ background: "var(--maroon)" }} />Revenue {gbp(rev[hover])}</span>
            <span><i style={{ background: "var(--navy)" }} />Expenses {gbp(exp[hover])}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 2. Sales by Category (donut) ---------- */
const CATS = [
  { name: "Beverages", v: 38 },
  { name: "Snacks", v: 26 },
  { name: "Dairy", v: 18 },
  { name: "Frozen", v: 11 },
  { name: "Other", v: 7 },
];

function CategoryDonut({ k }) {
  const [active, setActive] = useState(null);
  const R = 44, C = 2 * Math.PI * R;
  const total = Math.round(168000 * k);
  const sum = CATS.reduce((a, c) => a + c.v, 0);
  let acc = 0;
  const segs = CATS.map((c, i) => {
    const len = (c.v / sum) * C;
    const seg = { ...c, i, len: Math.max(0, len - 2.5), off: acc };
    acc += len;
    return seg;
  });
  const cur = active !== null ? segs[active] : null;

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Sales by Category</h3><p>Share of total revenue</p></div>
      </header>
      <div className="ic-donut-row">
        <svg viewBox="0 0 120 120" className="ic-donut" role="img" aria-label="Sales by category">
          <g transform="rotate(-90 60 60)">
            <circle cx="60" cy="60" r={R} className="ic-donut-track" />
            {segs.map((s) => (
              <circle key={s.name} cx="60" cy="60" r={R} className={`ic-seg ${active === s.i ? "on" : ""}`}
                style={{
                  stroke: PALETTE[s.i],
                  strokeDasharray: `${s.len} ${C - s.len}`,
                  strokeDashoffset: -s.off,
                  "--c": C,
                  animationDelay: `${0.45 + s.i * 0.12}s`,
                }}
                onMouseEnter={() => setActive(s.i)} onMouseLeave={() => setActive(null)} />
            ))}
          </g>
          <text x="60" y="56" textAnchor="middle" className="ic-donut-big">{cur ? `${cur.v}%` : gbp(total)}</text>
          <text x="60" y="71" textAnchor="middle" className="ic-donut-sub">{cur ? cur.name : "Total sales"}</text>
        </svg>

        <ul className="ic-donut-legend">
          {segs.map((s) => (
            <li key={s.name} className={active === s.i ? "on" : ""}
              onMouseEnter={() => setActive(s.i)} onMouseLeave={() => setActive(null)}>
              <i style={{ background: PALETTE[s.i] }} /><span>{s.name}</span><b>{s.v}%</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 3. Orders by Weekday (bars) ---------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ORDERS = [118, 134, 126, 152, 171, 96, 58];

function WeekdayBars({ k }) {
  const data = scale(ORDERS, k, "ord");
  const max = Math.max(...data);
  const best = data.indexOf(max);
  const W = 300, H = 170, B = 24, bw = 26, gap = (W - bw * 7) / 8;

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Orders by Weekday</h3><p>Busiest day: <b>{DAYS[best]}</b></p></div>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} className="ic-svg" role="img" aria-label="Orders by weekday">
        {data.map((v, i) => {
          const h = (v / max) * (H - B - 22);
          const bx = gap + i * (bw + gap);
          return (
            <g key={DAYS[i]}>
              <rect x={bx} y={H - B - h} width={bw} height={h} rx="6"
                className={`ic-bar ${i === best ? "best" : ""}`} style={{ "--i": i }} />
              <text x={bx + bw / 2} y={H - B - h - 6} textAnchor="middle" className="ic-bar-val"
                style={{ animationDelay: `${0.9 + i * 0.06}s` }}>{v}</text>
              <text x={bx + bw / 2} y={H - 7} textAnchor="middle" className="ic-axis">{DAYS[i]}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

/* ---------- 4. Target gauge ---------- */
function TargetGauge({ k }) {
  const pct = 64 + Math.round((k * 37) % 30);
  const shown = useCountUp(pct);
  const target = Math.round(95000 * k);
  const actual = Math.round((target * pct) / 100);

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Target Achievement</h3><p>Sales target for the period</p></div>
      </header>
      <div className="ic-gauge-wrap">
        <svg viewBox="0 0 200 118" className="ic-gauge" role="img" aria-label={`${pct}% of target achieved`}>
          <defs>
            <linearGradient id="icGauge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--navy)" }} />
              <stop offset="100%" style={{ stopColor: "var(--maroon)" }} />
            </linearGradient>
          </defs>
          <path d="M 20 100 A 80 80 0 0 1 180 100" pathLength="100" className="ic-gauge-track" />
          <path d="M 20 100 A 80 80 0 0 1 180 100" pathLength="100" className="ic-gauge-val"
            style={{ strokeDashoffset: 100 - pct }} />
          <text x="100" y="86" textAnchor="middle" className="ic-gauge-big">{Math.round(shown)}%</text>
          <text x="100" y="104" textAnchor="middle" className="ic-donut-sub">achieved</text>
        </svg>
        <div className="ic-gauge-foot">
          <span>Actual <b>{gbp(actual)}</b></span>
          <span>Target <b>{gbp(target)}</b></span>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. Top products (horizontal bars) ---------- */
const PRODUCTS = [
  { name: "Basmati Rice 5kg", v: 9800 },
  { name: "Sunflower Oil 5L", v: 8400 },
  { name: "Chickpeas 1kg", v: 6900 },
  { name: "Mango Pulp 850g", v: 5600 },
  { name: "Tea Bags 440s", v: 4300 },
];

function TopProducts({ k }) {
  const vals = scale(PRODUCTS.map((p) => p.v), k, "prod");
  const max = Math.max(...vals);

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div><h3>Top Products</h3><p>By sales value</p></div>
      </header>
      <ul className="ic-hbars">
        {PRODUCTS.map((p, i) => (
          <li key={p.name}>
            <div className="ic-hbar-top"><span>{p.name}</span><b>{gbp(vals[i])}</b></div>
            <div className="ic-hbar-track">
              <div className="ic-hbar-fill" style={{ width: `${(vals[i] / max) * 100}%`, background: PALETTE[i], animationDelay: `${0.5 + i * 0.1}s` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- export: two grid rows ---------- */
export default function InsightCharts({ range, k = 1 }) {
  return (
    <>
      <div className="grid insight-grid-a">
        <RevenueExpenses k={k} />
        <CategoryDonut k={k} />
      </div>
      <div className="grid insight-grid-b">
        <WeekdayBars k={k} />
        <TargetGauge k={k} />
        <TopProducts k={k} />
      </div>
    </>
  );
}