import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import * as DATA from "@/data/dashboardData.js";
import "./ProductionOverview.css";

/* ---------- data source ----------
   Uses DATA.orderLines: { orderNo, date, product, category, qty }.
   Swap this for an API call later; everything below stays the same. */
const LINES = Array.isArray(DATA.orderLines) ? DATA.orderLines : [];

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom" },
];
const PALETTE = ["#9a0f2e", "#f08a1c", "#3b6fe0", "#7c3aed", "#16a34a", "#e5223f", "#0891b2", "#a16207"];

const startOf = (id, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (id === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (id === "month") d.setDate(1);
  if (id === "quarter") { d.setMonth(Math.floor(d.getMonth() / 3) * 3); d.setDate(1); }
  if (id === "year") { d.setMonth(0); d.setDate(1); }
  return d;
};
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/* date-only strings ("2026-11-02") parsed as local time, not UTC */
const parseDate = (s) => {
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
};

/* lines -> { category: { total, products: { name: qty } } } for the period */
function aggregate(lines, from, to) {
  const cats = {};
  for (const l of lines) {
    const qty = Number(l.qty) || 0;
    if (!qty) continue;
    const d = parseDate(l.date);
    if (isNaN(d) || d < from || d > to) continue;
    const cat = l.category || "Other";
    const c = (cats[cat] ??= { total: 0, products: {} });
    c.total += qty;
    c.products[l.product] = (c.products[l.product] || 0) + qty;
  }
  return cats;
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
  const [rangeId, setRangeId] = useState(range?.id || "month");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const menuRef = useRef(null);

  /* follow the dashboard date picker */
  useEffect(() => {
    if (range?.id) { setRangeId(range.id); setCat("all"); setHover(null); }
  }, [range?.id, range?.from, range?.to]);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  /* real date bounds for the chosen period */
  const [from, to] = useMemo(() => {
    if (rangeId === "custom" && range?.from && range?.to) return [range.from, endOfDay(range.to)];
    if (rangeId === "custom") return [startOf("month"), endOfDay(new Date())];
    return [startOf(rangeId), endOfDay(new Date())];
  }, [rangeId, range?.from, range?.to]);

  const data = useMemo(() => aggregate(LINES, from, to), [from, to]);

  /* category tabs: biggest first */
  const catList = useMemo(
    () => Object.entries(data)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v], i) => ({ id: name, label: name, color: PALETTE[i % PALETTE.length], total: v.total })),
    [data]
  );

  const activeCat = cat !== "all" && data[cat] ? cat : "all";

  /* All = category-wise, a category = product-wise */
  const rows = useMemo(() => {
    if (activeCat === "all") return catList.map((c) => ({ id: c.id, label: c.label, color: c.color, value: c.total }));
    return Object.entries(data[activeCat].products)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ id: name, label: name, color: PALETTE[i % PALETTE.length], value }));
  }, [activeCat, catList, data]);

  const total = rows.reduce((s, p) => s + p.value, 0);
  const R = 74, SW = 30, C = 2 * Math.PI * R;

  let acc = 0;
  const segs = rows.map((p) => {
    const len = total ? (p.value / total) * C : 0;
    const seg = { ...p, len, start: acc };
    acc += len;
    return seg;
  });

  const active = hover != null ? rows[hover] : null;
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);
  const animKey = `${rangeId}-${activeCat}-${+from}-${+to}`;
  const pickCat = (id) => { setCat(id); setHover(null); };

  const emptyMsg = LINES.length === 0
    ? "No order lines found. Add the orderLines export to dashboardData.js"
    : "No orders in this period";

  return (
    <section className="card prod-card">
      <div className="pov-head">
        <h3>Production Overview</h3>
        <div className="pov-select" ref={menuRef}>
          <button type="button" className={`pov-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
            <span>{RANGES.find((r) => r.id === rangeId)?.label || "This Month"}</span>
            <ChevronDown size={15} />
          </button>
          {open && (
            <div className="pov-menu" role="listbox">
              {RANGES.filter((r) => r.id !== "custom" || range?.id === "custom").map((r) => (
                <button key={r.id} type="button" role="option" aria-selected={r.id === rangeId}
                  className={`pov-opt ${r.id === rangeId ? "active" : ""}`}
                  onClick={() => { setRangeId(r.id); setCat("all"); setHover(null); setOpen(false); }}>
                  <span>{r.label}</span>{r.id === rangeId && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="pov-empty">{emptyMsg}</div>
      ) : (
        <>
          <div className="pov-tabs" role="tablist">
            {[{ id: "all", label: "All" }, ...catList].map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={activeCat === c.id}
                className={`pov-tab ${activeCat === c.id ? "active" : ""}`}
                onClick={() => pickCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="prod-body">
            <div className="donut" onPointerLeave={() => setHover(null)}>
              <svg viewBox="0 0 200 200" width="200" height="200">
                <g transform="rotate(-90 100 100)">
                  <circle className="pov-track" cx="100" cy="100" r={R} fill="none" strokeWidth={SW} />
                  <g key={animKey}>
                    {segs.map((p, i) => p.value > 0 && (
                      <circle
                        key={p.id}
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
                <strong key={`${animKey}-${hover}`}>{active ? active.value : <CountUp value={total} />}</strong>
                <span>{active ? active.label : activeCat === "all" ? "Units Ordered" : activeCat}</span>
              </div>
            </div>

            <ul className="prod-legend" key={`leg-${animKey}`}>
              {rows.map((p, i) => (
                <li key={p.id}
                  className={`${hover === i ? "hot" : ""} ${activeCat === "all" ? "clickable" : ""}`}
                  style={{ animationDelay: `${i * 70 + 150}ms` }}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                  onClick={() => activeCat === "all" && pickCat(p.id)}>
                  <span><i className="prod-dot" style={{ background: p.color }} /> {p.label}</span>
                  <b>{p.value}<small>{pct(p.value)}%</small></b>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}