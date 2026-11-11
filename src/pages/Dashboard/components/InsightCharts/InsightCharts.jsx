import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, CalendarRange } from "lucide-react";
import "./InsightCharts.css";

/* ---------- helpers ---------- */
const gbp = (v) =>
  v >= 1000000 ? `£${(v / 1000000).toFixed(2)}M` : v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${Math.round(v)}`;
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

/* ---------- 1. Revenue vs Expenses (line + area, with its own filter) ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REV = [42000, 46500, 44000, 52000, 57500, 55000, 61000, 64500, 60000, 68000, 72500, 78000];
const EXP = [31000, 33500, 32000, 36500, 39000, 38000, 41500, 43000, 41000, 45500, 47000, 50500];

const RE_RANGES = [
  { id: "years", label: "Year Wise" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "Last 3 Months" },
  { id: "year", label: "This Year" },
  { id: "12m", label: "Last 12 Months" },
  { id: "custom", label: "Custom range" },
];
const YEARS_SHOWN = 5;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const growth = (yr) => 1 + (yr - new Date().getFullYear()) * 0.1; // older years a bit smaller
const mRev = (yr, m) => Math.round((REV[m] * growth(yr) * jitter(`r-${yr}-${m}`)) / 100) * 100;
const mExp = (yr, m) => Math.round((EXP[m] * growth(yr) * jitter(`e-${yr}-${m}`)) / 100) * 100;
const pt = (label, full, rev, exp) => ({ label, full, rev, exp });

const dayPt = (d, label, full) => {
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const wk = d.getDay() === 0 || d.getDay() === 6 ? 0.6 : 1;
  const key = iso(d);
  return pt(label, full,
    Math.round((mRev(d.getFullYear(), d.getMonth()) / dim) * jitter("dr" + key) * wk),
    Math.round((mExp(d.getFullYear(), d.getMonth()) / dim) * jitter("de" + key) * wk));
};
const weekPt = (d, full) => {
  const key = iso(d);
  return pt(`${d.getDate()} ${MONTHS[d.getMonth()]}`, full,
    Math.round((mRev(d.getFullYear(), d.getMonth()) / 4.3) * jitter("wr" + key)),
    Math.round((mExp(d.getFullYear(), d.getMonth()) / 4.3) * jitter("we" + key)));
};
const monthPt = (d, label) =>
  pt(label, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, mRev(d.getFullYear(), d.getMonth()), mExp(d.getFullYear(), d.getMonth()));
const yearPt = (yr, lastMonth = 11) => {
  let r = 0, e = 0;
  for (let m = 0; m <= lastMonth; m++) { r += mRev(yr, m); e += mExp(yr, m); }
  const cur = yr === new Date().getFullYear();
  return pt(String(yr), cur ? `${yr} (so far)` : String(yr), r, e);
};

function customSeries(from, to) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const days = Math.round((b - a) / 86400000) + 1;
  const out = [];
  if (days <= 31) {
    for (let i = 0; i < days; i++) {
      const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i);
      out.push(dayPt(d, String(d.getDate()),
        d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })));
    }
  } else if (days <= 120) {
    for (let i = 0; i < days; i += 7) {
      const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i);
      out.push(weekPt(d, `Week of ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`));
    }
  } else if (days <= 800) {
    const multi = a.getFullYear() !== b.getFullYear();
    for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      out.push(monthPt(d, multi ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MONTHS[d.getMonth()]));
    }
  } else {
    for (let yr = a.getFullYear(); yr <= b.getFullYear(); yr++) out.push(yearPt(yr));
  }
  return out;
}

function buildSeries(id, from, to) {
  const now = new Date();
  const day = (o) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + o);
  const out = [];
  if (id === "custom") return customSeries(from, to);
  if (id === "years") {
    const cy = now.getFullYear();
    for (let yr = cy - (YEARS_SHOWN - 1); yr <= cy; yr++) out.push(yearPt(yr, yr === cy ? now.getMonth() : 11));
  } else if (id === "week" || id === "month") {
    const n = id === "week" ? 7 : Math.max(now.getDate(), 7);
    for (let i = n - 1; i >= 0; i--) {
      const d = day(-i);
      out.push(dayPt(d,
        id === "week" ? d.toLocaleDateString("en-GB", { weekday: "short" }) : String(d.getDate()),
        d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })));
    }
  } else if (id === "quarter") {
    for (let i = 12; i >= 0; i--) {
      const d = day(-i * 7);
      out.push(weekPt(d, `Week of ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`));
    }
  } else if (id === "year" && now.getMonth() >= 1) {
    for (let m = 0; m <= now.getMonth(); m++) out.push(monthPt(new Date(now.getFullYear(), m, 1), MONTHS[m]));
  } else {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      out.push(monthPt(d, MONTHS[d.getMonth()]));
    }
  }
  return out;
}

function RevenueExpenses() {
  const today = new Date();
  const [rangeId, setRangeId] = useState("years");
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const menuRef = useRef(null);

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

  const W = 640, H = 250, L = 46, R = 14, T = 14, B = 28;
  const iw = W - L - R;
  const max = Math.max(...pts.map((p) => Math.max(p.rev, p.exp)), 1) * 1.12;
  const x = (i) => L + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const rp = pts.map((p, i) => [x(i), y(p.rev)]);
  const ep = pts.map((p, i) => [x(i), y(p.exp)]);
  const rLine = smooth(rp);
  const rArea = `${rLine} L ${x(n - 1)} ${H - B} L ${x(0)} ${H - B} Z`;
  const totalRev = pts.reduce((a, p) => a + p.rev, 0);
  const totalExp = pts.reduce((a, p) => a + p.exp, 0);
  const labelEvery = Math.ceil(n / 8);
  const step = n > 1 ? iw / (n - 1) : iw;
  const dataKey = `${effectiveId}-${from}-${to}`;
  const hp = hover !== null ? pts[hover] : null;
  const hx = hover !== null ? (x(hover) / W) * 100 : 0;

  const btnLabel = rangeId === "custom" && validCustom
    ? `${fmtDate(from)} - ${fmtDate(to)}`
    : RE_RANGES.find((r) => r.id === rangeId).label;

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div>
          <h3>Revenue vs Expenses</h3>
          <p>Net profit <b className={totalRev - totalExp >= 0 ? "ic-good" : "ic-bad"}>{gbp(Math.abs(totalRev - totalExp))}</b></p>
        </div>
        <div className="ic-tools">
          <div className="ic-legend">
            <span><i style={{ background: "var(--maroon)" }} />Revenue</span>
            <span><i style={{ background: "var(--navy)" }} />Expenses</span>
          </div>
          <div className="ic-select" ref={menuRef}>
            <button type="button" className={`ic-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
              {rangeId === "custom" && <CalendarRange size={14} />}
              <span>{btnLabel}</span>
              <ChevronDown size={15} />
            </button>
            {open && (
              <div className="ic-menu" role="listbox">
                {RE_RANGES.map((r) => (
                  <button key={r.id} type="button" role="option" aria-selected={r.id === rangeId}
                    className={`ic-opt ${r.id === rangeId ? "active" : ""}`}
                    onClick={() => { setRangeId(r.id); setHover(null); setOpen(false); }}>
                    <span>{r.label}</span>{r.id === rangeId && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {rangeId === "custom" && (
        <div className="ic-custom">
          <label>
            <span>From</span>
            <input type="date" value={from} max={to || iso(today)} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} />
          </label>
          {!validCustom && <em>"From" date must be before "To" date</em>}
        </div>
      )}

      <div className="ic-chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="ic-svg" role="img" aria-label="Revenue versus expenses">
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
          {pts.map((p, i) => i % labelEvery === 0 && (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="ic-axis">{p.label}</text>
          ))}

          {/* remounts (and re-animates) every time the filter changes */}
          <g key={dataKey}>
            <path d={rArea} fill="url(#icArea)" className="ic-area" />
            <path d={smooth(ep)} pathLength="1" className="ic-line ic-line-exp" />
            <path d={rLine} pathLength="1" className="ic-line ic-line-rev" />
            {n <= 14 && pts.map((p, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(p.exp)} r="3" className="ic-dot-s ic-dot-exp" />
                <circle cx={x(i)} cy={y(p.rev)} r="3" className="ic-dot-s ic-dot-rev" />
              </g>
            ))}
          </g>

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="ic-cursor" />
              <circle cx={x(hover)} cy={y(hp.rev)} r="5" className="ic-dot ic-dot-rev" />
              <circle cx={x(hover)} cy={y(hp.exp)} r="5" className="ic-dot ic-dot-exp" />
            </g>
          )}
          {pts.map((p, i) => (
            <rect key={i} x={x(i) - step / 2} y={T} width={step} height={H - T - B}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} />
          ))}
        </svg>

        {hp && (
          <div className="ic-tip" style={{ left: `${hx}%`, transform: `translateX(${hx > 75 ? "-105%" : hx < 12 ? "5%" : "-50%"})` }}>
            <strong>{hp.full}</strong>
            <span><i style={{ background: "var(--maroon)" }} />Revenue {gbp(hp.rev)}</span>
            <span><i style={{ background: "var(--navy)" }} />Expenses {gbp(hp.exp)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 2. Sales by Category (donut) + Gross Profit toggle ---------- */
const CATS = [
  { name: "Beverages", v: 38, margin: 0.32 },
  { name: "Snacks",    v: 26, margin: 0.41 },
  { name: "Dairy",     v: 18, margin: 0.24 },
  { name: "Frozen",    v: 11, margin: 0.28 },
  { name: "Other",     v: 7,  margin: 0.35 },
]; // v = % of sales, margin = gross profit margin (demo data)

function CategoryDonut({ k }) {
  const [metric, setMetric] = useState("sales"); // "sales" | "gp"
  const [active, setActive] = useState(null);
  const R = 44, C = 2 * Math.PI * R;

  const totalSales = Math.round(168000 * k);
  const sumV = CATS.reduce((a, c) => a + c.v, 0);

  const rows = CATS.map((c) => {
    const sales = (totalSales * c.v) / sumV;
    return { ...c, sales, gp: sales * c.margin };
  });
  const totalGP = rows.reduce((a, r) => a + r.gp, 0);
  const overallMargin = totalSales ? (totalGP / totalSales) * 100 : 0;

  const isGP = metric === "gp";
  const total = isGP ? totalGP : totalSales;

  let acc = 0;
  const segs = rows.map((r, i) => {
    const value = isGP ? r.gp : r.sales;
    const share = total ? (value / total) * 100 : 0;
    const len = (share / 100) * C;
    const seg = { ...r, i, value, share, len: Math.max(0, len - 2.5), off: acc };
    acc += len;
    return seg;
  });
  const cur = active !== null ? segs[active] : null;
  const pctText = (p) => `${isGP ? p.toFixed(1) : Math.round(p)}%`;

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div>
          <h3>{isGP ? "Gross Profit by Category" : "Sales by Category"}</h3>
          <p>
            {isGP
              ? <>Share of gross profit · margin <b className="ic-good">{overallMargin.toFixed(1)}%</b></>
              : "Share of total revenue"}
          </p>
        </div>
      </header>

      <div className="ic-mode" role="tablist">
        <button type="button" role="tab" aria-selected={!isGP}
          className={!isGP ? "active" : ""} onClick={() => { setMetric("sales"); setActive(null); }}>
          Sales
        </button>
        <button type="button" role="tab" aria-selected={isGP}
          className={isGP ? "active" : ""} onClick={() => { setMetric("gp"); setActive(null); }}>
          Gross Profit
        </button>
      </div>

      <div className="ic-donut-row">
        <svg viewBox="0 0 120 120" className="ic-donut" role="img"
          aria-label={isGP ? "Gross profit by category" : "Sales by category"}>
          {/* key remounts the segments so the draw animation replays on toggle */}
          <g key={metric} transform="rotate(-90 60 60)">
            <circle cx="60" cy="60" r={R} className="ic-donut-track" />
            {segs.map((s) => (
              <circle key={s.name} cx="60" cy="60" r={R} className={`ic-seg ${active === s.i ? "on" : ""}`}
                style={{
                  stroke: PALETTE[s.i],
                  strokeDasharray: `${s.len} ${C - s.len}`,
                  strokeDashoffset: -s.off,
                  "--c": C,
                  animationDelay: `${0.15 + s.i * 0.1}s`,
                }}
                onMouseEnter={() => setActive(s.i)} onMouseLeave={() => setActive(null)} />
            ))}
          </g>
          <text x="60" y="56" textAnchor="middle" className="ic-donut-big">
            {cur ? gbp(cur.value) : gbp(total)}
          </text>
          <text x="60" y="71" textAnchor="middle" className="ic-donut-sub">
            {cur ? `${cur.name} · ${pctText(cur.share)}` : isGP ? "Gross profit" : "Total sales"}
          </text>
        </svg>

        <ul className="ic-donut-legend">
          {segs.map((s) => (
            <li key={s.name} className={active === s.i ? "on" : ""}
              onMouseEnter={() => setActive(s.i)} onMouseLeave={() => setActive(null)}>
              <i style={{ background: PALETTE[s.i] }} />
              <span>{s.name}</span>
              <b>{pctText(s.share)}</b>
              {isGP && (
                <small style={{ marginLeft: 6, opacity: 0.65, fontSize: 11 }}>
                  {Math.round(s.margin * 100)}% margin
                </small>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 3. Orders by Weekday (month range / custom range, vs previous year) ---------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WD_BASE = [118, 134, 126, 152, 171, 96, 58]; // demo: relative orders per weekday

const num = (v) => Math.round(v).toLocaleString("en-GB");
const pctOf = (prev, cur) => (prev ? ((cur - prev) / prev) * 100 : 0);

/* orders for each weekday (Mon..Sun) between two dates - demo data */
function weekdayTotals(a, b) {
  const t = [0, 0, 0, 0, 0, 0, 0];
  for (let d = new Date(a); d <= b; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const wd = (d.getDay() + 6) % 7;
    t[wd] += (WD_BASE[wd] / 4) * jitter("wd" + iso(d)) * growth(d.getFullYear());
  }
  return t.map(Math.round);
}

function WeekdayBars() {
  const today = new Date();
  const cy = today.getFullYear();
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => cy - i);

  const [mode, setMode] = useState("month"); // "month" | "custom"
  const [yr, setYr] = useState(cy);
  const [m1, setM1] = useState(0); // From month (Jan)
  const [m2, setM2] = useState(7); // To month (Aug)
  const [from, setFrom] = useState(iso(new Date(cy, 0, 1)));
  const [to, setTo] = useState(iso(today));

  const changeFrom = (v) => { setM1(v); if (m2 < v) setM2(v); };
  const changeTo = (v) => { setM2(v); if (m1 > v) setM1(v); };

  const validCustom = !!from && !!to && from <= to;
  const useCustom = mode === "custom" && validCustom;

  const { cur, prev, label, prevLabel } = useMemo(() => {
    if (useCustom) {
      const a = new Date(from + "T00:00:00");
      const b = new Date(to + "T00:00:00");
      const a2 = new Date(a.getFullYear() - 1, a.getMonth(), a.getDate());
      const b2 = new Date(b.getFullYear() - 1, b.getMonth(), b.getDate());
      return {
        cur: weekdayTotals(a, b),
        prev: weekdayTotals(a2, b2),
        label: `${fmtDate(from)} - ${fmtDate(to)}`,
        prevLabel: `${fmtDate(iso(a2))} - ${fmtDate(iso(b2))}`,
      };
    }
    const a = new Date(yr, m1, 1);
    let b = new Date(yr, m2 + 1, 0); // last day of "To month"
    if (b > today) b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const a2 = new Date(yr - 1, m1, 1);
    const b2 = new Date(yr - 1, b.getMonth(), b.getDate());
    const name = (y) => (m1 === m2 ? `${MONTHS[m1]} ${y}` : `${MONTHS[m1]} - ${MONTHS[m2]} ${y}`);
    return { cur: weekdayTotals(a, b), prev: weekdayTotals(a2, b2), label: name(yr), prevLabel: name(yr - 1) };
  }, [useCustom, yr, m1, m2, from, to]); // eslint-disable-line

  const total = cur.reduce((s, v) => s + v, 0);
  const totalPrev = prev.reduce((s, v) => s + v, 0);
  const totalPct = pctOf(totalPrev, total);
  const max = Math.max(...cur, ...prev, 1);

  const W = 360, H = 200, B = 44, TOP = 12, bw = 16, bgap = 3;
  const groupW = (W - 12) / 7;
  const ch = H - B - TOP;

  return (
    <section className="ic-card">
      <header className="ic-head">
        <div>
          <h3>Orders by Weekday</h3>
          <p>
            <b>{num(total)}</b> orders{" "}
            <b className={totalPct >= 0 ? "ic-good" : "ic-bad"}>{totalPct >= 0 ? "▲" : "▼"} {Math.abs(totalPct).toFixed(1)}%</b>{" "}
            vs {prevLabel}
          </p>
        </div>
      </header>

      <div className="ic-mode" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "month"}
          className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>Month range</button>
        <button type="button" role="tab" aria-selected={mode === "custom"}
          className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
          <CalendarRange size={13} /> Custom range
        </button>
      </div>

      {mode === "month" ? (
        <div className="ic-filters">
          <label><span>Year</span>
            <select value={yr} onChange={(e) => setYr(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label><span>From</span>
            <select value={m1} onChange={(e) => changeFrom(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </label>
          <label><span>To</span>
            <select value={m2} onChange={(e) => changeTo(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i} disabled={i < m1}>{m}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <div className="ic-custom">
          <label>
            <span>From</span>
            <input type="date" value={from} max={to || iso(today)} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} />
          </label>
          {!validCustom && <em>"From" date must be before "To" date</em>}
        </div>
      )}

      <div className="ic-wlegend">
        <span><i style={{ background: "#8b94a7" }} />{prevLabel}</span>
        <span><i style={{ background: "var(--maroon)" }} />{label}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="ic-svg" role="img" aria-label={`Orders by weekday, ${label} vs ${prevLabel}`}>
        <line x1="0" x2={W} y1={H - B} y2={H - B} className="ic-grid" />
        <g key={`${useCustom}-${yr}-${m1}-${m2}-${from}-${to}`}>
          {DAYS.map((d, i) => {
            const gx = 6 + i * groupW;
            const bx = gx + (groupW - (bw * 2 + bgap)) / 2;
            const cx = gx + groupW / 2;
            const hp = (prev[i] / max) * ch;
            const hc = (cur[i] / max) * ch;
            const p = pctOf(prev[i], cur[i]);
            return (
              <g key={d}>
                <rect x={bx} y={H - B - hp} width={bw} height={hp} rx="3" className="ic-bar"
                  style={{ fill: "#8b94a7", opacity: 1, "--i": i * 2 }}>
                  <title>{`${d} (${prevLabel}): ${num(prev[i])} orders`}</title>
                </rect>
                <rect x={bx + bw + bgap} y={H - B - hc} width={bw} height={hc} rx="3" className="ic-bar"
                  style={{ fill: "var(--maroon)", opacity: 1, "--i": i * 2 + 1 }}>
                  <title>{`${d} (${label}): ${num(cur[i])} orders`}</title>
                </rect>
                <text x={cx} y={H - B + 14} textAnchor="middle" className="ic-axis">{d}</text>
                <text x={cx} y={H - B + 29} textAnchor="middle" className={`ic-pct ${p >= 0 ? "up" : "down"}`}>
                  {p >= 0 ? "▲" : "▼"}{Math.abs(p).toFixed(1)}%
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="ic-wnote">
        <span>Grey = {prevLabel}</span>
        <span>% = selected vs previous year</span>
      </div>
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
        <RevenueExpenses />
        <CategoryDonut k={k} />
      </div>
      <div className="grid insight-grid-b">
        {/* <WeekdayBars /> */} {/* hidden (uncomment to show again) */}
        <TargetGauge k={k} />
        <TopProducts k={k} />
      </div>
    </>
  );
}