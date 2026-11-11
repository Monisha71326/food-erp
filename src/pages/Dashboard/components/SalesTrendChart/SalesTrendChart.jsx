import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, CalendarRange } from "lucide-react";
import "./SalesTrendChart.css";

const RANGES = [
  { id: "years", label: "Year Wise" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "Last 3 Months" },
  { id: "year", label: "This Year" },
  { id: "12m", label: "Last 12 Months" },
  { id: "custom", label: "Custom range" },
];
const YEARS_SHOWN = 5;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASON = [0.8, 0.82, 0.9, 0.95, 1, 1.02, 0.98, 1.0, 1.08, 1.15, 1.3, 1.4];
const gbp = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const axisGbp = (v) => (v >= 1000 ? `£${+(v / 1000).toFixed(1)}K` : `£${v}`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/* ---------- demo data (same date always gives the same numbers) ---------- */
function rng(seed) {
  let a = 0;
  for (const c of seed) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function values(key, month, base, weekend) {
  const r = rng(key);
  const sales = base * SEASON[month] * (0.8 + 0.4 * r()) * (weekend ? 0.6 : 1);
  const round = base < 5000 ? 10 : 100;
  return { sales: Math.round(sales / round) * round };
}
const monthSales = (year, month) => values(`m-${year}-${month}`, month, 55000, false).sales;

/* custom calendar range: the detail level depends on how long the period is */
function customSeries(from, to) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const days = Math.round((b - a) / 86400000) + 1;
  const pts = [];

  if (days <= 31) {
    for (let i = 0; i < days; i++) {
      const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      pts.push({
        label: String(d.getDate()),
        full: d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
        ...values(`d-${iso(d)}`, d.getMonth(), 2100, weekend),
      });
    }
  } else if (days <= 120) {
    for (let i = 0; i < days; i += 7) {
      const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i);
      pts.push({
        label: `${d.getDate()} ${MON[d.getMonth()]}`,
        full: `Week of ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
        ...values(`w-${iso(d)}`, d.getMonth(), 14500, false),
      });
    }
  } else if (days <= 800) {
    const multiYear = a.getFullYear() !== b.getFullYear();
    for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      pts.push({
        label: multiYear ? `${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MON[d.getMonth()],
        full: `${MON[d.getMonth()]} ${d.getFullYear()}`,
        sales: monthSales(d.getFullYear(), d.getMonth()),
      });
    }
  } else {
    for (let yr = a.getFullYear(); yr <= b.getFullYear(); yr++) {
      let total = 0;
      for (let m = 0; m < 12; m++) total += monthSales(yr, m);
      pts.push({ label: String(yr), full: String(yr), sales: total });
    }
  }
  return pts;
}

function buildSeries(id, from, to) {
  const now = new Date();
  const pts = [];
  const day = (offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const monthPts = (months) => months.forEach((d) => {
    pts.push({
      label: MON[d.getMonth()], full: `${MON[d.getMonth()]} ${d.getFullYear()}`,
      sales: monthSales(d.getFullYear(), d.getMonth()),
    });
  });

  if (id === "custom") {
    return customSeries(from, to);
  } else if (id === "years") {
    const cy = now.getFullYear();
    for (let yr = cy - (YEARS_SHOWN - 1); yr <= cy; yr++) {
      const lastMonth = yr === cy ? now.getMonth() : 11;
      let total = 0;
      for (let m = 0; m <= lastMonth; m++) total += monthSales(yr, m);
      pts.push({ label: String(yr), full: yr === cy ? `${yr} (so far)` : String(yr), sales: total });
    }
  } else if (id === "week" || id === "month") {
    const n = id === "week" ? 7 : Math.max(now.getDate(), 7);
    for (let i = n - 1; i >= 0; i--) {
      const d = day(-i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      pts.push({
        label: id === "week" ? d.toLocaleDateString("en-GB", { weekday: "short" }) : String(d.getDate()),
        full: d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }),
        ...values(`d-${d.toISOString().slice(0, 10)}`, d.getMonth(), 2100, weekend),
      });
    }
  } else if (id === "quarter") {
    for (let i = 12; i >= 0; i--) {
      const d = day(-i * 7);
      pts.push({
        label: `${d.getDate()} ${MON[d.getMonth()]}`,
        full: `Week of ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`,
        ...values(`w-${d.toISOString().slice(0, 10)}`, d.getMonth(), 14500, false),
      });
    }
  } else if (id === "year" && now.getMonth() >= 1) {
    monthPts(Array.from({ length: now.getMonth() + 1 }, (_, m) => new Date(now.getFullYear(), m, 1)));
  } else {
    monthPts(Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)));
  }
  return pts;
}

function niceScale(max) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return { step: nice * mag, top: nice * mag * 4 };
}

/* numbers count up when they change */
function Money({ value }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{gbp(v)}</>;
}

