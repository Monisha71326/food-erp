import { useState } from "react";
import "./PaymentModal.css";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  online: { payerName: "", reference: "", paidOn: today(), cardLast4: "" },
  cheque: { chequeNo: "", bankName: "", accountHolder: "", chequeDate: today() },
};

export default function PaymentModal({ invoice, money, onClose, onSubmit }) {
  const [method, setMethod] = useState("online");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const values = form[method];
  const set = (key, val) => {
    setForm((f) => ({ ...f, [method]: { ...f[method], [key]: val } }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (method === "online") {
      if (!values.payerName.trim()) e.payerName = "Payer name venum";
      if (!values.reference.trim()) e.reference = "Transaction reference venum";
      if (!values.paidOn) e.paidOn = "Date venum";
      if (values.cardLast4 && !/^\d{4}$/.test(values.cardLast4)) e.cardLast4 = "4 digits mattum";
    } else {
      if (!/^\d{6}$/.test(values.chequeNo.trim())) e.chequeNo = "6-digit cheque number venum";
      if (!values.bankName.trim()) e.bankName = "Bank name venum";
      if (!values.accountHolder.trim()) e.accountHolder = "Account holder name venum";
      if (!values.chequeDate) e.chequeDate = "Cheque date venum";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({
      method,
      amount: invoice.amount,
      details: { ...values },
      submittedAt: new Date().toISOString(),
    });
  };

  const field = (key, label, props = {}) => (
    <label className="pay-field">
      <span>{label}</span>
      <input
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        className={errors[key] ? "has-error" : ""}
        {...props}
      />
      {errors[key] && <em className="pay-error">{errors[key]}</em>}
    </label>
  );

  return (
    <div className="pay-overlay" onMouseDown={onClose}>
      <form className="pay-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <header className="pay-head">
          <div>
            <h3>Pay Invoice {invoice.id}</h3>
            <p>Amount due: <strong>{money(invoice.amount)}</strong></p>
          </div>
          <button type="button" className="btn-ghost" aria-label="Close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="pay-methods" role="tablist">
          <button type="button" role="tab" aria-selected={method === "online"}
            className={method === "online" ? "active" : ""} onClick={() => setMethod("online")}>
            <i className="fa-solid fa-globe" /> Online
          </button>
          <button type="button" role="tab" aria-selected={method === "cheque"}
            className={method === "cheque" ? "active" : ""} onClick={() => setMethod("cheque")}>
            <i className="fa-solid fa-money-check" /> Cheque
          </button>
        </div>

        <div className="pay-body">
          {method === "online" ? (
            <>
              {field("payerName", "Payer name *")}
              {field("reference", "Transaction / reference ID *")}
              {field("paidOn", "Payment date *", { type: "date", max: today() })}
              {field("cardLast4", "Card last 4 digits (optional)", { inputMode: "numeric", maxLength: 4 })}
            </>
          ) : (
            <>
              {field("chequeNo", "Cheque number *", { inputMode: "numeric", maxLength: 6 })}
              {field("bankName", "Bank name *")}
              {field("accountHolder", "Account holder name *")}
              {field("chequeDate", "Cheque date *", { type: "date" })}
              <p className="pay-note">Cheque clear aana piragu dhaan invoice "Paid" aagum.</p>
            </>
          )}
        </div>

        <footer className="pay-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">
            {method === "online" ? "Confirm payment" : "Submit cheque details"}
          </button>
        </footer>
      </form>
    </div>
  );
}