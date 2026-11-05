import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import CountUp from "@/components/CountUp/CountUp.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import { dateColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { CURRENCY } from "@/config/constants.js";
import { money } from "@/utils/format.js";
import { useHub, client, clientInvoices, clientPayments, clientOrders, createInvoice, iso } from "@/data/orderHubStore.js";
import { getErpRecords } from "@/data/erpApi.js";
import { currentUser } from "@/data/authStore.js";
import "./AccountStatementPage.css";

/* ---------- ageing helpers ---------- */
const DAY = 86400000;
const ageOf = (r) => Math.max(0, Math.floor((Date.now() - new Date(r.date).getTime()) / DAY));
const dueOf = (r) => Math.max(0, Number(r.amount || 0) - Number(r.paid || 0));

const BUCKETS = [
  { key: "b30", label: "0 - 29 days", short: "0-29", tone: "green", test: (d) => d <= 29 },
  { key: "b60", label: "30 - 59 days", short: "30-59", tone: "yellow", test: (d) => d >= 30 && d <= 59 },
  { key: "b90", label: "60 - 89 days", short: "60-89", tone: "orange", test: (d) => d >= 60 && d <= 89 },
  { key: "b120", label: "90 - 119 days", short: "90-119", tone: "red", test: (d) => d >= 90 && d <= 119 },
  { key: "bad", label: "120 days & above", short: "120+", tone: "dark", bad: true, test: (d) => d >= 120 },
];
const bucketOf = (r) => BUCKETS.find((b) => b.test(ageOf(r)));

const norm = (s) => String(s || "").toLowerCase();
const isPaid = (r) => norm(r.status) === "paid";
const isCancelled = (r) => ["cancelled", "canceled", "void"].includes(norm(r.status));
const isOutstanding = (r) => !isPaid(r) && !isCancelled(r);

