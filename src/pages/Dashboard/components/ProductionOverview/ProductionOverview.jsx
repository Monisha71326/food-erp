import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { production } from "@/data/dashboardData.js";
import "./ProductionOverview.css";

const RANGES = [
  { id: "today", label: "Today", k: 1 / 22 },
  { id: "week", label: "This Week", k: 0.28 },
  { id: "month", label: "This Month", k: 1 },
  { id: "quarter", label: "This Quarter", k: 3 },
  { id: "year", label: "This Year", k: 12 },
];
/* the dashboard's own date picker -> matching range here */
const FROM_PAGE = { today: "today", week: "week", month: "month", quarter: "quarter", year: "year", custom: "month" };

/* same status + same range always gives the same small variation */
const jitter = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 0.9 + (h % 21) / 100; };

function scaled(rangeId) {
  const k = RANGES.find((r) => r.id === rangeId).k;
  const rows = production.map((p) => ({
    ...p,
    value: Math.max(0, Math.round((p.value + (p.value === 0 ? 0.25 : 0)) * k * jitter(p.label + rangeId))),
  }));
  if (rows.every((r) => !r.value)) rows[0] = { ...rows[0], value: 1 }; // never an empty donut
  return rows;
}

/* number counts up when it changes */
function CountUp({ value }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 800);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{v}</>;
}

export default function ProductionOverview({ range }) {
  const [rangeId, setRangeId] = useState(FROM_PAGE[range?.id] || "month");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const menuRef = useRef(null);

  /* when the dashboard date picker changes, follow it */
  useEffect(() => { if (range?.id) setRangeId(FROM_PAGE[range.id] || "month"); }, [range?.id]);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  const rows = useMemo(() => scaled(rangeId), [rangeId]);
  const total = rows.reduce((s, p) => s + p.value, 0);
  const R = 74, SW = 30, C = 2 * Math.PI * R;

  /* where each segment starts */
  let acc = 0;
  const segs = rows.map((p) => {
    const len = (p.value / total) * C;
    const seg = { ...p, len, start: acc };
    acc += len;
    return seg;
  });

  const active = hover != null ? rows[hover] : null;
  const pct = (v) => Math.round((v / total) * 100);

  return (
    <section className="card prod-card">
      <div className="pov-head">
        <h3>Production Overview</h3>
        <div className="pov-select" ref={menuRef}>
          <button type="button" className={`pov-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
            <span>{RANGES.find((r) => r.id === rangeId).label}</span>
            <ChevronDown size={15} />
          </button>
          {open && (
            <div className="pov-menu" role="listbox">
              {RANGES.map((r) => (
                <button key={r.id} type="button" role="option" aria-selected={r.id === rangeId}
                  className={`pov-opt ${r.id === rangeId ? "active" : ""}`}
                  onClick={() => { setRangeId(r.id); setHover(null); setOpen(false); }}>
                  <span>{r.label}</span>{r.id === rangeId && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="prod-body">
        <div className="donut" onPointerLeave={() => setHover(null)}>
          <svg viewBox="0 0 200 200" width="200" height="200">
            <g transform="rotate(-90 100 100)">
              <circle className="pov-track" cx="100" cy="100" r={R} fill="none" strokeWidth={SW} />
              {/* key=rangeId -> segments draw in again every time the range changes */}
              <g key={rangeId}>
                {segs.map((p, i) => p.value > 0 && (
                  <circle
                    key={p.label}
                    className={`pov-seg ${hover === i ? "hot" : ""} ${hover != null && hover !== i ? "dim" : ""}`}
                    cx="100" cy="100" r={R} fill="none"
                    stroke={p.color} strokeWidth={SW}
                    strokeDashoffset={-p.start}
                    style={{ "--seg": Math.max(p.len - 3, 0), "--c": C, animationDelay: `${i * 130}ms` }}
                    onPointerEnter={() => setHover(i)}
                  />
                ))}
              </g>
            </g>
          </svg>
          <div className="donut-center">
            <strong key={`${rangeId}-${hover}`}>{active ? active.value : <CountUp value={total} />}</strong>
            <span>{active ? active.label : "Batches"}</span>
          </div>
        </div>

        <ul className="prod-legend" key={`leg-${rangeId}`}>
          {rows.map((p, i) => (
            <li key={p.label} className={hover === i ? "hot" : ""} style={{ animationDelay: `${i * 70 + 150}ms` }}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <span><i className="prod-dot" style={{ background: p.color }} /> {p.label}</span>
              <b>{p.value}<small>{pct(p.value)}%</small></b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}