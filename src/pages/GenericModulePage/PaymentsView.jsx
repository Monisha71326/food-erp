import { useMemo, useState } from "react";
import { fmtDate } from "@/utils/format.js";
import ReviewModal from "./ReviewModal.jsx";
import NewPaymentModal from "./NewPaymentModal.jsx";
import "./PaymentsView.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = [
  { key: "all", label: "All", icon: "fa-layer-group", test: () => true },
  { key: "pending", label: "Pending", icon: "fa-hourglass-half", test: (s) => /pending/i.test(s) },
  { key: "approved", label: "Approved", icon: "fa-circle-check", test: (s) => /approved|completed|paid/i.test(s) },
  { key: "rejected", label: "Rejected", icon: "fa-circle-xmark", test: (s) => /rejected|cancelled/i.test(s) },
];

const toneOf = (status = "") => {
  if (/pending/i.test(status)) return "orange";
  if (/approved|completed|paid/i.test(status)) return "green";
  if (/rejected|cancelled/i.test(status)) return "red";
  return "gray";
};

const initials = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const sum = (list) => list.reduce((t, r) => t + Number(r.amount || 0), 0);

const isPending = (row) => /pending/i.test(row.status || "");

/* only payments that came from the Invoices page (they carry an invoice number) can be bulk approved */
const needsApproval = (row) => isPending(row) && !!row.invoice;

/* ====================================================================
   Payments page body
   ==================================================================== */
/* old saved records may still carry Draft / Active: show them as Pending / Completed */
const LEGACY_STATUS = { draft: "Pending", active: "Completed" };
const fixStatus = (s) => LEGACY_STATUS[String(s || "").trim().toLowerCase()] || s;