const invoiceColumns = [
  dateColumn("date", "Date"),
  { key: "id", label: "Reference", sortable: true },
  amountColumn("amount", "Amount", 2),
  {
    key: "due", label: "Balance Due", align: "right", sortable: true, sortValue: (r) => (isOutstanding(r) ? dueOf(r) : 0),
    render: (r) => (isOutstanding(r) ? money(dueOf(r), 2) : <span className="muted">--</span>),
  },
  {
    key: "age", label: "Age", sortable: true, sortValue: (r) => (isOutstanding(r) ? ageOf(r) : -1),
    render: (r) => {
      if (!isOutstanding(r)) return <span className="muted">--</span>;
      const b = bucketOf(r);
      return <span className={`as-age ${b.tone}`}>{ageOf(r)} {ageOf(r) === 1 ? "day" : "days"}{b.bad ? " · Bad credit" : ""}</span>;
    },
  },
  { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
];

const periodColumns = [
  { key: "id", label: "Invoice No", sortable: true },
  {
    key: "total", label: "Total", align: "right", sortable: true, sortValue: (r) => r.total,
    render: (r) => <b className="as-ptotal">{money(r.total, 2)}</b>,
  },
  ...BUCKETS.map((b) => ({
    key: b.key, label: b.bad ? `${b.label} (Bad credit)` : b.label, align: "right", sortable: true, sortValue: (r) => r[b.key],
    render: (r) => (r[b.key] > 0
      ? <span className={`as-pcell ${b.tone}`}>{money(r[b.key], 2)}</span>
      : <span className="muted">0.00</span>),
  })),
];

const paymentColumns = [
  dateColumn("date", "Date"),
  { key: "id", label: "Payment Ref", sortable: true },
  { key: "invoiceId", label: "Invoice", sortable: true },
  { key: "method", label: "Method", sortable: true },
  amountColumn("amount", "Amount Paid", 2),
];

const creditColumns = [
  dateColumn("date", "Date"),
  { key: "id", label: "Credit Note#", sortable: true },
  { key: "invoice", label: "Against Invoice", sortable: true, render: (r) => r.invoice || <span className="muted">--</span> },
  { key: "ref", label: "Reference", sortable: true, render: (r) => r.ref || <span className="muted">--</span> },
  { key: "status", label: "Status", sortable: true },
  amountColumn("amount", "Credit Amount", 2),
];

const FILTERS = [
  { key: "all", label: "All", icon: "fa-layer-group", test: () => true },
  { key: "outstanding", label: "Outstanding", icon: "fa-hourglass-half", test: isOutstanding },
  { key: "paid", label: "Paid", icon: "fa-circle-check", test: isPaid },
];

const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== "";

const fromErpInvoice = (r) => {
  const st = norm(r.status);
  if (st === "draft") return null;
  const amount = Number(r.amount || 0);
  const balance = hasValue(r.balance) ? Number(r.balance) : (st === "paid" ? 0 : amount);
  let status = "Outstanding";
  if (["void", "cancelled", "canceled"].includes(st)) status = "Cancelled";
  else if (st === "paid" || balance <= 0) status = "Paid";
  return {
    id: r.number || r.invoiceNumber,
    date: r.date,
    dueDate: r.due || r.dueDate,
    amount,
    paid: Math.max(0, amount - balance),
    status,
  };
};
const fromErpPayment = (p) => ({
  id: p.number, date: p.date, invoiceId: p.invoice, method: p.method, amount: Number(p.amount || 0),
});
const fromErpCredit = (r) => ({
  id: r.number || r.creditNoteNumber,
  date: r.date,
  invoice: String(r.invoice || "").trim(),
  ref: r.ref || r.reference || "",
  status: r.status || "Open",
  amount: Number(r.amount || 0),
});

const TEST_AGES = [
  { days: 10, label: "10 days old (0 - 29)" },
  { days: 45, label: "45 days old (30 - 59)" },
  { days: 75, label: "75 days old (60 - 89)" },
  { days: 105, label: "105 days old (90 - 119)" },
  { days: 150, label: "150 days old (120 & above)" },
];

const sumAmount = (list) => list.reduce((sum, r) => sum + Number(r.amount || 0), 0);
const money2 = (n) => `${CURRENCY}${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* When an Area Manager is logged in, these are hidden automatically:
   credit notes, Total Paid, Total Invoiced, "Paid so far" bar, Period-wise Statement.
   (the hideCredits prop can still force-hide credit notes for other cases) */
export default function AccountStatementPage({ clientId, embedded = false, hideCredits: hideCreditsProp = false }) {
  const isManager = currentUser()?.role === "manager";
  const hideCredits = hideCreditsProp || isManager;

  const s = useHub();
  const c = client(clientId || s.session.clientId);
  const hubPayments = clientPayments(c.id);
  const hubInvoices = clientInvoices(c.id);

  const [erpInvoices, setErpInvoices] = useState([]);
  const [erpPayments, setErpPayments] = useState([]);
  const [credits, setCredits] = useState([]);
  useEffect(() => {
    let live = true;
    getErpRecords("invoices")
      .then((list) => live && setErpInvoices(
        (Array.isArray(list) ? list : []).filter((r) => sameName(r.customer || r.customerName, c.name)).map(fromErpInvoice).filter(Boolean),
      ))
      .catch(() => {});
    getErpRecords("payments-received")
      .then((list) => live && setErpPayments(
        (Array.isArray(list) ? list : []).filter((p) => sameName(p.customer || p.customerName, c.name)).map(fromErpPayment),
      ))
      .catch(() => {});
    getErpRecords("credit-notes")
      .then((list) => live && setCredits(
        (Array.isArray(list) ? list : []).filter((r) => sameName(r.customer || r.customerName, c.name)).map(fromErpCredit)
          .filter((r) => !isCancelled(r)),
      ))
      .catch(() => {});
    return () => { live = false; };
  }, [c.name]);

  const erpInvoiceIds = useMemo(() => new Set(erpInvoices.map((r) => String(r.id))), [erpInvoices]);
  const hubInvoiceIds = useMemo(() => new Set(hubInvoices.map((r) => String(r.id))), [hubInvoices]);

  const hubAdjusted = useMemo(() => hubInvoices.map((r) => {
    const credit = credits
      .filter((cn) => cn.invoice && cn.invoice === String(r.id) && !erpInvoiceIds.has(cn.invoice))
      .reduce((sum, cn) => sum + cn.amount, 0);
    if (credit <= 0) return r;
    const paid = Math.min(Number(r.amount || 0), Number(r.paid || 0) + credit);
    const settled = Number(r.amount || 0) - paid <= 0;
    return { ...r, paid, status: settled && isOutstanding(r) ? "Paid" : r.status };
  }), [hubInvoices, credits, erpInvoiceIds]);

  const unappliedCredit = useMemo(
    () => credits
      .filter((cn) => !cn.invoice || (!erpInvoiceIds.has(cn.invoice) && !hubInvoiceIds.has(cn.invoice)))
      .reduce((sum, cn) => sum + cn.amount, 0),
    [credits, erpInvoiceIds, hubInvoiceIds],
  );
  const totalCredit = useMemo(() => credits.reduce((sum, cn) => sum + cn.amount, 0), [credits]);

  const allInvoices = useMemo(() => {
    const ids = new Set(erpInvoices.map((r) => r.id));
    return [...erpInvoices, ...hubAdjusted.filter((r) => !ids.has(r.id))]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [erpInvoices, hubAdjusted]);
  const payments = useMemo(() => {
    const ids = new Set(erpPayments.map((p) => p.id));
    return [...erpPayments, ...hubPayments.filter((p) => !ids.has(p.id))]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [erpPayments, hubPayments]);

  const invoiceDue = useMemo(() => allInvoices.filter(isOutstanding).reduce((sum, r) => sum + dueOf(r), 0), [allInvoices]);
  const balance = Math.max(0, invoiceDue - unappliedCredit);

  const [filter, setFilter] = useState("all");
  const [bucket, setBucket] = useState("");

  const clientOrderList = clientOrders(c.id);
  const [showAdd, setShowAdd] = useState(false);
  const [testForm, setTestForm] = useState({ days: 45, amount: "100", orderId: "" });
  const [adding, setAdding] = useState(false);
  const addTestInvoice = async (e) => {
    e.preventDefault();
    if (adding) return;
    const amount = Number(testForm.amount);
    if (!(amount > 0)) return window.alert("Enter an amount greater than zero.");
    setAdding(true);
    const r = await createInvoice({
      clientId: c.id,
      orderId: testForm.orderId || clientOrderList[0]?.id,
      amount,
      status: "Outstanding",
      date: iso(-Number(testForm.days)),
    });
    setAdding(false);
    if (!r?.ok) return window.alert(r?.msg || "Could not add the invoice.");
  };

  const totalPaid = useMemo(() => {
    const paymentsTotal = sumAmount(payments);
    return paymentsTotal > 0 ? paymentsTotal : sumAmount(allInvoices.filter(isPaid));
  }, [payments, allInvoices]);

  const totalInvoiced = useMemo(() => sumAmount(allInvoices.filter((r) => !isCancelled(r))), [allInvoices]);
  const openCount = useMemo(() => allInvoices.filter(isOutstanding).length, [allInvoices]);
  const paidPct = totalInvoiced > 0 ? Math.min(100, Math.round(((totalPaid + totalCredit) / totalInvoiced) * 100)) : 0;

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, allInvoices.filter(f.test).length])),
    [allInvoices],
  );
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    let list = allInvoices.filter(f.test);
    if (bucket) list = list.filter((r) => isOutstanding(r) && bucketOf(r)?.key === bucket);
    return list;
  }, [allInvoices, filter, bucket]);

  const ageing = useMemo(() => {
    const open = allInvoices.filter(isOutstanding);
    const total = open.reduce((sum, r) => sum + dueOf(r), 0);
    return BUCKETS.map((b) => {
      const list = open.filter((r) => bucketOf(r)?.key === b.key);
      const amount = list.reduce((sum, r) => sum + dueOf(r), 0);
      return { ...b, count: list.length, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
    });
  }, [allInvoices]);
  const badAmount = ageing.find((b) => b.bad)?.amount || 0;
  const activeBucket = ageing.find((b) => b.key === bucket);

  const outstandingTotal = useMemo(() => allInvoices.filter(isOutstanding).reduce((sum, r) => sum + dueOf(r), 0), [allInvoices]);

  const periodRows = useMemo(
    () => allInvoices.filter(isOutstanding).map((r) => {
      const due = dueOf(r);
      const b = bucketOf(r);
      return { id: r.id, total: due, ...Object.fromEntries(BUCKETS.map((x) => [x.key, b && x.key === b.key ? due : 0])) };
    }),
    [allInvoices],
  );
  const periodTotal = useMemo(() => periodRows.reduce((sum, r) => sum + r.total, 0), [periodRows]);

  return (
    <div className={embedded ? "account-statement-page" : "page-anim account-statement-page"}>
      {!embedded && (
        <PageHeader eyebrow="CLIENT PORTAL" title="Account Statement" subtitle={c.name} icon="fa-file-lines" actions={<ViewingAs kind="client" />} />
      )}

      <section className={`as-summary${isManager ? " solo" : ""}`}>
        <div className="as-hero">
          <span className="as-hero-ico"><i className="fa-solid fa-scale-unbalanced" aria-hidden="true" /></span>
          <div className="as-hero-body">
            <p className="as-label">Outstanding Balance{embedded ? ` · ${c.name}` : ""}</p>
            <p className="as-hero-value"><CountUp value={balance} decimals={2} prefix={CURRENCY} /></p>
            <p className="as-hero-sub">
              {openCount > 0 ? `${openCount} open invoice${openCount === 1 ? "" : "s"}` : "All invoices are settled"}
              {totalCredit > 0 && !hideCredits ? ` · ${money2(totalCredit)} credit notes applied` : ""}
            </p>
          </div>
          {!isManager && (
            <div className="as-progress" aria-label={`${paidPct}% paid`}>
              <div className="as-progress-top"><span>Paid so far</span><b>{paidPct}%</b></div>
              <div className="as-bar"><i style={{ width: `${paidPct}%` }} /></div>
            </div>
          )}
        </div>

        {!isManager && (
          <>
            <div className="as-stat green">
              <span className="as-stat-ico"><i className="fa-solid fa-circle-check" aria-hidden="true" /></span>
              <div>
                <p className="as-label">Total Paid</p>
                <p className="as-stat-value"><CountUp value={totalPaid} decimals={2} prefix={CURRENCY} /></p>
              </div>
            </div>

            <div className="as-stat blue">
              <span className="as-stat-ico"><i className="fa-solid fa-file-invoice-dollar" aria-hidden="true" /></span>
              <div>
                <p className="as-label">Total Invoiced</p>
                <p className="as-stat-value"><CountUp value={totalInvoiced} decimals={2} prefix={CURRENCY} /></p>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="as-ageing" aria-label="Ageing of outstanding balance">
        <div className="as-ageing-head">
          <h3 className="statement-title"><i className="fa-solid fa-hourglass-half" aria-hidden="true" /> Ageing of Outstanding Balance</h3>
          {badAmount > 0 && (
            <span className="as-bad-flag"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Bad credit: {money2(badAmount)}</span>
          )}
        </div>
        <div className="as-ageing-grid">
          {ageing.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`as-bucket ${b.tone}${bucket === b.key ? " on" : ""}${b.count === 0 ? " empty" : ""}`}
              aria-pressed={bucket === b.key}
              onClick={() => { setBucket(bucket === b.key ? "" : b.key); setFilter("all"); }}
            >
              <span className="as-bucket-top">
                <span className="as-bucket-label">{b.label}</span>
                {b.bad && <em className="as-bucket-tag">Bad credit</em>}
              </span>
              <b className="as-bucket-amount">{money2(b.amount)}</b>
              <span className="as-bucket-meta">{b.count} invoice{b.count === 1 ? "" : "s"} · {b.pct}%</span>
              <span className="as-bucket-bar"><i style={{ width: `${b.pct}%` }} /></span>
            </button>
          ))}
        </div>
      </section>

      {!embedded && (
        <div className="as-test">
          <button type="button" className="as-test-toggle" onClick={() => setShowAdd((v) => !v)} aria-expanded={showAdd}>
            <i className={`fa-solid ${showAdd ? "fa-chevron-up" : "fa-plus"}`} aria-hidden="true" /> Add test invoice
          </button>
          {showAdd && (
            <form className="as-test-form" onSubmit={addTestInvoice}>
              <label>
                <span>Invoice age</span>
                <select value={testForm.days} onChange={(e) => setTestForm({ ...testForm, days: e.target.value })}>
                  {TEST_AGES.map((a) => <option key={a.days} value={a.days}>{a.label}</option>)}
                </select>
              </label>
              <label>
                <span>Amount ({CURRENCY})</span>
                <input type="number" min="0.01" step="0.01" required value={testForm.amount}
                  onChange={(e) => setTestForm({ ...testForm, amount: e.target.value })} />
              </label>
              <label>
                <span>Order</span>
                <select value={testForm.orderId} onChange={(e) => setTestForm({ ...testForm, orderId: e.target.value })}>
                  {clientOrderList.length === 0 && <option value="">No orders</option>}
                  {clientOrderList.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>
              </label>
              <button type="submit" className="as-test-add" disabled={adding}>{adding ? "Adding..." : "Add invoice"}</button>
            </form>
          )}
        </div>
      )}

      {!isManager && (
      <>
      <div className="statement-head">
        <h3 className="statement-title"><i className="fa-solid fa-file-invoice" aria-hidden="true" /> Invoices</h3>

        <div className="statement-filters" role="tablist" aria-label="Filter invoices">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`st-chip st-${f.key}${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              <i className={`fa-solid ${f.icon}`} aria-hidden="true" />
              {f.label}
              <span className="st-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {activeBucket && (
        <div className="statement-note as-bucket-note">
          <i className="fa-solid fa-filter" aria-hidden="true" /> Showing invoices aged <b>{activeBucket.label}</b>
          {activeBucket.bad ? " (bad credit)" : ""} - {money2(activeBucket.amount)} due
          <button type="button" className="as-clear" onClick={() => setBucket("")}>Clear</button>
        </div>
      )}

      {filter === "outstanding" && !activeBucket && (
        <div className="statement-note">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> Outstanding invoices total: <b>{money2(outstandingTotal)}</b>
          {unappliedCredit > 0 && !hideCredits && <> · less unapplied credit <b>{money2(unappliedCredit)}</b> = <b>{money2(balance)}</b></>}
        </div>
      )}

      <DataTable columns={invoiceColumns} rows={rows} entity="statement lines" searchPlaceholder="Search statement" />
      </>
      )}

      {!isManager && (
        <>
          <div className="statement-head">
            <h3 className="statement-title"><i className="fa-solid fa-table-list" aria-hidden="true" /> Period-wise Statement</h3>
            <span className="as-period-sum">Total outstanding: <b>{money2(periodTotal)}</b></span>
          </div>
          <DataTable columns={periodColumns} rows={periodRows} entity="period statement" searchPlaceholder="Search invoice number" />
        </>
      )}

      {!hideCredits && (
        <>
          <div className="statement-head">
            <h3 className="statement-title"><i className="fa-solid fa-file-circle-minus" aria-hidden="true" /> Credit Notes</h3>
            <span className="as-period-sum">Total credit: <b>{money2(totalCredit)}</b></span>
          </div>
          <DataTable columns={creditColumns} rows={credits} entity="credit notes" searchPlaceholder="Search credit notes" />
        </>
      )}

      <div className="statement-head">
        <h3 className="statement-title"><i className="fa-solid fa-money-bill-transfer" aria-hidden="true" /> Payments Received</h3>
      </div>
      <DataTable columns={paymentColumns} rows={payments} entity="payments" searchPlaceholder="Search payments" />
    </div>
  );
}