import { useMemo, useState } from "react";
import "./InvoiceDateFilter.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortDate = (s) => {
  const [y, m, d] = s.split("-");
  return `${d} ${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`;
};

/* quick ranges -> { from, to } */
const PRESETS = [
  { id: "today", label: "Today", icon: "fa-sun", range: () => { const t = iso(new Date()); return { from: t, to: t }; } },
  { id: "7d", label: "Last 7 days", icon: "fa-calendar-week", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); return { from: iso(s), to: iso(e) }; } },
  { id: "month", label: "This month", icon: "fa-calendar-day", range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) }; } },
  { id: "lastMonth", label: "Last month", icon: "fa-calendar-minus", range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: iso(new Date(n.getFullYear(), n.getMonth(), 0)) }; } },
  { id: "year", label: "This year", icon: "fa-calendar", range: () => { const y = new Date().getFullYear(); return { from: `${y}-01-01`, to: `${y}-12-31` }; } },
];

/*
 * Date / Month / Year filter for invoice (or order) lists.
 *   const [rows, filterBar] = useInvoiceDateFilter(allRows);                    // invoices
 *   const [rows, filterBar] = useInvoiceDateFilter(allRows, "date", "orders");  // orders
 * rows need an ISO "date" (YYYY-MM-DD). Render {filterBar} above the table and pass `rows` to <DataTable />.
 */
export default function useInvoiceDateFilter(allRows, key = "date", entity = "invoices") {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [preset, setPreset] = useState("");

  const years = useMemo(
    () => [...new Set(allRows.map((r) => String(r[key] || "").slice(0, 4)).filter(Boolean))].sort().reverse(),
    [allRows, key],
  );

  const rows = useMemo(
    () => allRows.filter((r) => {
      const d = String(r[key] || "");
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (month && d.slice(5, 7) !== month) return false;
      if (year && d.slice(0, 4) !== year) return false;
      return true;
    }),
    [allRows, from, to, month, year, key],
  );

  const applyPreset = (p) => {
    if (preset === p.id) { clearRange(); return; }
    const r = p.range();
    setFrom(r.from); setTo(r.to); setPreset(p.id);
  };
  const clearRange = () => { setFrom(""); setTo(""); setPreset(""); };
  const clearAll = () => { clearRange(); setMonth(""); setYear(""); };

  const pills = [];
  if (from || to) {
    const label = from && to ? (from === to ? shortDate(from) : `${shortDate(from)} - ${shortDate(to)}`) : from ? `From ${shortDate(from)}` : `Until ${shortDate(to)}`;
    pills.push({ id: "range", icon: "fa-calendar-days", label, clear: clearRange });
  }
  if (month) pills.push({ id: "month", icon: "fa-calendar-day", label: MONTHS[Number(month) - 1], clear: () => setMonth("") });
  if (year) pills.push({ id: "year", icon: "fa-calendar", label: year, clear: () => setYear("") });

  const bar = (
    <section className="idf-card" aria-label={`Filter ${entity} by date`}>
      <div className="idf-top">
        <div className="idf-heading">
          <span className="idf-badge"><i className="fa-solid fa-sliders" aria-hidden="true" /></span>
          <div>
            <b>Filter by date</b>
            <small>Narrow the list by day, month or year</small>
          </div>
        </div>
        <span className={`idf-count${pills.length ? " on" : ""}`}>
          <b>{rows.length}</b> of {allRows.length} {entity}
        </span>
      </div>

      <div className="idf-chips" role="group" aria-label="Quick ranges">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id}
            className={`idf-chip${preset === p.id ? " sel" : ""}`} onClick={() => applyPreset(p)}>
            <i className={`fa-solid ${p.icon}`} aria-hidden="true" /> {p.label}
          </button>
        ))}
      </div>

      <div className="idf-fields">
        <label className="idf-field">
          <span>From</span>
          <input type="date" value={from} max={to || undefined}
            onChange={(e) => { setFrom(e.target.value); setPreset(""); }} />
        </label>
        <label className="idf-field">
          <span>To</span>
          <input type="date" value={to} min={from || undefined}
            onChange={(e) => { setTo(e.target.value); setPreset(""); }} />
        </label>
        <label className="idf-field">
          <span>Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {MONTHS.map((m, i) => <option key={m} value={pad(i + 1)}>{m}</option>)}
          </select>
        </label>
        <label className="idf-field">
          <span>Year</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button type="button" className="idf-reset" onClick={clearAll} disabled={!pills.length}>
          <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reset
        </button>
      </div>

      {pills.length > 0 && (
        <div className="idf-active">
          <small>Active:</small>
          {pills.map((p) => (
            <span className="idf-pill" key={p.id}>
              <i className={`fa-solid ${p.icon}`} aria-hidden="true" /> {p.label}
              <button type="button" onClick={p.clear} aria-label={`Remove ${p.label} filter`}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );

  return [rows, bar];
}