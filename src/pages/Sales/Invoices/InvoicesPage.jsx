import { useEffect, useState } from "react";
import ListPage from "@/components/ListPage/ListPage.jsx";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { CellIcon, dateColumn, textColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import { getErpRecords, createErpRecord, updateErpRecord, deleteErpRecord } from "@/data/erpApi.js";
import { fmtDate } from "@/utils/format.js";
import "./InvoicesPage.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* local-date "YYYY-MM-DD" (offset = days from today) */
const todayISO = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const PAY_METHODS = ["Bank Transfer", "Card", "Cheque", "Cash"];

/* next free payment number: PAY-4011, PAY-4012 ... */
const nextPayNo = (rows) => {
  const max = rows.reduce((m, r) => {
    const s = String(r.number || "");
    const n = parseInt(s.replace(/\D/g, ""), 10);
    return s.startsWith("PAY-") && Number.isFinite(n) ? Math.max(m, n) : m;
  }, 4000);
  return `PAY-${max + 1}`;
};

const statusKey = (row) => String(row?.status || "").toLowerCase();

/* invoice still has money to collect (Sent / Overdue / Partially Paid) */
const isOpen = (row) => !["paid", "draft", "void"].includes(statusKey(row)) && Number(row?.balance || 0) > 0;

/* a payment can be submitted only if the invoice is open AND no payment is waiting for Admin approval */
const canTakePayment = (row) => isOpen(row) && !row?.pendingApproval;

/* The stored status can be out of date (e.g. "Overdue" but the due date is still in the future),
   so the label shown on screen is always worked out from balance + due date. */
const effectiveStatus = (row) => {
  const s = statusKey(row);
  if (s === "paid" || Number(row?.balance || 0) <= 0) return "Paid";
  if (row?.pendingApproval) return "Pending Approval"; // payment submitted, waiting for ERP Admin
  if (s === "draft") return "Draft";
  if (s === "void") return "Void";
  if (row?.due && row.due < todayISO()) return "Overdue";
  if (s === "partially paid") return "Partially Paid";
  return "Sent";
};
const STATUS_TONE = {
  Paid: "green", Overdue: "red", "Partially Paid": "purple", Sent: "blue",
  Draft: "gray", Void: "gray", "Pending Approval": "orange",
};
/* used by the "Exclude paid" pill on the list */
const isPaidRow = (row) => effectiveStatus(row) === "Paid";

/* share status of an invoice */
const shareState = (row) => (row?.sharedOn ? "Shared" : "Not Shared");
const SHARE_VIA = ["WhatsApp", "Email", "SMS", "Post"];
const SHARE_META = {
  WhatsApp: { icon: "fa-brands fa-whatsapp", cls: "wa", hint: "Opens WhatsApp with your message ready to send." },
  Email: { icon: "fa-solid fa-envelope", cls: "em", hint: "Opens a Gmail compose window with the invoice details." },
  SMS: { icon: "fa-solid fa-message", cls: "sm", hint: "Opens your messaging app (works on phones)." },
  Post: { icon: "fa-solid fa-envelope-open-text", cls: "po", hint: "Prints the invoice so you can send it by post." },
};
const buildShareText = (row) =>
  `Hi ${row.customer}, invoice ${row.number} for ${money(row.amount)}` +
  (row.due ? `, due on ${fmtDate(row.due)}` : "") +
  `. Balance due: ${money(row.balance)}. Thank you!`;
const SHARE_TONE = { Shared: "green", "Not Shared": "gray" };
const shareTitle = (row) => (row?.sharedOn ? `${row.sharedVia || "Shared"} · ${fmtDate(row.sharedOn)}` : "");

/* ---------- summary cards, worked out from the real invoice rows ---------- */
const computeSummary = (rows) => {
  const today = todayISO();
  const in30 = todayISO(30);
  /* uses isOpen (not canTakePayment) so invoices waiting for approval still count as receivables */
  const open = rows.filter(isOpen);
  const total = (list) => list.reduce((s, r) => s + Number(r.balance || 0), 0);

  const paidRows = rows.filter((r) => r.paidOn && r.date);
  const avgDays = paidRows.length
    ? Math.round(paidRows.reduce((s, r) => s + Math.max(0, (new Date(r.paidOn) - new Date(r.date)) / 86400000), 0) / paidRows.length)
    : 0;

  return [
    { label: "Total Outstanding Receivables", value: total(open), dec: 2, money: true, icon: "fa-arrow-trend-down", tone: "orange" },
    { label: "Due Today", value: total(open.filter((r) => r.due === today)), dec: 2, money: true, icon: "fa-calendar-day", tone: "blue" },
    { label: "Due Within 30 Days", value: total(open.filter((r) => r.due > today && r.due <= in30)), dec: 2, money: true, icon: "fa-calendar-week", tone: "purple" },
    { label: "Overdue Invoice", value: total(open.filter((r) => r.due && r.due < today)), dec: 2, money: true, icon: "fa-triangle-exclamation", tone: "red" },
    { label: "Avg. Days for Getting Paid", value: avgDays, dec: 0, suffix: " Days", icon: "fa-hourglass-half", tone: "green" },
  ];
};

/* data shown on the printed invoice (add `lines`, `net`, `vat` here when your rows have them) */
const buildDocData = (row) => ({
  number: row.number,
  order: row.order,
  customer: row.customer,
  date: row.date ? fmtDate(row.date) : "-",
  due: row.due ? fmtDate(row.due) : "-",
  status: row.status,
  amount: row.amount,
  balance: row.balance,
});

/* everything the invoice page needs, worked out from one row */
const invoiceView = (row) => {
  const amount = Number(row.amount || 0);
  const balance = Number(row.balance || 0);
  const paid = Math.max(0, amount - balance);
  const pct = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;
  const status = effectiveStatus(row);
  const isPaid = status === "Paid";
  const overdue = status === "Overdue";
  const awaiting = status === "Pending Approval";

  const dueDate = row.due ? new Date(row.due + "T00:00:00") : null;
  const days = dueDate && !isNaN(dueDate) ? Math.round((dueDate - new Date(todayISO() + "T00:00:00")) / 86400000) : null;

  let tone = "orange";
  let note = "Payment pending";
  if (isPaid) { tone = "green"; note = "Settled in full"; }
  else if (awaiting) { tone = "orange"; note = "Awaiting admin approval"; }
  else if (overdue) { tone = "red"; note = `${-days} day${-days === 1 ? "" : "s"} overdue`; }
  else if (days === 0) { tone = "orange"; note = "Due today"; }
  else if (days != null) { tone = "blue"; note = `Due in ${days} day${days === 1 ? "" : "s"}`; }

  return { amount, balance, paid, pct, isPaid, overdue, awaiting, tone, note, status, chip: STATUS_TONE[status] || "gray" };
};

export default function InvoicesPage() {
  const [selected, setSelected] = useState(null); // invoice shown on its own page
  const [copied, setCopied] = useState(false);
  const [printInvoice, printPortal] = usePrintInvoice(money); // hooks stay above early return

  const [summary, setSummary] = useState(() => computeSummary([]));
  const [history, setHistory] = useState([]); // approved payments of the open invoice
  const [showPay, setShowPay] = useState(false);
  const [form, setForm] = useState({ amount: "", method: PAY_METHODS[0], reference: "", date: todayISO() });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [flashType, setFlashType] = useState("ok"); // "ok" | "err"
  const [customers, setCustomers] = useState([]); // for "Share invoices via" / "Send invoices to"
  const [listKey, setListKey] = useState(0); // bump to reload the list after sharing / payment submit
  const [shareRow, setShareRow] = useState(null); // invoice being shared (popup open when set)
  const [shareForm, setShareForm] = useState({ via: SHARE_VIA[0], to: "", msg: "" });
  const [shareErr, setShareErr] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareDone, setShareDone] = useState(null); // channel name while the success screen shows

  const notify = (msg, type = "ok") => {
    setFlashType(type);
    setFlash(msg);
    setTimeout(() => setFlash(""), 5000);
  };

  /* customers: needed to know how + where to share */
  useEffect(() => {
    getErpRecords("customers").then(setCustomers).catch(() => {});
  }, []);

  /* summary cards: reload every time we come back to the list */
  useEffect(() => {
    if (selected) return;
    let live = true;
    getErpRecords("invoices").then((rows) => live && setSummary(computeSummary(rows))).catch(() => {});
    return () => { live = false; };
  }, [selected, listKey]);

  /* payment history of the open invoice (only approved payments live in "payments-received") */
  const loadHistory = async (invoiceNumber) => {
    try {
      const all = await getErpRecords("payments-received");
      return all.filter((p) => p.invoice === invoiceNumber).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    } catch {
      return [];
    }
  };
  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    let live = true;
    loadHistory(selected.number).then((h) => live && setHistory(h));
    return () => { live = false; };
  }, [selected?.number]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Esc closes the payment popup */
  useEffect(() => {
    if (!showPay) return;
    const onKey = (e) => e.key === "Escape" && !busy && setShowPay(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPay, busy]);

  useEffect(() => {
    if (!shareRow) return;
    const onKey = (e) => e.key === "Escape" && !sharing && setShareRow(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareRow, sharing]);

  const printRow = (row) => printInvoice(buildDocData(row));

  const copyNumber = async (num) => {
    try {
      await navigator.clipboard.writeText(String(num));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  /* ---------- share invoice ---------- */
  const custOf = (row) => {
    const name = String(row?.customer || "").trim().toLowerCase();
    return customers.find((c) => String(c.name || "").trim().toLowerCase() === name);
  };

  /* best recipient for a channel: saved "Send invoices to", else the customer's email / phone */
  const defaultTo = (row, via) => {
    const c = custOf(row);
    if (!c || via === "Post") return "";
    const saved = String(c.shareTo || "").trim();
    if (via === "Email") return saved.includes("@") ? saved : String(c.email || "").trim();
    return saved && !saved.includes("@") ? saved : String(c.phone || "").trim();
  };

  const shareInvoice = (row) => {
    const c = custOf(row);
    const via = SHARE_VIA.includes(c?.shareVia) ? c.shareVia : SHARE_VIA[0];
    setShareForm({ via, to: defaultTo(row, via), msg: buildShareText(row) });
    setShareErr("");
    setShareDone(null);
    setShareRow(row);
  };

  const pickVia = (via) => {
    setShareForm((f) => ({ ...f, via, to: defaultTo(shareRow, via) }));
    setShareErr("");
  };

  const closeShare = () => { if (!sharing) { setShareRow(null); setShareDone(null); } };

  const submitShare = async (e) => {
    e.preventDefault();
    const row = shareRow;
    if (!row || sharing) return;
    const via = shareForm.via;
    const to = shareForm.to.trim();
    const digits = to.replace(/\D/g, "");

    if (via !== "Post" && !to) return setShareErr("Enter the email / mobile number to send to.");
    if (via === "Email" && !/^\S+@\S+\.\S+$/.test(to)) return setShareErr("Enter a valid email address.");
    if ((via === "WhatsApp" || via === "SMS") && digits.length < 7) return setShareErr("Enter a valid mobile number (with country code).");

    const text = shareForm.msg.trim() || buildShareText(row);

    /* open the link first (before any await) so the browser does not block it */
    if (via === "WhatsApp") {
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } else if (via === "Email") {
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(`Invoice ${row.number}`)}&body=${encodeURIComponent(text)}`,
        "_blank", "noopener"
      );
    } else if (via === "SMS") {
      window.location.href = `sms:${to}?body=${encodeURIComponent(text)}`;
    } else {
      printRow(row); // Post -> print and send by post
    }

    setSharing(true);
    try {
      const updated = await updateErpRecord("invoices", row.id, { sharedVia: via, sharedOn: todayISO() });
      const { _updated, ...fresh } = updated.data;
      if (selected && selected.id === row.id) setSelected(fresh);
      setListKey((k) => k + 1);
      setShareDone(via); // success screen, then close
      setTimeout(() => { setShareRow(null); setShareDone(null); }, 1400);
      notify(`Invoice ${row.number} shared via ${via}.`);
    } catch (err) {
      setShareRow(null);
      notify(err?.message || "Opened, but could not save the share status.", "err");
    } finally {
      setSharing(false);
    }
  };

  /* toast + share popup (same in list view and invoice view) */
  const toast = flash ? (
    <div key={flash} className={`iv-toast ${flashType}`} role="status">
      <i className={`fa-solid ${flashType === "err" ? "fa-triangle-exclamation" : "fa-circle-check"}`} />
      <span>{flash}</span>
      <i className="iv-toast-bar" />
    </div>
  ) : null;

  const sMeta = SHARE_META[shareForm.via] || SHARE_META.WhatsApp;
  const sTo = shareForm.to.trim();
  const sToOk = shareForm.via === "Email" ? /^\S+@\S+\.\S+$/.test(sTo) : sTo.replace(/\D/g, "").length >= 7;
  const sName = shareRow?.customer || "Customer";
  const sInit = String(sName).split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const sTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sText = shareForm.msg.trim() || (shareRow ? buildShareText(shareRow) : "");

  const sharePopup = shareRow ? (
    <div className="iv-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && closeShare()}>
      <form className={`iv-modal iv-share ${sMeta.cls}`} role="dialog" aria-modal="true" aria-label="Share invoice" onSubmit={submitShare}>
        <div className="iv-share-head">
          <span className="iv-share-badge"><i className={sMeta.icon} /></span>
          <div className="iv-share-title">
            <h3>Share invoice</h3>
            <p>{shareRow.number} · {sName}</p>
          </div>
          <button type="button" className="iv-x" aria-label="Close" onClick={closeShare} disabled={sharing}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {shareDone ? (
          <div className="iv-share-done" role="status">
            <span className="iv-done-ring">
              <svg viewBox="0 0 52 52" aria-hidden="true"><path d="M14 27l8 8 16-17" /></svg>
            </span>
            <h4>Shared via {shareDone}</h4>
            <p>Invoice {shareRow.number} is now marked as Shared.</p>
          </div>
        ) : (
          <>
            <div className="iv-share-grid">
              <div className="iv-modal-body iv-share-form">
                <div className="iv-share-sum">
                  <div><small>Balance due</small><b>{money(shareRow.balance)}</b></div>
                  <div><small>Due date</small><b>{shareRow.due ? fmtDate(shareRow.due) : "-"}</b></div>
                  <span className={`iv-chip ${STATUS_TONE[effectiveStatus(shareRow)] || "gray"}`}>{effectiveStatus(shareRow)}</span>
                </div>

                <div className="iv-field">
                  <span>Send via</span>
                  <div className="iv-tiles" role="radiogroup" aria-label="Send via">
                    {SHARE_VIA.map((m) => {
                      const mm = SHARE_META[m];
                      const on = shareForm.via === m;
                      return (
                        <button key={m} type="button" role="radio" aria-checked={on}
                          className={`iv-tile ${mm.cls}${on ? " on" : ""}`} onClick={() => pickVia(m)}>
                          <i className={mm.icon} />
                          <b>{m}</b>
                          {on && <i className="fa-solid fa-circle-check iv-tile-tick" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="iv-tile-hint">{sMeta.hint}</p>
                </div>

                {shareForm.via !== "Post" && (
                  <label className="iv-field">
                    <span>{shareForm.via === "Email" ? "Email address" : "Mobile number (with country code)"}</span>
                    <div className={`iv-to${sTo && !sToOk ? " bad" : ""}`}>
                      <i className={sMeta.icon} />
                      <input
                        type={shareForm.via === "Email" ? "email" : "tel"} autoFocus
                        placeholder={shareForm.via === "Email" ? "name@company.com" : "+91 98765 43210"}
                        value={shareForm.to}
                        onChange={(e) => { setShareForm({ ...shareForm, to: e.target.value }); setShareErr(""); }}
                      />
                      {sTo && sToOk && <i className="fa-solid fa-circle-check iv-to-ok" />}
                    </div>
                  </label>
                )}

                {shareForm.via !== "Post" && (
                  <label className="iv-field">
                    <span>Message</span>
                    <textarea
                      className="iv-msg" rows={4} maxLength={500} value={shareForm.msg}
                      onChange={(e) => setShareForm({ ...shareForm, msg: e.target.value })}
                    />
                    <small className="iv-msg-count">{shareForm.msg.length}/500</small>
                  </label>
                )}

                {shareErr && <p className="iv-error" role="alert"><i className="fa-solid fa-circle-exclamation" /> {shareErr}</p>}
              </div>

              {/* live preview of what the customer will receive */}
              <aside className="iv-share-preview" aria-label="Preview">
                <p className="iv-pv-label">Live preview</p>

                {(shareForm.via === "WhatsApp" || shareForm.via === "SMS") && (
                  <div className="iv-phone">
                    <div className="iv-phone-bar">
                      <span className="iv-phone-av">{sInit}</span>
                      <div><b>{sName}</b><small>{sTo || "enter number"}</small></div>
                    </div>
                    <div className="iv-phone-chat">
                      <div className="iv-bubble">
                        {sText}
                        <div className="iv-bubble-meta">
                          {sTime}{shareForm.via === "WhatsApp" && <i className="fa-solid fa-check-double" />}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {shareForm.via === "Email" && (
                  <div className="iv-mail">
                    <div className="iv-mail-head">
                      <div><span>To</span> <b>{sTo || "enter email"}</b></div>
                      <div><span>Subject</span> <b>Invoice {shareRow.number}</b></div>
                    </div>
                    <div className="iv-mail-body">{sText}</div>
                    <div className="iv-mail-card"><span>Balance due</span><b>{money(shareRow.balance)}</b></div>
                  </div>
                )}

                {shareForm.via === "Post" && (
                  <div className="iv-paper">
                    <h4>INVOICE</h4>
                    <p className="iv-paper-no">{shareRow.number}</p>
                    <div className="iv-paper-row"><span>Customer</span><b>{sName}</b></div>
                    <div className="iv-paper-row"><span>Date</span><b>{shareRow.date ? fmtDate(shareRow.date) : "-"}</b></div>
                    <div className="iv-paper-row"><span>Due</span><b>{shareRow.due ? fmtDate(shareRow.due) : "-"}</b></div>
                    <div className="iv-paper-row"><span>Amount</span><b>{money(shareRow.amount)}</b></div>
                    <div className="iv-paper-row total"><span>Balance due</span><b>{money(shareRow.balance)}</b></div>
                  </div>
                )}
              </aside>
            </div>

            <div className="iv-modal-foot">
              <button type="button" className="iv-cancel" onClick={closeShare} disabled={sharing}>Cancel</button>
              <button type="submit" className="iv-share-go" disabled={sharing}>
                <i className={sharing ? "fa-solid fa-spinner fa-spin" : sMeta.icon} /> {sharing ? "Saving..." : shareForm.via === "Post" ? "Print & mark shared" : `Share via ${shareForm.via}`}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  ) : null;

  /* ---------- payment (needs ERP Admin approval) ---------- */
  const openPay = (row) => {
    setForm({ amount: String(round2(row.balance)), method: PAY_METHODS[0], reference: "", date: todayISO() });
    setError("");
    setShowPay(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selected || busy) return;
    const balance = round2(selected.balance);
    const amount = round2(form.amount);

    if (!canTakePayment(selected)) return setError("This invoice cannot take a payment right now.");
    if (!(amount > 0)) return setError("Enter an amount greater than zero.");
    if (amount > balance) return setError(`Amount cannot be more than the balance due (${money(balance)}).`);
    if (!form.date) return setError("Choose the payment date.");

    setBusy(true);
    setError("");
    let paymentRow = null;
    try {
      /* 1) payment record -> Credit & Payments > Payments (status Pending, waits for Admin) */
      const all = await getErpRecords("payments");
      const number = nextPayNo(all);
      const created = await createErpRecord("payments", {
        number,
        name: selected.customer, // "Payments details" column
        reference: form.reference.trim() || number, // "Reference / details" column
        customerName: selected.customer,
        email: custOf(selected)?.email || "", // "Owner / contact" column
        date: form.date,
        customer: selected.customer,
        invoice: selected.number,
        method: form.method,
        amount,
        status: "Pending",
      });
      paymentRow = created.data;

      /* 2) invoice: mark as waiting for approval (balance + status are NOT changed yet) */
      const updated = await updateErpRecord("invoices", selected.id, {
        pendingApproval: true,
        pendingPaymentId: paymentRow.id,
      });

      const { _updated, ...fresh } = updated.data;
      setSelected(fresh);
      setListKey((k) => k + 1);
      setShowPay(false);
      notify(`Payment of ${money(amount)} (${number}) sent to Admin for approval.`);
    } catch (err) {
      /* roll back the payment row if the invoice could not be updated */
      if (paymentRow?.id != null) { try { await deleteErpRecord("payments", paymentRow.id); } catch { /* ignore */ } }
      setError(err?.message || "Payment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const closeInvoice = () => { setSelected(null); setCopied(false); setShowPay(false); setFlash(""); };

  /* ---------- invoice page ---------- */
  if (selected) {
    const v = invoiceView(selected);
    const payable = canTakePayment(selected);
    const details = [
      { icon: "fa-user", label: "Customer", value: selected.customer || "-" },
      { icon: "fa-cart-shopping", label: "Order", value: selected.order || "-" },
      { icon: "fa-calendar", label: "Invoice date", value: selected.date ? fmtDate(selected.date) : "-" },
      { icon: "fa-calendar-check", label: "Due date", value: selected.due ? fmtDate(selected.due) : "-" },
      {
        icon: "fa-share-nodes", label: "Invoice sharing",
        value: selected.sharedOn ? `${selected.sharedVia || "Shared"} · ${fmtDate(selected.sharedOn)}` : "Not shared yet",
      },
    ];

    /* timeline: Issued -> Due -> Payment */
    const steps = [
      {
        key: "issued", state: "done", icon: "fa-file-circle-plus",
        title: "Invoice issued", text: selected.date ? fmtDate(selected.date) : "-",
      },
      {
        key: "due",
        state: v.isPaid ? "done" : v.overdue ? "late" : "current",
        icon: "fa-calendar-check",
        title: v.overdue ? "Payment overdue" : "Payment due",
        text: selected.due ? fmtDate(selected.due) : "-",
      },
      {
        key: "paid",
        state: v.isPaid ? "done" : "pending",
        icon: v.awaiting ? "fa-user-clock" : "fa-circle-check",
        title: v.isPaid ? "Paid in full" : v.awaiting ? "Awaiting admin approval" : "Awaiting payment",
        text: v.isPaid ? money(v.paid) : `${money(v.balance)} remaining`,
      },
    ];

    return (
      <div className="page-anim invoices-page invoice-view">
        <PageHeader
          eyebrow="SALES"
          title={`Invoice ${selected.number}`}
          subtitle={selected.customer || ""}
          icon="fa-file-invoice-dollar"
          showPrint={false}
          actions={
            <div className="iv-head-actions">
              <button type="button" className="iv-hbtn" onClick={closeInvoice}>
                <i className="fa-solid fa-arrow-left" /> Back
              </button>
              <button type="button" className="iv-hbtn" onClick={() => copyNumber(selected.number)}>
                <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} /> {copied ? "Copied" : "Copy number"}
              </button>
              {payable && (
                <button type="button" className="iv-hbtn pay" onClick={() => openPay(selected)}>
                  <i className="fa-solid fa-money-bill-transfer" /> Record payment
                </button>
              )}
              <button type="button" className="iv-hbtn" onClick={() => shareInvoice(selected)}>
                <i className="fa-solid fa-share-nodes" /> Share
              </button>
              <button type="button" className="iv-hbtn primary" onClick={() => printRow(selected)}>
                <i className="fa-solid fa-print" /> Print invoice
              </button>
            </div>
          }
        />

        <div className="iv-stats">
          <div className="iv-stat blue">
            <span className="iv-stat-icon"><i className="fa-solid fa-file-invoice-dollar" /></span>
            <div><small>Amount</small><b>{money(v.amount)}</b></div>
          </div>
          <div className="iv-stat green">
            <span className="iv-stat-icon"><i className="fa-solid fa-circle-check" /></span>
            <div><small>Paid</small><b>{money(v.paid)}</b></div>
          </div>
          <div className={`iv-stat ${v.isPaid ? "green" : v.overdue ? "red" : "orange"}`}>
            <span className="iv-stat-icon"><i className={`fa-solid ${v.isPaid ? "fa-scale-balanced" : "fa-hourglass-half"}`} /></span>
            <div><small>Balance due</small><b>{money(v.balance)}</b></div>
          </div>
        </div>

        <div className="iv-grid">
          <div className="iv-main">
            <div className="iv-card">
              <div className="iv-card-head">
                <h3><i className="fa-solid fa-circle-info" /> Invoice details</h3>
                <span className={`iv-chip ${v.chip}`}>{v.status}</span>
              </div>
              <div className="iv-details">
                {details.map((d) => (
                  <div key={d.label} className="iv-detail">
                    <span className="iv-detail-icon"><i className={`fa-solid ${d.icon}`} /></span>
                    <div><small>{d.label}</small><b>{d.value}</b></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="iv-card">
              <div className="iv-card-head">
                <h3><i className="fa-solid fa-receipt" /> Payment history</h3>
                <span className="iv-count">{history.length}</span>
              </div>
              {history.length === 0 ? (
                <p className="iv-empty">No approved payments for this invoice yet.</p>
              ) : (
                <div className="iv-hist-wrap">
                  <table className="iv-hist">
                    <thead>
                      <tr><th>Payment #</th><th>Date</th><th>Method</th><th>Reference</th><th className="num">Amount</th></tr>
                    </thead>
                    <tbody>
                      {history.map((p) => (
                        <tr key={p.id}>
                          <td>{p.number}</td>
                          <td>{p.date ? fmtDate(p.date) : "-"}</td>
                          <td>{p.method || "-"}</td>
                          <td>{p.ref || "-"}</td>
                          <td className="num">{money(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="iv-side">
            <div className="iv-card">
              <div className="iv-card-head">
                <h3><i className="fa-solid fa-chart-pie" /> Payment progress</h3>
              </div>
              <div className="iv-progress">
                <div className={`iv-ring ${v.tone}`}>
                  <svg viewBox="0 0 120 120" role="progressbar" aria-valuenow={v.pct} aria-valuemin={0} aria-valuemax={100}>
                    <circle className="iv-ring-bg" cx="60" cy="60" r="52" />
                    <circle
                      className="iv-ring-fg" cx="60" cy="60" r="52"
                      strokeDasharray={`${(v.pct / 100) * 326.73} 326.73`}
                    />
                  </svg>
                  <div className="iv-ring-txt">
                    <b>{v.pct}%</b>
                    <small>paid</small>
                  </div>
                </div>

                <div className="iv-prog-rows">
                  <div><span>Invoice total</span><b>{money(v.amount)}</b></div>
                  <div><span>Received</span><b className="g">{money(v.paid)}</b></div>
                  <div className="due"><span>Balance due</span><b>{money(v.balance)}</b></div>
                </div>

                <div className={`iv-note ${v.tone}`}>
                  <i className={`fa-solid ${v.isPaid ? "fa-circle-check" : v.awaiting ? "fa-user-clock" : v.overdue ? "fa-triangle-exclamation" : "fa-clock"}`} />
                  {v.note}
                </div>

                {!payable && !v.isPaid && (
                  <p className="iv-hint">
                    <i className="fa-solid fa-circle-info" />{" "}
                    {v.awaiting
                      ? "A payment for this invoice is waiting for Admin approval. The invoice turns Paid once it is approved."
                      : statusKey(selected) === "draft"
                        ? "This invoice is still a Draft. Send it before recording a payment."
                        : "This invoice cannot take a payment."}
                  </p>
                )}
              </div>
            </div>

            <div className="iv-card">
              <div className="iv-card-head">
                <h3><i className="fa-solid fa-timeline" /> Timeline</h3>
              </div>
              <ol className="iv-tl">
                {steps.map((st) => (
                  <li key={st.key} className={`iv-tl-item ${st.state}`}>
                    <span className="iv-tl-dot"><i className={`fa-solid ${st.icon}`} /></span>
                    <div>
                      <b>{st.title}</b>
                      <small>{st.text}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* ---------- Record payment popup ---------- */}
        {showPay && (
          <div className="iv-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && !busy && setShowPay(false)}>
            <form className="iv-modal" role="dialog" aria-modal="true" aria-label="Record payment" onSubmit={submitPayment}>
              <div className="iv-modal-head">
                <h3><i className="fa-solid fa-money-bill-transfer" /> Record payment</h3>
                <button type="button" className="iv-x" aria-label="Close" onClick={() => setShowPay(false)} disabled={busy}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div className="iv-modal-body">
                <div className="iv-modal-sum">
                  <div><small>Invoice</small><b>{selected.number}</b></div>
                  <div><small>Customer</small><b>{selected.customer || "-"}</b></div>
                  <div><small>Balance due</small><b>{money(v.balance)}</b></div>
                </div>

                <label className="iv-field">
                  <span>Amount (£)</span>
                  <div className="iv-amount">
                    <input
                      type="number" inputMode="decimal" min="0.01" step="0.01" max={v.balance}
                      value={form.amount} autoFocus required
                      onChange={(e) => { setForm({ ...form, amount: e.target.value }); setError(""); }}
                    />
                    <button type="button" onClick={() => setForm({ ...form, amount: String(round2(v.balance)) })}>Full balance</button>
                  </div>
                </label>

                <div className="iv-two">
                  <label className="iv-field">
                    <span>Method</span>
                    <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                      {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="iv-field">
                    <span>Payment date</span>
                    <input type="date" value={form.date} max={todayISO()} required onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </label>
                </div>

                <label className="iv-field">
                  <span>Reference (optional)</span>
                  <input type="text" maxLength={60} placeholder="e.g. BACS-50210" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </label>

                <p className="iv-hint">
                  <i className="fa-solid fa-circle-info" /> This payment goes to the ERP Admin for approval. The invoice becomes Paid only after it is approved.
                </p>

                {error && <p className="iv-error" role="alert"><i className="fa-solid fa-circle-exclamation" /> {error}</p>}
              </div>

              <div className="iv-modal-foot">
                <button type="button" className="iv-cancel" onClick={() => setShowPay(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="iv-confirm" disabled={busy}>
                  {busy ? "Saving..." : `Submit ${money(form.amount || 0)} for approval`}
                </button>
              </div>
            </form>
          </div>
        )}

        {sharePopup}
        {toast}
        {printPortal}
      </div>
    );
  }

  /* ---------- invoice list ---------- */
  const columns = [
    dateColumn("date", "Date"),
    {
      key: "number", label: "Invoice#", sortable: true,
      render: (row) => <><TableLink onClick={() => setSelected(row)}>{row.number}</TableLink> <CellIcon name="fa-paperclip" /></>,
    },
    textColumn("order", "Order Number"),
    textColumn("customer", "Customer Name"),
    {
      key: "status", label: "Status", sortable: true,
      sortValue: (row) => effectiveStatus(row),
      render: (row) => <StatusPill status={effectiveStatus(row)} tone={STATUS_TONE[effectiveStatus(row)]} />,
    },
    {
      key: "sharedOn", label: "Share Status", sortable: true,
      sortValue: (row) => shareState(row),
      render: (row) => {
        const m = row.sharedOn ? SHARE_META[row.sharedVia] || { icon: "fa-solid fa-check", cls: "ok" } : null;
        return (
          <span className={`iv-sc ${m ? m.cls : "none"}`} title={shareTitle(row)}>
            <i className={m ? m.icon : "fa-regular fa-paper-plane"} /> {row.sharedOn ? row.sharedVia || "Shared" : "Not shared"}
          </span>
        );
      },
    },
    dateColumn("due", "Due Date"),
    amountColumn("amount", "Amount"),
    amountColumn("balance", "Balance Due"),
    {
      key: "__actions",
      label: "Actions",
      render: (row) => (
        <span className="iv-row-actions">
          <button
            type="button" className="btn-ghost" title="Share invoice" aria-label={`Share ${row.number}`}
            onClick={() => shareInvoice(row)}
          >
            <i className="fa-solid fa-share-nodes" />
          </button>
          <button type="button" className="btn-ghost" title="Print invoice" onClick={() => printRow(row)}>
            <i className="fa-solid fa-print" />
          </button>
          {canTakePayment(row) && (
            <button
              type="button" className="btn-ghost" title="Record payment" aria-label={`Record payment for ${row.number}`}
              onClick={() => { setSelected(row); openPay(row); }}
            >
              <i className="fa-solid fa-money-bill-transfer" />
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <ListPage
        key={listKey}
        className="invoices-page"
        eyebrow="SALES" title="All Invoices" icon="fa-file-invoice-dollar"
        entity="invoices" searchPlaceholder="Search in Invoices"
        columns={columns}
        dateFilter excludePaid={isPaidRow}
      >
        <SummaryStrip items={summary} />
      </ListPage>

      {sharePopup}
      {toast}
      {printPortal}
    </>
  );
}