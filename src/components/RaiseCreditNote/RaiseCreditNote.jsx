import { useEffect, useMemo, useState } from "react";
import { getErpRecords, raiseCreditNote } from "@/data/erpApi.js";
import { useHub } from "@/data/orderHubStore.js";
import "./RaiseCreditNote.css";

/*
 * Drop this into the Accountant page:   <RaiseCreditNote />
 * Optional:  <RaiseCreditNote onRaised={(note) => ...} />   (e.g. to refresh a list)
 * The credit note is saved in Sales > Credit Notes automatically.
 */
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RaiseCreditNote({ onRaised }) {
  const hub = useHub(); // Order Hub clients (Client Portal) - e.g. "Spice Market Ltd"
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({ customer: "", invoice: "", amount: "", ref: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const load = () => {
    getErpRecords("customers").then((l) => setCustomers(Array.isArray(l) ? l : [])).catch(() => {});
    getErpRecords("invoices").then((l) => setInvoices(Array.isArray(l) ? l : [])).catch(() => {});
  };
  useEffect(load, []);

  /* names from Sales > Customers AND from the Client Portal clients */
  const names = useMemo(() => {
    const all = [
      ...customers.map((c) => c.name || c.customer || c.customerName),
      ...(hub.clients || []).map((c) => c.name),
    ].filter(Boolean).map((n) => String(n).trim());
    const seen = new Map();
    all.forEach((n) => { if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n); });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [customers, hub.clients]);
  const customerInvoices = useMemo(
    () => invoices.filter((r) => form.customer && sameName(r.customer || r.customerName, form.customer)),
    [invoices, form.customer],
  );
  const picked = customerInvoices.find((r) => String(r.number || r.invoiceNumber) === form.invoice);
  const pickedBalance = picked ? (picked.balance === undefined || picked.balance === "" ? Number(picked.amount) || 0 : Number(picked.balance)) : null;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v, ...(k === "customer" ? { invoice: "" } : {}) })); setMsg(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await raiseCreditNote(form);
      setMsg({ ok: true, text: `Credit note ${r.data.number} raised. It now shows in Sales > Credit Notes.` });
      setForm({ customer: form.customer, invoice: "", amount: "", ref: "", reason: "" });
      load();
      onRaised?.(r.data);
    } catch (err) {
      setMsg({ ok: false, text: err.message || "Could not raise the credit note." });
    }
    setBusy(false);
  };

  return (
    <form className="rcn" onSubmit={submit}>
      <h3 className="rcn-title"><i className="fa-solid fa-file-circle-minus" aria-hidden="true" /> Raise credit note</h3>

      <div className="rcn-grid">
        <label>
          <span>Customer *</span>
          <select value={form.customer} onChange={(e) => set("customer", e.target.value)} required>
            <option value="">Select customer</option>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label>
          <span>Against invoice (optional)</span>
          <select value={form.invoice} onChange={(e) => set("invoice", e.target.value)} disabled={!form.customer}>
            <option value="">No invoice</option>
            {customerInvoices.map((r) => {
              const no = r.number || r.invoiceNumber;
              return <option key={r.id} value={no}>{no} - {money(r.amount)}</option>;
            })}
          </select>
        </label>

        <label>
          <span>Credit amount (£) *</span>
          <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          {pickedBalance !== null && <small>Invoice balance now: {money(pickedBalance)}</small>}
        </label>

        <label>
          <span>Reference</span>
          <input type="text" value={form.ref} onChange={(e) => set("ref", e.target.value)} />
        </label>

        <label className="rcn-full">
          <span>Reason</span>
          <input type="text" value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Damaged goods returned" />
        </label>
      </div>

      <div className="rcn-foot">
        <button type="submit" className="rcn-btn" disabled={busy}>{busy ? "Raising..." : "Raise credit note"}</button>
        {msg && <span className={`rcn-msg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}