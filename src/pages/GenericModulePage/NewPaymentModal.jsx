import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getErpRecords } from "@/data/erpApi.js";
import "./ReviewModal.css";
import "./NewPaymentModal.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const METHODS = ["Bank Transfer", "Card", "Cash", "Cheque", "Direct Debit"];

/* name of the customer an invoice belongs to (adjust if your invoice field is different) */
const custOf = (inv) => inv.customerName || inv.customer || inv.name || "";

/* Popup: pick a customer -> pick one of their unpaid invoices -> enter payment -> save as Pending */
export default function NewPaymentModal({ onClose, onCreate }) {
  const [customers, setCustomers] = useState(undefined); // undefined = loading
  const [invoices, setInvoices] = useState([]);
  const [customer, setCustomer] = useState("");
  const [invoice, setInvoice] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.all([getErpRecords("customers").catch(() => []), getErpRecords("invoices").catch(() => [])]).then(([c, i]) => {
      if (!live) return;
      setInvoices(i);
      /* use the customers list; fall back to names found on invoices */
      const names = c.length ? c.map((x) => x.name || x.customerName || x.company).filter(Boolean) : i.map(custOf).filter(Boolean);
      setCustomers([...new Set(names)].sort((a, b) => a.localeCompare(b)));
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => { box.current?.focus(); }, []);

  /* only invoices of the chosen customer that still have a balance */
  const open = useMemo(
    () => invoices.filter((i) => custOf(i) === customer && Number(i.balance ?? i.amount ?? 0) > 0),
    [invoices, customer]
  );
  const inv = open.find((i) => i.number === invoice);
  const bal = Number(inv?.balance ?? inv?.amount ?? 0);

  const pickCustomer = (v) => { setCustomer(v); setInvoice(""); setAmount(""); setErr(""); };
  const pickInvoice = (v) => {
    setInvoice(v);
    const i = open.find((x) => x.number === v);
    setAmount(i ? String(Number(i.balance ?? i.amount ?? 0)) : ""); // default = full balance
    setErr("");
  };

  const save = async () => {
    const amt = Number(amount);
    if (!customer) return setErr("Select a customer.");
    if (!invoice) return setErr("Select an invoice to pay.");
    if (!(amt > 0)) return setErr("Enter an amount greater than 0.");
    if (amt > bal + 0.005) return setErr(`Amount is more than the invoice balance (${money(bal)}).`);
    if (!date) return setErr("Choose the payment date.");
    setBusy(true);
    setErr("");
    let msg;
    try {
      if (typeof onCreate !== "function") throw new Error("Save is not connected yet: pass onCreate to <PaymentsView />.");
      msg = await onCreate({
        name: customer, customerName: customer, invoice, amount: amt, method, date,
        reference: reference.trim(), status: "Completed", // applied straight away: parent's onCreate reduces the invoice balance
      }); // null on success, or an error message
    } catch (e) {
      msg = e.message || "Could not save the payment.";
    }
    setBusy(false);
    if (msg) return setErr(msg);
    onClose();
  };

  const node = (
    <div className="rm-bg" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="rm np" role="dialog" aria-modal="true" aria-label="Add payment" tabIndex={-1} ref={box}>
        <header className="rm-head">
          <span className="rm-badge"><i className="fa-solid fa-money-bill-wave" /></span>
          <div className="rm-title"><small>NEW PAYMENT</small><h3>Add payment</h3></div>
          <button type="button" className="rm-x" aria-label="Close" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /></button>
        </header>

        <div className="rm-body">
          <section className="rm-card np-form">
            <label className="np-f full">
              <span>Customer</span>
              <select value={customer} onChange={(e) => pickCustomer(e.target.value)} disabled={customers === undefined}>
                <option value="">{customers === undefined ? "Loading customers…" : "Select customer"}</option>
                {(customers || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="np-f full">
              <span>Invoice</span>
              <select value={invoice} onChange={(e) => pickInvoice(e.target.value)} disabled={!customer}>
                <option value="">{!customer ? "Select a customer first" : open.length ? "Select invoice" : "No unpaid invoices"}</option>
                {open.map((i) => (
                  <option key={i.number} value={i.number}>{i.number} — balance {money(i.balance ?? i.amount)}</option>
                ))}
              </select>
            </label>

            <label className="np-f">
              <span>Amount (£)</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!invoice} />
            </label>
            <label className="np-f">
              <span>Payment date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="np-f">
              <span>Method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="np-f">
              <span>Reference</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" maxLength={60} />
            </label>
          </section>

          {inv && <p className="np-hint">Invoice balance {money(bal)} → after this payment {money(Math.max(0, bal - Number(amount || 0)))}</p>}
          {err && <p className="rm-err" role="alert"><i className="fa-solid fa-circle-exclamation" /> {err}</p>}
        </div>

        <footer className="rm-foot">
          <span className="rm-hint"><kbd>Esc</kbd> to close</span>
          <button type="button" className="rm-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="rm-btn ok" onClick={save} disabled={busy}>
            <i className={busy ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-check"} /> {busy ? "Saving..." : "Save payment"}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(node, document.querySelector(".app") || document.body);
}