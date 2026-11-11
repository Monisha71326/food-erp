import "./CreditAgingReportPage.css";
import { getErpRecords } from "@/data/erpApi.js";
import { hubRequest } from "@/data/localDb.js";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

/* ==================================================================
   Credit Aging Report  (Sales & Invoice -> Credit Aging Report)
   - Client name, total and 0-29 / 30-59 / 60-89 / 90+ (Bad Credit) day
     amounts are CALCULATED from your real invoices (nothing hard-coded).
   - Click a client row to see the invoices behind the numbers.
   - "Check all dates" lists EVERY unpaid invoice with its invoice date,
     due date, days old and bucket, and flags missing / invalid dates.
   ================================================================== */

const CURRENCY = "£";      // change to "" for no symbol, or "₹" etc.
const LOCALE = "en-GB";    // "en-IN" gives 1,91,43,375.00 style grouping
/* Report uses the SAME invoices as Sales & Invoice > Invoices (ERP invoices).
   Set to true to also add the Order Hub invoices (orders delivered through the hub). */
const INCLUDE_ORDER_HUB = false;
const AGE_FROM = "invoiceDate"; // "invoiceDate" | "dueDate"

/* 4 buckets. Everything 90 days and older is "Bad Credit". */
const BUCKETS = [
  { key: "d0_30", label: "0 - 29 Days", short: "0 - 29 Days", min: 0, max: 29, rgb: "34,170,110" },
  { key: "d31_60", label: "30 - 59 Days", short: "30 - 59 Days", min: 30, max: 59, rgb: "190,170,20" },
  { key: "d61_90", label: "60 - 89 Days", short: "60 - 89 Days", min: 60, max: 89, rgb: "235,150,20" },
  { key: "d90p", label: "Bad Credit (90 Days & Above)", short: "Bad Credit", min: 90, max: Infinity, rgb: "200,35,60" },
];

const STAT_ICONS = {
  d0_30: "fa-circle-check",
  d31_60: "fa-clock",
  d61_90: "fa-hourglass-half",
  d90p: "fa-triangle-exclamation",
};

const STAT_LABELS = {
  d0_30: "Current (0 - 29 days)",
  d31_60: "30 - 59 Days",
  d61_90: "60 - 89 Days",
  d90p: "Bad Credit (90+ days)",
};

/* ==================================================================
   DATA SOURCES (real data, nothing hard-coded)
   1) Order Hub invoices  -> hubRequest("GET", "/state")   (src/data/localDb.js)
        client names come from state.clients, balance = amount - paid
   2) ERP invoices        -> getErpRecords("invoices")     (src/data/erpApi.js)
        the records saved by Sales > Invoices (customer, date, due, balance)
   ================================================================== */
async function loadHubInvoices() {
  const state = await hubRequest("GET", "/state");
  const names = {};
  (state?.clients || []).forEach((c) => (names[c.id] = c.name));
  return (state?.invoices || []).map((i) => ({
    _src: "hub",
    invoiceNo: i.id,
    customerName: names[i.clientId] || i.clientId,
    invoiceDate: i.date,
    status: i.status,
    balance: i.status === "Outstanding" ? Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)) : 0,
  }));
}

async function loadErpInvoices() {
  const rows = await getErpRecords("invoices");
  return rows.map((r) => ({ ...r, _src: "erp" }));
}

