import { useState } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import ChequePhotoUpload from "@/components/ChequePhotoUpload/ChequePhotoUpload.jsx";
import InvoicePhotos from "@/components/InvoicePhotos/InvoicePhotos.jsx";
import {
  useHub, client, clientManager, product, gbp,
  payInvoice, createTicket, updateTicket, invoiceTickets, invoicePayment, invoicePayments, invoicePhotos,
} from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import { InvoicePrintPortal, printInvoiceDocument } from "@/components/InvoicePrint/InvoicePrint.jsx";
import { useInvoiceTemplate } from "@/data/invoiceTemplateStore.js";
import { buildInvoiceDocData } from "@/pages/OrderHub/invoiceDocData.js";
import "./InvoiceDetail.css";

/* LOGO: put your logo file in the Vite "public" folder as logo.png (or change this path).
   If the file is missing the logo is simply hidden and the company name still prints. */
const LOGO_SRC = "/logo.png";
const COMPANY = {
  name: "Zulekha Order Hub",
  lines: [], // e.g. ["Unit 4, Example Park, London AB1 2CD", "VAT No. GB123456789"]
};
const hideImg = (e) => { e.currentTarget.style.display = "none"; };

const METHODS = [
  { id: "Online", icon: "fa-globe", sub: "Card / UPI / Net banking" },
  { id: "Cheque", icon: "fa-money-check", sub: "Enter cheque details" },
  { id: "Cash", icon: "fa-money-bill-wave", sub: "Paid in cash" },
];
const METHOD_ICON = { Online: "fa-globe", Cheque: "fa-money-check", Cash: "fa-money-bill-wave" };
const todayStr = () => new Date().toISOString().slice(0, 10);
const initials = (n) =>
  String(n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

const MISTAKE_TYPES = [
  { id: "Wrong item delivered", icon: "fa-shuffle" },
  { id: "Item missing / short delivery", icon: "fa-box-open" },
  { id: "Wrong price charged", icon: "fa-sterling-sign" },
  { id: "Damaged item", icon: "fa-heart-crack" },
  { id: "Other", icon: "fa-ellipsis" },
];
const RETURN_REASONS = ["Damaged on arrival", "Wrong item sent", "Short dated / expired", "Quality issue", "Ordered by mistake"];
const TONE = { Open: "blue", "In Review": "orange", Approved: "green", Resolved: "green", Rejected: "red" };
const STATUSES = ["Open", "In Review", "Approved", "Rejected", "Resolved"];
const VAT = 0.2;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const money = (n) => "\u00a3" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TicketPill({ status }) {
  return <span className={`invd-pill invd-${TONE[status] || "blue"}`}>{status}</span>;
}

/* ---------- Pay box (Outstanding invoices only) - full or PART payment, any number of times ---------- */
function PayPanel({ invoice, onDone, staff }) {
  const s = useHub();
  const managers = s.areaManagers || [];
  const due = round2(invoice.amount - (invoice.paid || 0)); // balance left after any part payments

  const [step, setStep] = useState("idle"); // idle | choose
  const [method, setMethod] = useState("Online");
  const [amount, setAmount] = useState(String(due)); // editable payment amount

  // who received the payment: an area manager (default = this client's manager) or "OTHER" person
  const [recvId, setRecvId] = useState(clientManager(invoice.clientId)?.id || managers[0]?.id || "OTHER");
  const [other, setOther] = useState({ name: "", email: "" });

  const [online, setOnline] = useState({ payerName: "", reference: "", paidOn: todayStr() });
  const [cheque, setCheque] = useState({ chequeNo: "", bankName: "", accountHolder: "", chequeDate: todayStr(), chequePhoto: "" });
  const [cash, setCash] = useState({ payerName: "", paidOn: todayStr() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setOt = (k, v) => { setOther((f) => ({ ...f, [k]: v })); setError(""); };
  const setO = (k, v) => { setOnline((f) => ({ ...f, [k]: v })); setError(""); };
  const setC = (k, v) => { setCheque((f) => ({ ...f, [k]: v })); setError(""); };
  const setCa = (k, v) => { setCash((f) => ({ ...f, [k]: v })); setError(""); };

  const isOther = recvId === "OTHER";
  const rm = managers.find((m) => m.id === recvId);
  const recvName = isOther ? other.name.trim() : String(rm?.name || "").trim();
  const recvEmail = isOther ? other.email.trim() : String(rm?.email || "").trim();

  const amt = round2(parseFloat(amount));

  const validate = () => {
    if (!amt || amt <= 0) return "Amount venum (0-ku mela)";
    if (amt > due) return `Amount ${gbp(due)}-ku mela irukka koodathu`;
    if (!recvName) return isOther ? "Received by (name) venum" : "Payment receive panna aal select pannunga";
    if (!EMAIL_RE.test(recvEmail)) {
      return isOther
        ? "Receiver-oda sariyaana email venum"
        : `${recvName}-ku email illa. Vera aal select pannunga illa "Other person" use pannunga`;
    }
    if (method === "Online") {
      if (!online.payerName.trim()) return "Payer name venum";
      if (!online.reference.trim()) return "Transaction reference venum";
      if (!online.paidOn) return "Payment date venum";
    } else if (method === "Cheque") {
      if (!/^\d{6}$/.test(cheque.chequeNo.trim())) return "6-digit cheque number venum";
      if (!cheque.bankName.trim()) return "Bank name venum";
      if (!cheque.accountHolder.trim()) return "Account holder name venum";
      if (!cheque.chequeDate) return "Cheque date venum";
      if (!cheque.chequePhoto) return "Cheque photo venum";
    } else {
      if (!cash.payerName.trim()) return "Paid by (name) venum";
      if (!cash.paidOn) return "Payment date venum";
    }
    return "";
  };

  const confirm = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }

    const date = method === "Online" ? online.paidOn : method === "Cheque" ? cheque.chequeDate : cash.paidOn;

    setBusy(true);
    setError("");
    const r = await payInvoice(invoice.id, {
      method,
      amount: amt,
      reference: method === "Online" ? online.reference.trim() : method === "Cheque" ? cheque.chequeNo.trim() : "Cash",
      payerName: method === "Online" ? online.payerName.trim() : method === "Cheque" ? cheque.accountHolder.trim() : cash.payerName.trim(),
      chequeNo: method === "Cheque" ? cheque.chequeNo.trim() : "",
      bankName: method === "Cheque" ? cheque.bankName.trim() : "",
      accountHolder: method === "Cheque" ? cheque.accountHolder.trim() : "",
      date,
      chequePhoto: method === "Cheque" ? cheque.chequePhoto : "",
      receivedBy: recvName,
      receiverEmail: recvEmail.toLowerCase(),
      managerId: isOther ? "" : recvId,
    });
    setBusy(false);
    if (r.ok) onDone(r.msg);
    else setError(r.msg || "Payment failed. Please try again.");
  };

  const btnLabel = busy
    ? "Processing..."
    : method === "Cheque" ? "Submit cheque"
    : method === "Cash" ? `Record cash ${gbp(amt || 0)}`
    : `Confirm ${gbp(amt || 0)}`;

  return (
    <aside className="invd-pay">
      <span className="invd-pay-eyebrow"><i className="fa-solid fa-credit-card" /> Payment</span>
      <div className="invd-pay-amount">
        <small>Amount due</small>
        <b>{gbp(due)}</b>
      </div>

      {step === "idle" ? (
        <button className="invd-pay-cta" onClick={() => setStep("choose")}>
          <i className="fa-solid fa-lock" /> {staff ? "Record Payment" : "Pay Now"}
          <i className="fa-solid fa-arrow-right invd-pay-arrow" />
        </button>
      ) : (
        <div className="invd-pay-body">
          <p className="invd-pay-label">Amount to pay (£)</p>
          <input
            className="invd-input invd-input-dark" type="number" min="0.01" max={due} step="0.01" inputMode="decimal"
            value={amount} placeholder="Amount *"
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
          />
          {amt !== due && (
            <button type="button" className="invd-btn ghost-dark" onClick={() => { setAmount(String(due)); setError(""); }}>
              Full amount ({gbp(due)})
            </button>
          )}

          <p className="invd-pay-label">Payment received by</p>
          <select
            className="invd-input invd-input-dark" value={recvId}
            onChange={(e) => { setRecvId(e.target.value); setError(""); }}
          >
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} (Area Manager)</option>)}
            <option value="OTHER">Other person</option>
          </select>

          {isOther ? (
            <>
              <input className="invd-input invd-input-dark" placeholder="Received by (name) *"
                value={other.name} onChange={(e) => setOt("name", e.target.value)} maxLength={60} />
              <input className="invd-input invd-input-dark" type="email" placeholder="Receiver email *"
                value={other.email} onChange={(e) => setOt("email", e.target.value)} maxLength={80} />
            </>
          ) : (
            <input className="invd-input invd-input-dark" value={recvEmail} readOnly placeholder="Manager email" />
          )}

          <p className="invd-pay-label">Choose payment method</p>
          <div className="invd-methods">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`invd-method${method === m.id ? " sel" : ""}`}
                aria-pressed={method === m.id}
                onClick={() => { setMethod(m.id); setError(""); }}
              >
                <i className={`fa-solid ${m.icon}`} />
                <span><b>{m.id}</b><small>{m.sub}</small></span>
                <em className="invd-radio" />
              </button>
            ))}
          </div>

          {method === "Online" && (
            <>
              <input className="invd-input invd-input-dark" placeholder="Payer name *"
                value={online.payerName} onChange={(e) => setO("payerName", e.target.value)} maxLength={60} />
              <input className="invd-input invd-input-dark" placeholder="Transaction / reference ID *"
                value={online.reference} onChange={(e) => setO("reference", e.target.value)} maxLength={60} />
              <input className="invd-input invd-input-dark" type="date" max={todayStr()}
                value={online.paidOn} onChange={(e) => setO("paidOn", e.target.value)} />
            </>
          )}

          {method === "Cheque" && (
            <>
              <input className="invd-input invd-input-dark" placeholder="Cheque number (6 digits) *" inputMode="numeric" maxLength={6}
                value={cheque.chequeNo} onChange={(e) => setC("chequeNo", e.target.value.replace(/\D/g, ""))} />
              <input className="invd-input invd-input-dark" placeholder="Bank name *"
                value={cheque.bankName} onChange={(e) => setC("bankName", e.target.value)} maxLength={60} />
              <input className="invd-input invd-input-dark" placeholder="Account holder name *"
                value={cheque.accountHolder} onChange={(e) => setC("accountHolder", e.target.value)} maxLength={60} />
              <input className="invd-input invd-input-dark" type="date"
                value={cheque.chequeDate} onChange={(e) => setC("chequeDate", e.target.value)} />
              {/* photo of the cheque (below the date field) */}
              <ChequePhotoUpload
                value={cheque.chequePhoto}
                onChange={(v) => setC("chequePhoto", v)}
                disabled={busy}
              />
            </>
          )}

          {method === "Cash" && (
            <>
              <input className="invd-input invd-input-dark" placeholder="Paid by (name) *"
                value={cash.payerName} onChange={(e) => setCa("payerName", e.target.value)} maxLength={60} />
              <input className="invd-input invd-input-dark" type="date" max={todayStr()}
                value={cash.paidOn} onChange={(e) => setCa("paidOn", e.target.value)} />
            </>
          )}

          {error && <p className="invd-error-dark">{error}</p>}
          <div className="invd-actions">
            <button className="invd-btn ghost-dark" onClick={() => setStep("idle")} disabled={busy}>Cancel</button>
            <button className="invd-btn light" onClick={confirm} disabled={busy}>{btnLabel}</button>
          </div>
        </div>
      )}
      <p className="invd-pay-hint"><i className="fa-solid fa-shield-halved" /> Demo payment: no real money is taken.</p>
    </aside>
  );
}