/* ---------- chart ---------- */
const W = 760, H = 300, PL = 56, PR = 16, PT = 14, PB = 32;

export default function SalesTrendChart() {
  const today = new Date();
  const [rangeId, setRangeId] = useState("years");
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const menuRef = useRef(null);
  const boxRef = useRef(null);

  const validCustom = !!from && !!to && from <= to;
  /* half-typed / wrong dates: keep showing the last 12 months instead of an empty chart */
  const effectiveId = rangeId === "custom" && !validCustom ? "12m" : rangeId;
  const pts = useMemo(() => buildSeries(effectiveId, from, to), [effectiveId, from, to]);
  const n = pts.length;

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  const iw = W - PL - PR, ih = H - PT - PB;
  const { step, top } = niceScale(Math.max(...pts.map((p) => p.sales), 1) * 1.04);
  const x = (i) => PL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => PT + ih - (v / top) * ih;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.sales).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${PT + ih} L${x(0).toFixed(1)},${PT + ih} Z`;
  const labelEvery = Math.ceil(n / 8);
  const total = pts.reduce((s, p) => s + p.sales, 0);
  const dataKey = `${effectiveId}-${from}-${to}`;

  const onMove = (e) => {
    if (n === 1) return setHover(0);
    const r = boxRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PL) / iw) * (n - 1)))));
  };
  const hp = hover != null ? pts[hover] : null;
  const hx = hover != null ? (x(hover) / W) * 100 : 0;

  const btnLabel = rangeId === "custom" && validCustom
    ? `${fmt(from)} - ${fmt(to)}`
    : RANGES.find((r) => r.id === rangeId).label;

  return (
    <div className="card sales-trend-card">
      <div className="stc-head">
        <h3>Sales Trend</h3>
        <div className="stc-select" ref={menuRef}>
          <button type="button" className={`stc-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
            {rangeId === "custom" && <CalendarRange size={14} />}
            <span>{btnLabel}</span>
            <ChevronDown size={15} />
          </button>
          {open && (
            <div className="stc-menu" role="listbox">
              {RANGES.map((r) => (
                <button key={r.id} type="button" role="option" aria-selected={r.id === rangeId}
                  className={`stc-opt ${r.id === rangeId ? "active" : ""}`}
                  onClick={() => { setRangeId(r.id); setHover(null); setOpen(false); }}>
                  <span>{r.label}</span>{r.id === rangeId && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {rangeId === "custom" && (
        <div className="stc-custom">
          <label>
            <span>From</span>
            <input type="date" value={from} max={to || iso(today)} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} />
          </label>
          {!validCustom && <em>"From" date "To" date-ku munnadi irukkanum</em>}
        </div>
      )}

      <div className="stc-sum" key={`sum-${dataKey}`}>
        <div><span>Total Sales</span><b className="c-sales"><Money value={total} /></b></div>
      </div>

      <div className="stc-box" ref={boxRef} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sales trend chart">
          <defs>
            <linearGradient id="stcSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--maroon)", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "var(--maroon)", stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3, 4].map((t) => (
            <g key={t}>
              <line className="stc-grid" x1={PL} x2={W - PR} y1={y(step * t)} y2={y(step * t)} />
              <text className="stc-ytxt" x={PL - 10} y={y(step * t) + 4} textAnchor="end">{axisGbp(step * t)}</text>
            </g>
          ))}
          {pts.map((p, i) => i % labelEvery === 0 && (
            <g key={i}>
              <line className="stc-vgrid" x1={x(i)} x2={x(i)} y1={PT} y2={PT + ih} />
              <text className="stc-xtxt" x={x(i)} y={H - 10} textAnchor="middle">{p.label}</text>
            </g>
          ))}

          <g key={dataKey}>
            <path className="stc-area" d={area} fill="url(#stcSales)" />
            <path className="stc-line" pathLength="1" d={line} stroke="var(--maroon)" />
            {pts.map((p, i) => (
              <g key={i} className="stc-dot" style={{ "--i": i }}>
                <circle cx={x(i)} cy={y(p.sales)} r="3.4" fill="var(--maroon)" />
              </g>
            ))}
          </g>

          {hp && (
            <g pointerEvents="none">
              <line className="stc-cursor" x1={x(hover)} x2={x(hover)} y1={PT} y2={PT + ih} />
              <circle cx={x(hover)} cy={y(hp.sales)} r="6" fill="var(--maroon)" stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {hp && (
          <div className="stc-tip" style={{ left: `${hx}%`, transform: `translateX(${hx > 72 ? "-105%" : hx < 12 ? "5%" : "-50%"})` }}>
            <div className="stc-tip-title">{hp.full}</div>
            <div className="stc-tip-row"><i className="dot sales" /><span>Sales</span><b>{gbp(hp.sales)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}