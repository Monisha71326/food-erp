import { useEffect, useMemo, useState } from "react";
import { CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { hubRequest } from "@/data/localDb.js";
import "./AreaBreakdown.css";

/* Rep = the area manager who placed the order. Everything else (client portal, manual invoices) = "Office". */
const OFFICE = "Office";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const gbp = (n) => "£" + (Number(n) || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbp0 = (n) => "£" + Math.round(Number(n) || 0).toLocaleString("en-GB");
const areaOf = (c) => { const p = String(c?.address || "").split(",").map((s) => s.trim()).filter(Boolean); return p.length > 1 ? p[p.length - 1] : "Unknown"; };
const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

/* ---------- own period filter ---------- */
const PERIODS = [
  { id: "dash", label: "Dashboard period" }, // follows the date picker at the top of the page
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom range" },
];
const startOf = (id, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (id === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (id === "month") d.setDate(1);
  if (id === "quarter") { d.setMonth(Math.floor(d.getMonth() / 3) * 3); d.setDate(1); }
  if (id === "year") { d.setMonth(0); d.setDate(1); }
  return d;
};

function Delta({ v }) {
  if (v == null) return <span className="ab-delta flat">new</span>;
  const up = v >= 0;
  return <span className={`ab-delta ${up ? "up" : "down"}`}>{up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(v).toFixed(v > -10 && v < 10 ? 1 : 0)}%</span>;
}

export default function AreaBreakdown({ range }) {
  const [st, setSt] = useState(null);
  const [rep, setRep] = useState("all");
  const [area, setArea] = useState("all");

  /* period filter of this card */
  const todayD = new Date();
  const [period, setPeriod] = useState("dash");
  const [cFrom, setCFrom] = useState(iso(startOf("month")));
  const [cTo, setCTo] = useState(iso(todayD));
  const validCustom = !!cFrom && !!cTo && cFrom <= cTo;

  let rFrom = range.from, rTo = range.to;
  if (period === "custom" && validCustom) {
    rFrom = new Date(cFrom + "T00:00:00");
    rTo = new Date(cTo + "T00:00:00");
  } else if (period !== "dash" && period !== "custom") {
    rFrom = startOf(period);
    rTo = todayD;
  }
  const fromIso = iso(rFrom), toIso = iso(rTo);

  useEffect(() => {
    let alive = true;
    const load = () => hubRequest("GET", "/state").then((d) => alive && d?.clients && setSt(d));
    load();
    const t = setInterval(load, 10000); // pick up new orders / payments
    return () => { alive = false; clearInterval(t); };
  }, []);

  const m = useMemo(() => {
    if (!st) return null;
    const orders = new Map(st.orders.map((o) => [o.id, o]));
    const clients = new Map(st.clients.map((c) => [c.id, c]));
    const a0 = new Date(fromIso + "T00:00:00"), b0 = new Date(toIso + "T00:00:00");
    const days = Math.max(1, Math.round((b0 - a0) / 86400000) + 1);
    const pTo = new Date(a0); pTo.setDate(pTo.getDate() - 1);
    const pFrom = new Date(pTo); pFrom.setDate(pFrom.getDate() - (days - 1));
    const [pf, pt] = [iso(pFrom), iso(pTo)];

    const all = st.invoices.map((i) => {
      const p = orders.get(i.orderId)?.placedBy || "";
      const c = clients.get(i.clientId);
      return { ...i, rep: p.startsWith("Area manager: ") ? p.slice(14) : OFFICE, area: areaOf(c), client: c?.name || i.clientId, due: i.status === "Outstanding" ? Math.max(0, i.amount - (i.paid || 0)) : 0 };
    });
    const inR = (i, a, b) => i.date >= a && i.date <= b;
    const cur = all.filter((i) => inR(i, fromIso, toIso));
    const prev = all.filter((i) => inR(i, pf, pt));
    const byRep = (list) => list.filter((i) => rep === "all" || i.rep === rep);

    const reps = [...st.areaManagers.map((a) => a.name), OFFICE];
    const repChips = reps.map((r) => ({ id: r, n: cur.filter((i) => i.rep === r).length }));

    const areaMap = new Map();
    byRep(cur).forEach((i) => { const a = areaMap.get(i.area) || { cur: 0, prev: 0 }; a.cur += i.amount; areaMap.set(i.area, a); });
    byRep(prev).forEach((i) => { const a = areaMap.get(i.area) || { cur: 0, prev: 0 }; a.prev += i.amount; areaMap.set(i.area, a); });
    const areaChips = [...areaMap.entries()].map(([id, v]) => ({ id, ...v, d: pct(v.cur, v.prev) })).sort((a, b) => b.cur - a.cur);
    const sum = (l) => l.reduce((s, i) => s + i.amount, 0);
    const totalCur = sum(byRep(cur)), totalPrev = sum(byRep(prev));

    const inArea = (l) => l.filter((i) => area === "all" || i.area === area);
    const view = inArea(byRep(cur));

    /* rep-wise breakdown (ignores the rep filter so every rep is always listed) */
    const breakdown = reps.map((r) => {
      const l = inArea(cur.filter((i) => i.rep === r));
      return { rep: r, stores: new Set(l.map((i) => i.clientId)).size, invoices: l.length, total: sum(l), due: l.reduce((s, i) => s + i.due, 0) };
    });

    return {
      repChips, areaChips, breakdown,
      kpi: { total: sum(view), prev: area === "all" ? totalPrev : areaMap.get(area)?.prev || 0, due: view.reduce((s, i) => s + i.due, 0), count: view.length },
      allTotal: sum(cur),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, fromIso, toIso, rep, area]);

  if (!m) return <section className="ab"><p className="ab-muted">Loading breakdown...</p></section>;

  const k = m.kpi;
  const repLabel = rep === "all" ? "All reps" : rep;
  const bTotal = m.breakdown.reduce((a, r) => ({ stores: a.stores + r.stores, invoices: a.invoices + r.invoices, total: a.total + r.total, due: a.due + r.due }), { stores: 0, invoices: 0, total: 0, due: 0 });

  return (
    <section className="ab">
      <header className="ab-head">
        <div>
          <h3>Area &amp; Rep Breakdown</h3>
          <p>Target · {repLabel} · {area === "all" ? "All areas" : area} · {fromIso} to {toIso}</p>
        </div>
      </header>

      {/* ---- period filter ---- */}
      <div className="ab-box">
        <span className="ab-label">Period</span>
        <div className="ab-chips">
          {PERIODS.map((p) => (
            <button type="button" key={p.id} className={`ab-chip ${period === p.id ? "on" : ""}`} onClick={() => setPeriod(p.id)}>
              {p.id === "custom" && <CalendarRange size={13} />}{p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="ab-custom">
            <label>
              <span>From</span>
              <input type="date" value={cFrom} max={cTo || iso(todayD)} onChange={(e) => setCFrom(e.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={cTo} min={cFrom} max={iso(todayD)} onChange={(e) => setCTo(e.target.value)} />
            </label>
            {!validCustom && <em>"From" date must be before "To" date</em>}
          </div>
        )}
      </div>

      {/* ---- filters ---- */}
      <div className="ab-box">
        <span className="ab-label">Area manager / Office</span>
        <div className="ab-chips">
          <button type="button" className={`ab-chip ${rep === "all" ? "on" : ""}`} onClick={() => { setRep("all"); setArea("all"); }}>All areas</button>
          {m.repChips.map((r) => (
            <button type="button" key={r.id} className={`ab-chip ${rep === r.id ? "on" : ""}`} onClick={() => { setRep(r.id); setArea("all"); }}>
              {r.id} <i>{r.n}</i>
            </button>
          ))}
        </div>
      </div>

      <div className="ab-box">
        <span className="ab-label">Areas <small>▲ green = up on previous period · ▼ red = down</small></span>
        <div className="ab-chips">
          <button type="button" className={`ab-chip area all ${area === "all" ? "on" : ""}`} onClick={() => setArea("all")}>All areas <Delta v={pct(rep === "all" ? m.allTotal : m.areaChips.reduce((s, a) => s + a.cur, 0), m.areaChips.reduce((s, a) => s + a.prev, 0))} /></button>
          {m.areaChips.map((a) => (
            <button type="button" key={a.id} className={`ab-chip area ${a.d != null && a.d < 0 ? "neg" : "pos"} ${area === a.id ? "on" : ""}`} onClick={() => setArea(a.id)} title={`${gbp0(a.cur)} now · ${gbp0(a.prev)} previous period`}>
              {a.id} <Delta v={a.d} />
            </button>
          ))}
          {!m.areaChips.length && <span className="ab-muted">No invoices in this period.</span>}
        </div>
      </div>

      {/* ---- KPIs (labels renamed: Invoiced -> Target, Outstanding -> Total Achieved, Invoices -> Outstanding; Stores card removed) ---- */}
      <div className="ab-kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div><small>Target</small><b>{gbp0(k.total)}</b><Delta v={pct(k.total, k.prev)} /></div>
        <div><small>Total Achieved</small><b className="red">{gbp0(k.due)}</b></div>
        <div><small>Outstanding</small><b>{k.count}</b></div>
      </div>

      {/* ---- rep-wise breakdown ---- */}
      <h4 className="ab-title">Rep-wise breakdown <small>click a row to filter</small></h4>
      <div className="ab-table-wrap">
        <table className="ab-table">
          <thead><tr><th>Rep</th><th className="r">Stores</th><th className="r">Outstanding</th><th className="r">Target</th><th className="r">Total Achieved</th></tr></thead>
          <tbody>
            {m.breakdown.map((r) => (
              <tr key={r.rep} className={`click ${rep === r.rep ? "sel" : ""}`} onClick={() => setRep(rep === r.rep ? "all" : r.rep)}>
                <td><b>{r.rep}</b>{r.rep === OFFICE && <em>portal &amp; manual</em>}</td>
                <td className="r">{r.stores}</td><td className="r">{r.invoices}</td><td className="r">{gbp(r.total)}</td><td className={`r ${r.due ? "red" : ""}`}>{gbp(r.due)}</td>
              </tr>
            ))}
            <tr className="total"><td>Total</td><td className="r">{bTotal.stores}</td><td className="r">{bTotal.invoices}</td><td className="r">{gbp(bTotal.total)}</td><td className="r">{gbp(bTotal.due)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}