export default function PaymentsView({ rows: rawRows, loading, canApprove, onApprove, onReject, onApproveMany, onEdit, onDelete, onNew, onCreate }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState([]); // ids ticked for bulk approve
  const [review, setReview] = useState(null); // row open in the review popup
  const [adding, setAdding] = useState(false); // "Add payment" popup (customer -> invoice -> pay)
  const rows = useMemo(() => rawRows.map((r) => ({ ...r, status: fixStatus(r.status) })), [rawRows]);

  const pending = useMemo(() => rows.filter(isPending), [rows]);
  const waiting = useMemo(() => rows.filter(needsApproval), [rows]);
  const approved = useMemo(() => rows.filter((r) => TABS[2].test(r.status || "")), [rows]);
  const rejected = useMemo(() => rows.filter((r) => TABS[3].test(r.status || "")), [rows]);

  const counts = { all: rows.length, pending: pending.length, approved: approved.length, rejected: rejected.length };

  const list = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => t.test(r.status || "") && (!q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)))
    );
  }, [rows, tab, query]);

  const selectable = useMemo(() => (canApprove ? list.filter(needsApproval) : []), [list, canApprove]);
  const selRows = selectable.filter((r) => sel.includes(r.id));
  const allOn = selectable.length > 0 && selRows.length === selectable.length;

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSel(allOn ? [] : selectable.map((r) => r.id));

  const bulkApprove = async () => {
    if (!window.confirm(`Approve ${selRows.length} payment${selRows.length === 1 ? "" : "s"} (${money(sum(selRows))})? Their invoices will be updated.`)) return;
    await onApproveMany(selRows);
    setSel([]);
  };

  const stats = [
    { tone: "orange", icon: "fa-hourglass-half", label: "Awaiting approval", value: pending.length, sub: pending.some((r) => r.amount) ? money(sum(pending)) : "Need attention" },
    { tone: "green", icon: "fa-circle-check", label: "Approved", value: approved.length, sub: approved.some((r) => r.amount) ? money(sum(approved)) : "Approved / completed" },
    { tone: "red", icon: "fa-circle-xmark", label: "Rejected", value: rejected.length, sub: rejected.some((r) => r.amount) ? money(sum(rejected)) : "Declined payments" },
    { tone: "blue", icon: "fa-layer-group", label: "Total records", value: rows.length, sub: "Saved records" },
  ];

  const cols = canApprove ? 7 : 6;

  return (
    <div className="pay-view">
      {/* ---------- KPI cards ---------- */}
      <div className="pv-stats">
        {stats.map((s) => (
          <div key={s.label} className={`pv-stat ${s.tone}`}>
            <span className="pv-stat-icon"><i className={`fa-solid ${s.icon}`} /></span>
            <div>
              <small>{s.label}</small>
              <b>{s.value}</b>
              <em>{s.sub}</em>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- approval banner ---------- */}
      {waiting.length > 0 && (
        <div className="pv-banner" role="status">
          <span className="pv-banner-icon"><i className="fa-solid fa-bell" /></span>
          <div className="pv-banner-txt">
            <b>{waiting.length} payment{waiting.length === 1 ? "" : "s"} waiting for {canApprove ? "your" : "Admin"} approval</b>
            <small>
              {money(sum(waiting))} submitted from the Invoices page.{" "}
              {canApprove ? "Review each one, or tick several and approve together." : "The invoice turns Paid once approved."}
            </small>
          </div>
          <button type="button" className="pv-banner-btn" onClick={() => setTab("pending")}>
            Review now <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      )}

      {/* ---------- list ---------- */}
      <section className="pv-panel">
        <div className="pv-toolbar">
          <div className="pv-tabs" role="tablist" aria-label="Filter payments">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={`pv-tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
                <i className={`fa-solid ${t.icon}`} /> {t.label}
                <span className="pv-count">{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label className="pv-search">
              <i className="fa-solid fa-magnifying-glass" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, invoice, reference..." />
              {query && <button type="button" aria-label="Clear" onClick={() => setQuery("")}><i className="fa-solid fa-xmark" /></button>}
            </label>
            <button type="button" className="pv-banner-btn" onClick={() => setAdding(true)}>
              <i className="fa-solid fa-plus" /> Add payment
            </button>
          </div>
        </div>

        {/* bulk action bar */}
        {selRows.length > 0 && (
          <div className="pv-bulk" role="status">
            <span className="pv-bulk-n">{selRows.length}</span>
            <div><b>{selRows.length} selected</b><small>{money(sum(selRows))} in total</small></div>
            <button type="button" className="pv-go ok" onClick={bulkApprove}><i className="fa-solid fa-check-double" /> Approve selected</button>
            <button type="button" className="pv-go no" onClick={() => setSel([])}>Clear</button>
          </div>
        )}

        <div className="pv-table-wrap">
          <table className="pv-table">
            <thead>
              <tr>
                {canApprove && (
                  <th className="chk">
                    <input type="checkbox" aria-label="Select all pending" checked={allOn} disabled={!selectable.length} onChange={toggleAll} />
                  </th>
                )}
                <th>Payment</th>
                <th>Reference</th>
                <th>Method &amp; date</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th className="act">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={cols} className="pv-empty">Loading payments…</td></tr>}

              {!loading && list.map((row) => {
                const tone = toneOf(row.status);
                const name = row.name || row.customerName || `Payment #${row.id}`;
                const ask = needsApproval(row);
                const pend = isPending(row);
                const decision =
                  /approved/i.test(row.status || "") && row.approvedBy
                    ? `By ${row.approvedBy}${row.approvedOn ? " · " + fmtDate(row.approvedOn) : ""}`
                    : /rejected/i.test(row.status || "") && row.rejectReason
                      ? row.rejectReason
                      : "";
                return (
                  <tr key={row.id} className={pend ? "ask" : ""}>
                    {canApprove && (
                      <td data-label="Select" className="chk">
                        {ask && <input type="checkbox" aria-label={`Select ${row.number || row.id}`} checked={sel.includes(row.id)} onChange={() => toggle(row.id)} />}
                      </td>
                    )}
                    <td data-label="Payment">
                      <div className="pv-who">
                        <span className={`pv-av ${tone}`}>{initials(name)}</span>
                        <div>
                          <b>{name}</b>
                          <small>
                            {row.number ? `${row.number} · ` : ""}
                            {row.invoice ? <>Invoice <u>{row.invoice}</u></> : `Record ID: ${row.id}`}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Reference">
                      <b className="pv-ref">{row.reference || row.code || "—"}</b>
                      <small>{row.email || row.owner || row.assignedTo || "—"}</small>
                    </td>
                    <td data-label="Method & date">
                      {row.method ? <span className="pv-method">{row.method}</span> : <span className="pv-dash">—</span>}
                      <small>{row.date ? fmtDate(row.date) : "—"}</small>
                    </td>
                    <td data-label="Amount" className="num">
                      {row.amount ? <b className="pv-amt">{money(row.amount)}</b> : <span className="pv-dash">—</span>}
                    </td>
                    <td data-label="Status">
                      <span className={`pv-pill ${tone}`}><i />{row.status || "—"}</span>
                      {decision && <small className="pv-decision" title={decision}>{decision}</small>}
                    </td>
                    <td data-label="Actions" className="act">
                      <div className="pv-actions">
                        {canApprove && pend && (
                          <button type="button" className="pv-go review" onClick={() => setReview(row)} title="Review and approve">
                            <i className="fa-solid fa-clipboard-check" /> Review
                          </button>
                        )}
                        <button type="button" className="pv-ic" onClick={() => onEdit(row)} title="Edit record" aria-label="Edit record">
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button type="button" className="pv-ic danger" onClick={() => onDelete(row)} title="Delete record" aria-label="Delete record">
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={cols} className="pv-empty">
                    <i className="fa-regular fa-folder-open" />
                    <b>{rows.length ? "No matching payments" : "No payments yet"}</b>
                    <span>{rows.length ? "Try another tab or clear the search." : "Add a payment for a customer's invoice, or submit one from the Invoices page."}</span>
                    {!rows.length && <button type="button" className="pv-banner-btn" onClick={() => setAdding(true)}>Add payment</button>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pv-foot">
          Showing <b>{list.length}</b> of {rows.length} payment{rows.length === 1 ? "" : "s"}
        </div>
      </section>

      {review && (
        <ReviewModal
          key={review.id}
          row={review}
          onClose={() => setReview(null)}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {adding && <NewPaymentModal onClose={() => setAdding(false)} onCreate={onCreate} />}
    </div>
  );
}