/* ---------- helpers: accept different field names ---------- */
const num = (v) => {
  const n = Number(String(v ?? 0).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const clientOf = (inv) => {
  const v = pick(inv, [
    "customerName", "clientName", "customer_name", "client_name", "accountName",
    "customer.name", "client.name", "customer.companyName", "client.companyName",
    "billTo.name", "billTo", "companyName", "company", "customer", "client",
  ]);
  return v && typeof v === "object" ? v.name || "Unknown" : String(v || "Unknown");
};

const invoiceNoOf = (inv) =>
  String(pick(inv, ["invoiceNo", "invoiceNumber", "number", "ref", "reference", "id"]) ?? "-");

const invoiceDateOf = (inv) =>
  pick(inv, ["invoiceDate", "invoice_date", "date", "issueDate", "issuedAt", "createdAt", "created_at"]);

const rawDueDateOf = (inv) => pick(inv, ["dueDate", "due_date", "paymentDue"]);
const dueDateOf = (inv) => rawDueDateOf(inv) || invoiceDateOf(inv);

const balanceOf = (inv) => {
  const direct = pick(inv, ["balance", "balanceDue", "balance_due", "outstanding", "amountDue", "amount_due"]);
  if (direct !== undefined) return num(direct);
  const total = num(pick(inv, ["total", "grandTotal", "grand_total", "totalAmount", "amount", "gross"]));
  let paid = num(pick(inv, ["paid", "amountPaid", "amount_paid", "paidAmount"]));
  if (Array.isArray(inv.payments)) {
    paid = Math.max(paid, inv.payments.reduce((s, p) => s + num(p?.amount ?? p), 0));
  }
  return total - paid;
};

const isCounted = (inv) => {
  const s = String(inv.status ?? inv.paymentStatus ?? "").toLowerCase();
  return !["paid", "cancelled", "canceled", "void", "draft", "rejected"].includes(s);
};

const daysOld = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

/* "3 Nov 2026" - or the raw text if it is not a real date, "-" if empty */
const fmtDate = (v) => {
  if (v === undefined || v === null || v === "") return "-";
  const d = new Date(v);
  return isNaN(d)
    ? String(v)
    : d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
};

/* what is wrong with the date the ageing is counted from (empty text = date is fine) */
const dateIssueOf = (basis) => {
  if (basis === undefined || basis === null || basis === "") return "No date - counted as 0 days";
  const d = new Date(basis);
  if (isNaN(d)) return "Invalid date - counted as 0 days";
  if (d.getTime() > Date.now() + 86400000) return "Date is in the future - counted as 0 days";
  return "";
};

const money = (n) =>
  CURRENCY +
  Number(n || 0).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

/* Bad Credit = any money 90+ days old.  Watch = money 30 - 89 days old.  Good = only 0 - 29 days. */
const riskOf = (r) => {
  if (r.d90p > 0) return { id: "critical", label: "Bad Credit" };
  if (r.d61_90 > 0 || r.d31_60 > 0) return { id: "watch", label: "Watch" };
  return { id: "good", label: "Good" };
};

const FILTERS = [
  { id: "all", label: "All clients" },
  { id: "critical", label: "Bad Credit (90+)" },
  { id: "watch", label: "Watch" },
  { id: "good", label: "Good" },
];

/* ==================================================================
   PAGE
   ================================================================== */
export default function CreditAgingReportPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "total", dir: "desc" });
  const [open, setOpen] = useState(() => new Set());
  const [showDates, setShowDates] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [hub, erp] = await Promise.all([INCLUDE_ORDER_HUB ? loadHubInvoices() : [], loadErpInvoices()]);
      setInvoices([...hub, ...erp]);
    } catch (e) {
      setError(e?.message || "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = invoices;

  /* ---- calculation: group unpaid invoices by client, drop balance into its day bucket ---- */
  const allRows = useMemo(() => {
    const map = {};
    visible.forEach((inv) => {
      if (!isCounted(inv)) return;
      const bal = balanceOf(inv);
      if (bal <= 0) return;

      const age = daysOld(AGE_FROM === "dueDate" ? dueDateOf(inv) : invoiceDateOf(inv));
      const bucket = BUCKETS.find((b) => age >= b.min && age <= b.max);
      const name = clientOf(inv);

      if (!map[name]) {
        map[name] = { name, total: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0, list: [] };
      }
      map[name][bucket.key] += bal;
      map[name].total += bal;
      map[name].list.push({ no: invoiceNoOf(inv), date: invoiceDateOf(inv), age, bal, bucket: bucket.key });
    });
    return Object.values(map).map((r) => ({
      ...r,
      current: r.d0_30,                          // CURRENT = 0 - 29 days (not overdue yet)
      due: r.d31_60 + r.d61_90 + r.d90p,         // DUE = 30 days and above (overdue)
      risk: riskOf(r),
      list: r.list.sort((a, b) => b.age - a.age),
    }));
  }, [visible]);

  /* ---- date check: EVERY unpaid invoice with its dates, age, bucket and any date problem ---- */
  const dateRows = useMemo(() => {
    const out = [];
    visible.forEach((inv) => {
      if (!isCounted(inv)) return;
      const bal = balanceOf(inv);
      if (bal <= 0) return;
      const basis = AGE_FROM === "dueDate" ? dueDateOf(inv) : invoiceDateOf(inv);
      const age = daysOld(basis);
      out.push({
        no: invoiceNoOf(inv),
        client: clientOf(inv),
        invoiceDate: invoiceDateOf(inv),
        dueDate: rawDueDateOf(inv),
        age,
        bal,
        bucket: BUCKETS.find((b) => age >= b.min && age <= b.max),
        issue: dateIssueOf(basis),
      });
    });
    return out.sort((a, b) => b.age - a.age);
  }, [visible]);
  const dateIssues = dateRows.filter((r) => r.issue).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allRows.filter(
      (r) => r.name.toLowerCase().includes(q) && (filter === "all" || r.risk.id === filter)
    );
    list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const res = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sort.dir === "asc" ? res : -res;
    });
    return list;
  }, [allRows, search, filter, sort]);

  const totals = useMemo(() => {
    const t = { total: 0, current: 0, due: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    rows.forEach((r) => Object.keys(t).forEach((k) => (t[k] += r[k])));
    return t;
  }, [rows]);

  const colMax = useMemo(() => {
    const m = {};
    BUCKETS.forEach((b) => (m[b.key] = Math.max(0, ...rows.map((r) => r[b.key]))));
    return m;
  }, [rows]);

  const pct = (v) => (totals.total ? (v / totals.total) * 100 : 0);

  /* number of clients that have money in a given bucket */
  const clientsIn = (key) => allRows.filter((r) => r[key] > 0).length;

  /* summary cards: Total + all buckets */
  const stats = [
    {
      key: "total",
      label: "Total Outstanding",
      value: totals.total,
      sub: `${rows.length} client${rows.length === 1 ? "" : "s"} with dues`,
      icon: "fa-sterling-sign",
      rgb: "155,28,58",
      share: totals.total ? 100 : 0,
      main: true,
    },
    ...BUCKETS.map((b) => ({
      key: b.key,
      label: STAT_LABELS[b.key],
      value: totals[b.key],
      sub: `${pct(totals[b.key]).toFixed(1)}% · ${clientsIn(b.key)} client(s)`,
      icon: STAT_ICONS[b.key],
      rgb: b.rgb,
      share: pct(totals[b.key]),
    })),
  ];

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
  const arrow = (key) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const toggleOpen = (name) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  const exportCsv = () => {
    const head = ["S.NO", "NAME", "TOTAL", "CURRENT", "DUE", ...BUCKETS.map((b) => b.label), "RISK"];
    const lines = rows.map((r, i) => [
      i + 1,
      `"${r.name.replace(/"/g, '""')}"`,
      r.total.toFixed(2),
      r.current.toFixed(2),
      r.due.toFixed(2),
      ...BUCKETS.map((b) => r[b.key].toFixed(2)),
      r.risk.label,
    ]);
    const csv = [head, ...lines].map((l) => l.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "credit-aging-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="credit-aging-page car">
      {/* ---------- header banner (same look as Sales > Invoices) ---------- */}
      <div className="car-banner">
        <div className="car-banner-icon">
          <i className="fa-solid fa-hourglass-half" />
        </div>
        <div className="car-banner-text">
          <span className="car-eyebrow">
            <b /> SALES
          </span>
          <h2>Credit Aging Report</h2>
          <p>Unpaid invoices grouped by client and by how many days they have been outstanding.</p>
        </div>
        <div className="car-actions">
          <button className="car-btn-primary" onClick={exportCsv} disabled={!rows.length}>
            <i className="fa-solid fa-download" /> Export CSV
          </button>
          <button className="car-btn-icon" onClick={load} title="Refresh">
            <i className="fa-solid fa-rotate" />
          </button>
          <button className="car-btn-white" onClick={() => window.print()}>
            <i className="fa-solid fa-print" /> Print
          </button>
        </div>
      </div>

      {/* ---------- summary strip: Total + all buckets ---------- */}
      <div className="car-strip">
        {stats.map((s, idx) => (
          <div key={s.key} className={"car-stat" + (s.main ? " main" : "")} style={{ "--c": s.rgb, "--i": idx }}>
            <span className="car-stat-ico"><i className={"fa-solid " + s.icon} /></span>
            <div className="car-stat-body">
              <small>{s.label}</small>
              <strong>{money(s.value)}</strong>
              <em>{s.sub}</em>
            </div>
            <div className="car-stat-meter"><i style={{ width: s.share + "%" }} /></div>
          </div>
        ))}
      </div>

      {/* ---------- CURRENT and DUE ---------- */}
      <div className="car-strip two">
        <div className="car-stat" style={{ "--c": "34,170,110", "--i": 0 }}>
          <span className="car-stat-ico"><i className="fa-solid fa-circle-check" /></span>
          <div className="car-stat-body">
            <small>Current (0 - 29 days)</small>
            <strong>{money(totals.current)}</strong>
            <em>{pct(totals.current).toFixed(1)}% · {clientsIn("d0_30")} client(s) · not overdue</em>
          </div>
          <div className="car-stat-meter"><i style={{ width: pct(totals.current) + "%" }} /></div>
        </div>
        <div className="car-stat" style={{ "--c": "225,95,40", "--i": 1 }}>
          <span className="car-stat-ico"><i className="fa-solid fa-file-circle-exclamation" /></span>
          <div className="car-stat-body">
            <small>Due (30 days & above)</small>
            <strong>{money(totals.due)}</strong>
            <em>{pct(totals.due).toFixed(1)}% · {allRows.filter((r) => r.due > 0).length} client(s) · overdue</em>
          </div>
          <div className="car-stat-meter"><i style={{ width: pct(totals.due) + "%" }} /></div>
        </div>
      </div>

      {/* ---------- overall aging bar ---------- */}
      {totals.total > 0 && (
        <div className="car-card">
          <div className="car-bar car-bar-big">
            {BUCKETS.map((b) =>
              totals[b.key] > 0 ? (
                <div
                  key={b.key}
                  title={`${b.label}: ${money(totals[b.key])}`}
                  style={{ width: pct(totals[b.key]) + "%", background: `rgb(${b.rgb})` }}
                />
              ) : null
            )}
          </div>
          <div className="car-legend">
            {BUCKETS.map((b) => (
              <span key={b.key}>
                <i style={{ background: `rgb(${b.rgb})` }} />
                {b.label} <b>{pct(totals[b.key]).toFixed(1)}%</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---------- toolbar ---------- */}
      <div className="car-toolbar">
        <input
          className="car-search"
          placeholder="Search client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="car-chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={filter === f.id ? "on" : ""}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <em>{f.id === "all" ? allRows.length : allRows.filter((r) => r.risk.id === f.id).length}</em>
            </button>
          ))}
        </div>
        <div className="car-chips">
          <button className={showDates ? "on" : ""} onClick={() => setShowDates((v) => !v)} aria-pressed={showDates}>
            <i className="fa-solid fa-calendar-check" /> Check all dates
            <em>{dateRows.length}</em>
          </button>
        </div>
      </div>

      {/* ---------- DATE CHECK: every unpaid invoice with its dates ---------- */}
      {showDates && (
        <div className="car-card car-table-wrap">
          <div style={{ padding: "14px 16px 4px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <b style={{ fontSize: 15 }}><i className="fa-solid fa-calendar-check" /> Date check - all unpaid invoices</b>
            <span
              style={{
                padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800,
                color: dateIssues ? "#b91c1c" : "#15803d",
                background: dateIssues ? "rgba(220,38,38,0.12)" : "rgba(34,197,94,0.15)",
              }}
            >
              {dateIssues ? `${dateIssues} invoice${dateIssues === 1 ? "" : "s"} with a date problem` : "All dates look fine"}
            </span>
            <small style={{ opacity: 0.7 }}>
              Age counted from {AGE_FROM === "dueDate" ? "due date" : "invoice date"}, as of today ({fmtDate(new Date())}).
            </small>
          </div>
          <table className="car-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>S.NO</th>
                <th>INVOICE</th>
                <th>CLIENT</th>
                <th>INVOICE DATE</th>
                <th>DUE DATE</th>
                <th className="num">DAYS OLD</th>
                <th className="num">BALANCE</th>
                <th>BUCKET</th>
                <th>DATE CHECK</th>
              </tr>
            </thead>
            <tbody>
              {dateRows.map((x, i) => (
                <tr key={`${x.no}-${i}`} style={x.issue ? { background: "rgba(220,38,38,0.07)" } : undefined}>
                  <td>{i + 1}</td>
                  <td><b>{x.no}</b></td>
                  <td>{x.client}</td>
                  <td>{fmtDate(x.invoiceDate)}</td>
                  <td>{fmtDate(x.dueDate)}</td>
                  <td className="num">{x.age}</td>
                  <td className="num">{money(x.bal)}</td>
                  <td>
                    <span className="car-pill" style={{ background: `rgba(${x.bucket.rgb},.18)`, color: `rgb(${x.bucket.rgb})` }}>
                      {x.bucket.short}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, fontWeight: 700, color: x.issue ? "#b91c1c" : "#15803d", whiteSpace: "nowrap" }}>
                    {x.issue ? <><i className="fa-solid fa-triangle-exclamation" /> {x.issue}</> : <><i className="fa-solid fa-check" /> OK</>}
                  </td>
                </tr>
              ))}
              {dateRows.length === 0 && (
                <tr><td colSpan={9} className="car-empty">{loading ? "Loading invoices..." : "No unpaid invoices to check."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- table ---------- */}
      <div className="car-card car-table-wrap">
        <table className="car-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>S.NO</th>
              <th onClick={() => toggleSort("name")}>NAME{arrow("name")}</th>
              <th className="num" onClick={() => toggleSort("total")}>TOTAL{arrow("total")}</th>
              <th className="num" onClick={() => toggleSort("current")}>CURRENT{arrow("current")}</th>
              <th className="num" onClick={() => toggleSort("due")}>DUE{arrow("due")}</th>
              {BUCKETS.map((b) => (
                <th key={b.key} className="num" onClick={() => toggleSort(b.key)} title={b.label}>
                  <i className="car-dot" style={{ background: `rgb(${b.rgb})` }} />
                  {b.short.toUpperCase()}
                  {arrow(b.key)}
                </th>
              ))}
              <th>RISK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = open.has(r.name);
              return (
                <Fragment key={r.name}>
                  <tr className={"car-row" + (isOpen ? " open" : "")} onClick={() => toggleOpen(r.name)}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="car-client">
                        <span className="car-avatar">{initials(r.name)}</span>
                        <div>
                          <div className="car-name">{r.name}</div>
                          <div className="car-sub">{r.list.length} unpaid invoice{r.list.length === 1 ? "" : "s"}</div>
                          <div className="car-bar car-bar-small">
                            {BUCKETS.map((b) =>
                              r[b.key] > 0 ? (
                                <div key={b.key} style={{ width: (r[b.key] / r.total) * 100 + "%", background: `rgb(${b.rgb})` }} />
                              ) : null
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="num strong">{money(r.total)}</td>
                    <td className={"num" + (r.current ? "" : " zero")} style={{ color: r.current ? "rgb(34,170,110)" : undefined, fontWeight: 700 }}>{money(r.current)}</td>
                    <td className={"num" + (r.due ? "" : " zero")} style={{ color: r.due ? "rgb(225,95,40)" : undefined, fontWeight: 700 }}>{money(r.due)}</td>
                    {BUCKETS.map((b) => {
                      const v = r[b.key];
                      const a = colMax[b.key] ? 0.1 + 0.28 * (v / colMax[b.key]) : 0;
                      return (
                        <td
                          key={b.key}
                          className={"num" + (v ? "" : " zero")}
                          style={v ? { background: `rgba(${b.rgb},${a.toFixed(2)})` } : undefined}
                        >
                          {money(v)}
                        </td>
                      );
                    })}
                    <td>
                      <span className={"car-badge " + r.risk.id}>{r.risk.label}</span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="car-detail">
                      <td />
                      <td colSpan={BUCKETS.length + 5}>
                        <table className="car-inner">
                          <thead>
                            <tr>
                              <th>Invoice</th>
                              <th>Date</th>
                              <th className="num">Days old</th>
                              <th className="num">Balance</th>
                              <th>Bucket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.list.map((x, k) => {
                              const b = BUCKETS.find((bb) => bb.key === x.bucket);
                              return (
                                <tr key={k}>
                                  <td>{x.no}</td>
                                  <td>{fmtDate(x.date)}</td>
                                  <td className="num">{x.age}</td>
                                  <td className="num">{money(x.bal)}</td>
                                  <td>
                                    <span className="car-pill" style={{ background: `rgba(${b.rgb},.18)`, color: `rgb(${b.rgb})` }}>
                                      {b.short}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {(loading || error || rows.length === 0) && (
              <tr>
                <td colSpan={BUCKETS.length + 6} className="car-empty">
                  {loading ? (
                    "Loading invoices..."
                  ) : error ? (
                    error
                  ) : invoices.length === 0 ? (
                    <>
                      <b>No invoices found.</b>
                      <br />
                      Raise an invoice in <i>Sales &amp; Invoice → Invoices</i>, then press Refresh.
                    </>
                  ) : (
                    "No clients match this filter."
                  )}
                </td>
              </tr>
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>GRAND TOTAL</td>
                <td className="num">{money(totals.total)}</td>
                <td className="num">{money(totals.current)}</td>
                <td className="num">{money(totals.due)}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className="num">{money(totals[b.key])}</td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="car-foot">
        {visible.length} invoice{visible.length === 1 ? "" : "s"} read · ageing counted from{" "}
        {AGE_FROM === "dueDate" ? "due date" : "invoice date"} · only unpaid balances are counted (paid, cancelled, draft and void are skipped).
        {dateIssues > 0 && ` ${dateIssues} invoice${dateIssues === 1 ? " has" : "s have"} a missing or invalid date (see Check all dates).`}
      </p>
    </div>
  );
}