/* ---------- All payments of this invoice (part payments) - timeline with running balance ---------- */
function PaymentHistory({ payments, total }) {
  if (!payments.length) return null;
  const totalNum = Number(total || 0);
  let running = totalNum;
  const rows = payments.map((p) => {
    running = round2(running - Number(p.amount || 0));
    const after = Math.max(0, running);
    return {
      ...p,
      after,
      pct: totalNum ? Math.min(100, ((totalNum - after) / totalNum) * 100) : 0,
    };
  });
  const paidTotal = round2(rows.reduce((sum, p) => sum + Number(p.amount || 0), 0));

  return (
    <div className="invd-card invd-hist">
      <div className="invd-hist-head">
        <h4 className="invd-card-title"><i className="fa-solid fa-clock-rotate-left" /> Payment history</h4>
        <span className="invd-hist-count">
          {rows.length} payment{rows.length === 1 ? "" : "s"} - {gbp(paidTotal)} received
        </span>
      </div>

      <ol className="invd-timeline">
        {rows.map((p, i) => (
          <li key={p.id} className="invd-tl-item">
            <span className={`invd-tl-dot m-${String(p.method).toLowerCase()}`}>
              <i className={`fa-solid ${METHOD_ICON[p.method] || "fa-coins"}`} />
            </span>

            <div className="invd-tl-card">
              <div className="invd-tl-top">
                <div className="invd-tl-title">
                  <b>Payment #{i + 1}</b>
                  <span className="invd-tl-method">{p.method}</span>
                </div>
                <b className="invd-tl-amount">+ {gbp(p.amount)}</b>
              </div>

              <div className="invd-tl-bar" aria-hidden="true"><i style={{ width: `${p.pct}%` }} /></div>

              <div className="invd-tl-meta">
                <span><i className="fa-regular fa-calendar" /> {fmtDate(p.date)}</span>
                <span className="invd-tl-bal">Balance after: <b>{gbp(p.after)}</b></span>
              </div>

              <div className="invd-tl-recv">
                <span className="invd-tl-avatar">{initials(p.receivedBy)}</span>
                <div>
                  <b>{p.receivedBy || "-"}</b>
                  <small>{p.receiverEmail || "-"}</small>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Payment ticket / receipt (Paid invoices) ---------- */
function Receipt({ payment, clientName, onPrint }) {
  if (!payment) {
    return (
      <aside className="invd-card invd-paid-note">
        <h4 className="invd-card-title"><i className="fa-solid fa-circle-check" /> Paid</h4>
        <p className="invd-hint">This invoice is paid. No online payment record exists (it was settled before online payments were added).</p>
      </aside>
    );
  }
  const rows = [
    ["Receipt no.", payment.id],
    ["Invoice", payment.invoiceId],
    ["Order", payment.orderId],
    ["Client", clientName],
    ["Payment date", fmtDate(payment.date)],
    ["Method", payment.method],
    ["Reference", payment.reference || "-"],
    ["Received by", payment.receivedBy || "-"],
    ["Receiver email", payment.receiverEmail || "-"],
  ];
  return (
    <aside className="invd-receipt-wrap">
      <div className="invd-ticket-stub">
        <div className="invd-stub-top">
          <span className="invd-stub-check"><i className="fa-solid fa-check" /></span>
          <div>
            <b>Payment Receipt</b>
            <small>Zulekha Order Hub</small>
          </div>
          <em>PAID</em>
        </div>

        <dl className="invd-stub-list">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>

        {/* cheque photo (only for cheque payments) */}
        {payment.chequePhoto && (
          <div className="invd-cheque">
            <small>Cheque photo</small>
            <img src={payment.chequePhoto} alt="Cheque" />
            <a href={payment.chequePhoto} target="_blank" rel="noreferrer" download={`cheque-${payment.invoiceId}.jpg`}>
              <i className="fa-solid fa-download" /> Download
            </a>
          </div>
        )}

        <div className="invd-perf" aria-hidden="true" />

        <div className="invd-stub-bottom">
          <div className="invd-stub-total">
            <small>Amount paid</small>
            <b>{gbp(payment.amount)}</b>
          </div>
          <div className="invd-barcode" aria-hidden="true" />
        </div>
      </div>
      <button className="invd-btn ghost" onClick={() => onPrint("receipt")}><i className="fa-solid fa-print" /> Print receipt</button>
    </aside>
  );
}

/* ---------- Print-only sheet for the payment RECEIPT (logo, centered on the page).
   The invoice itself prints with the template saved in Settings -> Invoice Templates. ---------- */
function PrintSheet({ mode, invoice, order, clientName, payment }) {
  const isPaid = String(invoice.status).toLowerCase() === "paid";
  const isReceipt = mode === "receipt" && payment;
  const meta = [
    ["Invoice no.", invoice.id],
    ["Order", invoice.orderId],
    ["Invoice date", invoice.date ? fmtDate(invoice.date) : "-"],
    ["Client", clientName],
    ["Status", isPaid ? "Paid" : invoice.status],
  ];
  const payRows = isReceipt
    ? [
        ["Receipt no.", payment.id],
        ["Payment date", fmtDate(payment.date)],
        ["Method", payment.method],
        ["Reference", payment.reference || "-"],
        ["Received by", payment.receivedBy || "-"],
        ["Receiver email", payment.receiverEmail || "-"],
      ]
    : [];

  return createPortal(
    <div className="invd-print-root">
      <div className="invd-ps">
        <header className="invd-ps-head">
          <img className="invd-ps-logo" src={LOGO_SRC} alt="" onError={hideImg} />
          <h1>{COMPANY.name}</h1>
          {COMPANY.lines.map((l) => <p key={l} className="invd-ps-line">{l}</p>)}
          <div className="invd-ps-title">{isReceipt ? "Payment Receipt" : "Invoice"}</div>
        </header>

        <dl className="invd-ps-meta">
          {meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>

        {payRows.length > 0 && (
          <dl className="invd-ps-meta invd-ps-pay">
            {payRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}

        {order && (
          <table className="invd-ps-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>VAT (20%)</th><th>Total</th></tr></thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td>{product(l.code)?.description || l.code}</td>
                  <td>{l.qty}</td>
                  <td>{gbp(l.price)}</td>
                  <td>{gbp(l.qty * l.price * VAT)}</td>
                  <td>{gbp(l.qty * l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="invd-ps-totals">
          <div><span>Net</span><b>{gbp(invoice.amount - invoice.vat)}</b></div>
          <div><span>VAT (20%)</span><b>{gbp(invoice.vat)}</b></div>
          <div className="grand"><span>Total</span><b>{gbp(invoice.amount)}</b></div>
          {isReceipt && <div className="paid-line"><span>Amount paid</span><b>{gbp(payment.amount)}</b></div>}
        </div>

        {isPaid && <div className="invd-ps-stamp">PAID</div>}
        <footer className="invd-ps-foot">Thank you for your business.</footer>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Report a mistake in the order ---------- */
function MistakeForm({ invoice, order, onDone }) {
  const [issue, setIssue] = useState(MISTAKE_TYPES[0].id);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    const r = await createTicket(invoice.id, { type: "Mistake", issue, code, note });
    setBusy(false);
    if (r.ok) onDone(r.msg);
    else setError(r.msg || "Could not raise the ticket.");
  };

  return (
    <div className="invd-split">
      <div className="invd-card">
        <h4 className="invd-card-title"><i className="fa-solid fa-triangle-exclamation" /> Report a mistake in this order</h4>
        <p className="invd-hint">Tell us what went wrong with order {invoice.orderId}. We will review it and reply here.</p>

        <p className="invd-label">What is the problem?</p>
        <div className="invd-chips">
          {MISTAKE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={issue === t.id}
              className={`invd-chip${issue === t.id ? " sel" : ""}`}
              onClick={() => setIssue(t.id)}
            >
              <i className={`fa-solid ${t.icon}`} /> {t.id}
            </button>
          ))}
        </div>

        {order && (
          <>
            <label className="invd-label" htmlFor="invd-mistake-item">Which item? (optional)</label>
            <select id="invd-mistake-item" className="invd-input" value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">Whole order</option>
              {order.lines.map((l) => <option key={l.code} value={l.code}>{product(l.code)?.description || l.code}</option>)}
            </select>
          </>
        )}

        <label className="invd-label" htmlFor="invd-mistake-note">Describe the mistake</label>
        <textarea
          id="invd-mistake-note"
          className="invd-input"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Example: we ordered 20 packs but only 15 arrived."
        />
        <small className="invd-count">{note.length}/500</small>
        {error && <p className="invd-error">{error}</p>}
        <button className="invd-btn" onClick={submit} disabled={busy}>{busy ? "Sending..." : "Raise mistake ticket"}</button>
      </div>

      <div className="invd-side-note">
        <i className="fa-solid fa-circle-info" />
        <h5>What happens next?</h5>
        <ol>
          <li>Your ticket is created as <b>Open</b>.</li>
          <li>Our team reviews it and may ask for details.</li>
          <li>You see the reply under <b>My Tickets</b>.</li>
        </ol>
      </div>
    </div>
  );
}

/* ---------- Return order ---------- */
function ReturnForm({ invoice, order, tickets, onDone }) {
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!order) return <div className="invd-card"><p className="invd-hint">This invoice has no order items, so a return cannot be raised.</p></div>;

  const returned = {};
  tickets
    .filter((t) => t.type === "Return" && t.status !== "Rejected")
    .forEach((t) => t.lines.forEach((l) => { returned[l.code] = (returned[l.code] || 0) + l.qty; }));
  const rows = order.lines.map((l) => ({ ...l, left: l.qty - (returned[l.code] || 0) }));
  const picked = rows.filter((r) => Number(qty[r.code]) > 0);
  const credit = round2(picked.reduce((sum, r) => sum + Number(qty[r.code]) * Number(r.price), 0) * (1 + VAT));

  const setLine = (r, v) => {
    const n = Math.min(r.left, Math.max(0, parseInt(v, 10) || 0));
    setQty((q) => ({ ...q, [r.code]: n }));
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const lines = picked.map((r) => ({ code: r.code, qty: Number(qty[r.code]) }));
    const r = await createTicket(invoice.id, { type: "Return", issue: reason, note, lines });
    setBusy(false);
    if (r.ok) onDone(r.msg);
    else setError(r.msg || "Could not raise the return.");
  };

  return (
    <div className="invd-split">
      <div className="invd-card">
        <h4 className="invd-card-title"><i className="fa-solid fa-rotate-left" /> Return items from this order</h4>
        <p className="invd-hint">Choose how many of each item you want to send back.</p>

        <ul className="invd-return-list">
          {rows.map((r) => {
            const n = Number(qty[r.code]) || 0;
            return (
              <li key={r.code} className={`invd-return-row${n > 0 ? " on" : ""}${r.left <= 0 ? " off" : ""}`}>
                <div className="invd-return-info">
                  <b>{product(r.code)?.description || r.code}</b>
                  <small>Ordered {r.qty} - Can return {r.left}</small>
                </div>
                <div className="invd-stepper">
                  <button type="button" aria-label="Decrease" disabled={r.left <= 0 || n <= 0} onClick={() => setLine(r, n - 1)}>-</button>
                  <input
                    type="number" min="0" max={r.left}
                    value={qty[r.code] ?? ""} placeholder="0"
                    disabled={r.left <= 0}
                    aria-label={`Return quantity for ${product(r.code)?.description || r.code}`}
                    onChange={(e) => setLine(r, e.target.value)}
                  />
                  <button type="button" aria-label="Increase" disabled={r.left <= 0 || n >= r.left} onClick={() => setLine(r, n + 1)}>+</button>
                </div>
              </li>
            );
          })}
        </ul>

        <label className="invd-label" htmlFor="invd-return-reason">Reason for return</label>
        <select id="invd-return-reason" className="invd-input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {RETURN_REASONS.map((t) => <option key={t}>{t}</option>)}
        </select>

        <label className="invd-label" htmlFor="invd-return-note">Notes (optional)</label>
        <textarea id="invd-return-note" className="invd-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        {error && <p className="invd-error">{error}</p>}
      </div>

      <div className="invd-credit">
        <span className="invd-credit-eyebrow">Return summary</span>
        <div className="invd-credit-count"><b>{picked.length}</b> item type{picked.length === 1 ? "" : "s"} selected</div>
        <div className="invd-credit-amount">
          <small>Estimated credit (inc. VAT)</small>
          <b>{gbp(credit)}</b>
        </div>
        <button className="invd-btn light" onClick={submit} disabled={busy || !picked.length}>
          {busy ? "Sending..." : "Raise return ticket"}
        </button>
        <p className="invd-pay-hint">Final credit is confirmed after our team reviews the return.</p>
      </div>
    </div>
  );
}

/* staff only: change the status of a ticket and reply to the client */
function TicketAdmin({ ticket }) {
  const [status, setStatus] = useState(ticket.status);
  const [response, setResponse] = useState(ticket.response || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setBusy(true);
    setMsg("");
    const r = await updateTicket(ticket.id, { status, response });
    setBusy(false);
    setMsg(r.ok ? "Saved. The client can see this now." : r.msg || "Could not save.");
  };

  return (
    <div className="invd-admin">
      <div className="invd-admin-row">
        <select className="invd-input" value={status} onChange={(e) => { setStatus(e.target.value); setMsg(""); }}>
          {STATUSES.map((st) => <option key={st}>{st}</option>)}
        </select>
        <button className="invd-btn" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
      </div>
      <textarea
        className="invd-input" rows={2} value={response}
        onChange={(e) => { setResponse(e.target.value); setMsg(""); }}
        maxLength={500} placeholder="Reply to the client (they will see it in My Tickets)"
      />
      {msg && <small className="invd-admin-msg">{msg}</small>}
    </div>
  );
}

/* ---------- Tickets of this invoice ---------- */
function TicketList({ tickets, staff }) {
  if (!tickets.length) {
    return (
      <div className="invd-empty">
        <i className="fa-solid fa-ticket" />
        <p>{staff ? "No tickets on this invoice." : "No tickets yet."}</p>
      </div>
    );
  }
  return (
    <div className="invd-tickets">
      {tickets.map((t) => (
        <article className={`invd-card invd-ticket ${t.type === "Return" ? "ret" : "mis"}`} key={t.id}>
          <div className="invd-ticket-head">
            <b className="invd-mono">{t.id}</b>
            <span className={`invd-type ${t.type === "Return" ? "ret" : "mis"}`}>{t.type === "Return" ? "Return order" : "Mistake"}</span>
            <TicketPill status={t.status} />
            <small>{fmtDate(t.date)}</small>
          </div>
          <p className="invd-ticket-issue">{t.issue}</p>
          {t.note && <p className="invd-ticket-note">{t.note}</p>}
          {t.lines.length > 0 && (
            <ul className="invd-ticket-lines">
              {t.lines.map((l) => (
                <li key={l.code}>{product(l.code)?.description || l.code}{t.type === "Return" ? ` x ${l.qty}` : ""}</li>
              ))}
            </ul>
          )}
          {t.type === "Return" && <p className="invd-ticket-credit">Estimated credit: <b>{gbp(t.credit)}</b></p>}
          {!staff && t.response && <p className="invd-ticket-reply"><i className="fa-solid fa-reply" /> {t.response}</p>}
          {staff && <TicketAdmin key={t.id} ticket={t} />}
        </article>
      ))}
    </div>
  );
}

/* "My Tickets" tab is hidden for everyone (Client Invoices + My Invoices).
   Set SHOW_TICKETS_TAB = true to bring it back. */
const SHOW_TICKETS_TAB = false;

/* ---------- The page ---------- */
export default function InvoiceDetail({ invoiceId, onBack, staff = false, backLabel = "Back to My Invoices", eyebrow = "CLIENT PORTAL" }) {
  const s = useHub();
  const [tab, setTab] = useState("invoice");
  const [flash, setFlash] = useState("");
  const [printMode, setPrintMode] = useState("receipt");
  const tpl = useInvoiceTemplate(); // template chosen in Settings -> Invoice Templates

  // CHANGED: "Report a Mistake" is visible only to Area Manager and ERP (staff). Clients do not see it.
  const canReport = staff;

  const invoice = s.invoices.find((i) => i.id === invoiceId);
  const backBtn = <button className="invd-back" onClick={onBack}><i className="fa-solid fa-arrow-left" /> {backLabel}</button>;

  if (!invoice) {
    return (
      <div className="invd-page">
        <PageHeader eyebrow={eyebrow} title="Invoice not found" icon="fa-file-invoice" actions={backBtn} showPrint={false} />
      </div>
    );
  }

  const order = s.orders.find((o) => o.id === invoice.orderId);
  const c = client(invoice.clientId);
  const payment = invoicePayment(invoice.id);   // latest payment (receipt)
  const payments = invoicePayments(invoice.id); // all part payments
  const tickets = invoiceTickets(invoice.id);
  const photoCount = invoicePhotos(invoice.id).length;
  const isPaid = String(invoice.status).toLowerCase() === "paid";
  const paidSoFar = round2(invoice.paid || 0);
  const balanceDue = round2(invoice.amount - paidSoFar);

  /* data for the printed invoice (uses the saved Settings -> Invoice Templates design).
     paid / balance are set here so the printed invoice always shows the balance amount. */
  const docData = {
    ...buildInvoiceDocData(invoice, order),
    paid: isPaid ? round2(invoice.amount) : paidSoFar,
    balance: isPaid ? 0 : Math.max(0, balanceDue),
  };

  const tabs = [
    { id: "invoice", label: "Invoice & Payment", icon: "fa-file-invoice-dollar" },
    { id: "photos", label: "Upload Photo", icon: "fa-camera", count: photoCount },
    { id: "mistake", label: "Report a Mistake", icon: "fa-triangle-exclamation" },
    // Return Order tab hidden for clients
    { id: "tickets", label: "My Tickets", icon: "fa-ticket", count: tickets.length },
  ];
  const done = (msg, next) => { setFlash(msg); setTab(next === "tickets" && !SHOW_TICKETS_TAB ? "invoice" : next); };
  const doPrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => {
      const cleanup = () => document.body.classList.remove("invd-printing");
      window.addEventListener("afterprint", cleanup, { once: true });
      document.body.classList.add("invd-printing");
      window.print();
    }, 80);
  };

  // CHANGED: Report a Mistake -> staff only. My Tickets -> hidden unless SHOW_TICKETS_TAB is true.
  const visibleTabs = tabs
    .filter((t) => (t.id === "mistake" ? canReport : true))
    .filter((t) => SHOW_TICKETS_TAB || t.id !== "tickets");

  return (
    <div className="invd-page">
      {/* showPrint={false}: this page has its own "Print invoice" / "Print receipt" buttons */}
      <PageHeader
        eyebrow={eyebrow}
        title={`Invoice ${invoice.id}`}
        subtitle={`${c?.name || ""} - Order ${invoice.orderId} - ${invoice.date ? fmtDate(invoice.date) : ""}`}
        icon="fa-file-invoice"
        actions={backBtn}
        showPrint={false}
      />

      {/* Hero strip */}
      <section className="invd-hero">
        <img className="invd-hero-logo" src={LOGO_SRC} alt="" onError={hideImg} />
        <div className="invd-hero-main">
          <small>{isPaid ? "Total paid" : paidSoFar > 0 ? "Balance due" : "Total due"}</small>
          <b>{gbp(isPaid ? invoice.amount : balanceDue)}</b>
        </div>
        <div className="invd-hero-meta">
          <div><small>Client</small><span>{c?.name || "-"}</span></div>
          <div><small>Order</small><span className="invd-mono">{invoice.orderId}</span></div>
          <div><small>Issued</small><span>{invoice.date ? fmtDate(invoice.date) : "-"}</span></div>
        </div>
        <div className={`invd-stamp ${isPaid ? "paid" : "due"}`} aria-hidden="true">{isPaid ? "PAID" : "DUE"}</div>
      </section>

      <div className="invd-tabs" role="tablist" aria-label="Invoice sections">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`invd-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`invd-panel-${t.id}`}
            className={`invd-tab${tab === t.id ? " active" : ""}`}
            onClick={() => { setTab(t.id); setFlash(""); }}
          >
            <i className={`fa-solid ${t.icon}`} /> {t.label}
            {t.count !== undefined && <span className="invd-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {flash && (
        <div className="invd-flash" role="status">
          <i className="fa-solid fa-circle-check" /> {flash}
          <button onClick={() => setFlash("")} aria-label="Dismiss">×</button>
        </div>
      )}

      <div role="tabpanel" id={`invd-panel-${tab}`} aria-labelledby={`invd-tab-${tab}`} className="invd-panel">
        {tab === "invoice" && (
          <div className="invd-grid">
            <div className="invd-sheet">
              <div className="invd-sheet-paper">
                <div className="invd-sheet-head">
                  <div>
                    <small>Invoice</small>
                    <h3 className="invd-mono">{invoice.id}</h3>
                  </div>
                  <div className="invd-sheet-actions">
                    <HubStatus status={invoice.status} />
                    {/* prints with the template saved in Settings -> Invoice Templates */}
                    <button type="button" className="invd-print-btn" onClick={printInvoiceDocument}>
                      <i className="fa-solid fa-print" /> Print invoice
                    </button>
                  </div>
                </div>

                {order ? (
                  <div className="invd-items">
                    <div className="invd-items-head">
                      <span>Item</span><span>Qty</span><span>Price</span><span>VAT</span><span>Total</span>
                    </div>
                    {order.lines.map((l, i) => (
                      <div className="invd-item" key={i}>
                        <span className="invd-item-name">{product(l.code)?.description || l.code}</span>
                        <span data-label="Qty">{l.qty}</span>
                        <span data-label="Price">{gbp(l.price)}</span>
                        <span data-label="VAT">{gbp(l.qty * l.price * VAT)}</span>
                        <span data-label="Total"><b>{gbp(l.qty * l.price)}</b></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="invd-hint">No order items are linked to this invoice.</p>
                )}

                <div className="invd-totals">
                  <div><span>Net</span><b>{gbp(invoice.amount - invoice.vat)}</b></div>
                  <div><span>VAT (20%)</span><b>{gbp(invoice.vat)}</b></div>
                  <div className="invd-grand"><span>Total</span><b>{gbp(invoice.amount)}</b></div>
                  {!isPaid && paidSoFar > 0 && (
                    <>
                      <div><span>Paid so far</span><b>{gbp(paidSoFar)}</b></div>
                      <div className="invd-grand"><span>Balance due</span><b>{gbp(balanceDue)}</b></div>
                    </>
                  )}
                </div>
              </div>
              <div className="invd-sheet-edge" aria-hidden="true" />

              <PaymentHistory payments={payments} total={invoice.amount} />
            </div>

            {isPaid
              ? <Receipt payment={payment} clientName={c?.name || "-"} onPrint={doPrint} />
              : (
                <PayPanel
                  key={`${invoice.id}-${paidSoFar}`}
                  invoice={invoice}
                  staff={staff}
                  onDone={(msg) => setFlash(msg)}
                />
              )}
          </div>
        )}

        {tab === "photos" && (
          <InvoicePhotos
            invoice={invoice}
            role={staff ? "manager" : "client"}
            managerId={s.session.managerId}
          />
        )}
        {/* CHANGED: guarded with canReport so a client can never open it */}
        {tab === "mistake" && canReport && (
          <MistakeForm invoice={invoice} order={order} onDone={(m) => done(m, "tickets")} />
        )}
        {tab === "tickets" && <TicketList tickets={tickets} staff={staff} />}
      </div>

      {/* "Print invoice" uses the saved template; "Print receipt" uses the receipt sheet */}
      <InvoicePrintPortal tpl={tpl} data={docData} money={money} />
      <PrintSheet mode={printMode} invoice={invoice} order={order} clientName={c?.name || "-"} payment={payment} />
    </div>
  );
}