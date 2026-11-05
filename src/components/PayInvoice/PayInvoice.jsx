import { useState } from "react";
import { payInvoice, gbp } from "@/data/orderHubStore.js";
import "./PayInvoice.css";

const METHODS = [
  { id: "Card", icon: "fa-credit-card" },
  { id: "Bank Transfer", icon: "fa-building-columns" },
];

/* Drop inside any invoice popup: <PayInvoice invoice={invoice} label="Pay Now" /> */
export default function PayInvoice({ invoice, label = "Pay Now" }) {
  const [step, setStep] = useState("idle"); // idle | choose | done
  const [method, setMethod] = useState("Card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (step === "done")
    return <p className="pay-done"><i className="fa-solid fa-circle-check" /> Payment of {gbp(invoice.amount)} recorded.</p>;

  if (String(invoice.status).toLowerCase() === "paid")
    return <p className="pay-done"><i className="fa-solid fa-circle-check" /> This invoice is paid</p>;

  const confirm = async () => {
    setBusy(true);
    setError("");
    const r = await payInvoice(invoice.id, { method });
    setBusy(false);
    if (r.ok) setStep("done");
    else setError(r.msg || "Payment failed.");
  };

  if (step === "idle")
    return (
      <button className="pay-btn" onClick={() => setStep("choose")}>
        <i className="fa-solid fa-credit-card" /> {label} {gbp(invoice.amount)}
      </button>
    );

  return (
    <div className="pay-box">
      <p className="pay-title">Choose payment method</p>
      <div className="pay-methods">
        {METHODS.map((m) => (
          <button key={m.id} type="button" className={`pay-method${method === m.id ? " sel" : ""}`} onClick={() => setMethod(m.id)}>
            <i className={`fa-solid ${m.icon}`} /> {m.id}
          </button>
        ))}
      </div>
      {error && <p className="pay-error">{error}</p>}
      <div className="pay-actions">
        <button className="pay-cancel" onClick={() => setStep("idle")} disabled={busy}>Cancel</button>
        <button className="pay-btn" onClick={confirm} disabled={busy}>
          {busy ? "Processing..." : `Confirm ${gbp(invoice.amount)}`}
        </button>
      </div>
    </div>
  );
}