import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getErpRecords } from "@/data/erpApi.js";
import { fmtDate } from "@/utils/format.js";
import "./ReviewModal.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const initials = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const REASONS = [
  { label: "Payment not received", icon: "fa-money-bill-1-wave" },
  { label: "Wrong amount", icon: "fa-calculator" },
  { label: "Duplicate payment", icon: "fa-clone" },
  { label: "Wrong invoice", icon: "fa-file-circle-xmark" },
  { label: "Other", icon: "fa-ellipsis" },
];

const RING = 326.73; // circumference of r=52

/* Centered popup: review a Pending payment, see what it does to the invoice, approve or reject */
export default function ReviewModal({ row, onClose, onApprove, onReject }) {
  const [inv, setInv] = useState(undefined); // undefined = loading, null = not found
  const [mode, setMode] = useState("review"); // review | reject
  const [chip, setChip] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null); // "approved" | "rejected"
  const box = useRef(null);

  useEffect(() => {
    /* payment with no invoice number: nothing to load, approve stays blocked, reject still works */
    if (!row.invoice) { setInv(null); return; }
    let live = true;
    getErpRecords("invoices")
      .then((list) => live && setInv(list.find((i) => i.number === row.invoice) || null))
      .catch(() => live && setInv(null));
    return () => { live = false; };
  }, [row.invoice]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => { box.current?.focus(); }, []);

  /* ---------- numbers ---------- */
  const name = row.name || row.customerName || "Customer";
  const amt = Number(row.amount || 0);
  const total = Number(inv?.amount || 0);
  const bal = Number(inv?.balance || 0);
  const paid = Math.max(0, round2(total - bal));
  const applied = Math.min(amt, bal);
  const after = Math.max(0, round2(bal - amt));
  const len = (v) => (total > 0 ? Math.min(1, Math.max(0, v / total)) * RING : 0);
  const pctAfter = total > 0 ? Math.round(((total - after) / total) * 100) : 0;
  const tooMuch = !!inv && amt > bal + 0.005;
  const blocked = inv === undefined || inv === null || tooMuch || !(amt > 0);
  const full = after <= 0;
  const invLabel = row.invoice || "(none)";

  const checks = inv === undefined ? [] : [
    { ok: !!inv, text: inv ? `Invoice ${invLabel} found` : row.invoice ? `Invoice ${invLabel} not found` : "No invoice linked" },
    { ok: amt > 0, text: amt > 0 ? "Amount entered" : "Amount is missing" },
    ...(inv ? [{ ok: !tooMuch, text: tooMuch ? "More than invoice balance" : "Within invoice balance" }] : []),
    { ok: !!row.date, text: row.date ? "Payment date present" : "No payment date" },
  ];

  /* ---------- actions ---------- */
  const run = async (fn, kind) => {
    setBusy(true);
    setErr("");
    const msg = await fn(); // null on success, or an error message
    setBusy(false);
    if (msg) return setErr(msg);
    setDone(kind);
    setTimeout(onClose, 2200);
  };
  const approve = () => run(() => onApprove(row), "approved");
  const reject = () => {
    if (!chip) return setErr("Choose a reason for rejecting.");
    run(() => onReject(row, note.trim() ? `${chip} — ${note.trim()}` : chip), "rejected");
  };

  /* ---------- progress stepper ---------- */
  const steps = [
    { t: "Submitted", s: row.date ? fmtDate(row.date) : "From Invoices page", state: "done", icon: "fa-paper-plane" },
    { t: "Admin review", s: done ? (done === "approved" ? "Approved" : "Rejected") : "Waiting for you", state: done ? "done" : "current", icon: "fa-user-check" },
    {
      t: "Invoice updated",
      s: done === "approved" ? (full ? "Paid in full" : "Partially Paid") : done === "rejected" ? "Reopened" : "After approval",
      state: done ? "done" : "todo", icon: "fa-file-invoice-dollar",
    },
  ];

  const node = (
    <div className="rm-bg" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="rm" role="dialog" aria-modal="true" aria-label="Review payment" tabIndex={-1} ref={box}>
        {/* ---------- header ---------- */}
        <header className="rm-head">
          <span className="rm-badge"><i className="fa-solid fa-clipboard-check" /></span>
          <div className="rm-title">
            <small>PAYMENT APPROVAL</small>
            <h3>Review {row.number || `#${row.id}`}</h3>
          </div>
          <span className={`rm-pill ${done === "approved" ? "green" : done === "rejected" ? "red" : "orange"}`}>
            <i />{done === "approved" ? "Approved" : done === "rejected" ? "Rejected" : "Pending approval"}
          </span>
          <button type="button" className="rm-x" aria-label="Close" onClick={onClose} disabled={busy}>
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        {/* ---------- stepper ---------- */}
        <ol className="rm-steps">
          {steps.map((st) => (
            <li key={st.t} className={st.state}>
              <span className="rm-dot"><i className={`fa-solid ${st.state === "done" ? "fa-check" : st.icon}`} /></span>
              <div><b>{st.t}</b><small>{st.s}</small></div>
            </li>
          ))}
        </ol>

        {done ? (
          <div className={`rm-done ${done}`} role="status">
            <span className="rm-okring">
              {done === "approved"
                ? <svg viewBox="0 0 52 52" aria-hidden="true"><path d="M14 27l8 8 16-17" /></svg>
                : <svg viewBox="0 0 52 52" aria-hidden="true"><path d="M17 17l18 18M35 17L17 35" /></svg>}
            </span>
            <h4>{done === "approved" ? "Payment approved" : "Payment rejected"}</h4>
            <p>
              {done === "approved"
                ? <>Invoice <b>{row.invoice}</b> is now <b>{full ? "Paid" : "Partially Paid"}</b>{full ? "." : <> — {money(after)} still due.</>}</>
                : row.invoice
                  ? <>Invoice <b>{row.invoice}</b> can take a payment again.</>
                  : <>This payment has been rejected.</>}
            </p>
            <button type="button" className="rm-btn ghost" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="rm-body">
              <div className="rm-cols">
                {/* ----- left: the payment ----- */}
                <section className="rm-card rm-pay">
                  <div className="rm-who">
                    <span className="rm-av">{initials(name)}</span>
                    <div>
                      <b>{name}</b>
                      <small>{row.email || row.owner || "No contact saved"}</small>
                    </div>
                  </div>

                  <div className="rm-amount">
                    <small>Payment amount</small>
                    <b>{money(amt)}</b>
                  </div>

                  <ul className="rm-list">
                    <li><i className="fa-solid fa-file-invoice" /><span>Invoice</span><b>{row.invoice || "—"}</b></li>
                    <li><i className="fa-solid fa-calendar-day" /><span>Payment date</span><b>{row.date ? fmtDate(row.date) : "—"}</b></li>
                    <li><i className="fa-solid fa-credit-card" /><span>Method</span><b>{row.method || "—"}</b></li>
                    <li><i className="fa-solid fa-hashtag" /><span>Reference</span><b>{row.reference || "—"}</b></li>
                  </ul>
                </section>

                {/* ----- right: what happens to the invoice ----- */}
                <section className="rm-card rm-inv">
                  <div className="rm-card-h">
                    <span><i className="fa-solid fa-chart-pie" /> Invoice impact</span>
                    <em>{row.invoice || "No invoice"}</em>
                  </div>

                  {inv === undefined && <p className="rm-load"><i className="fa-solid fa-spinner fa-spin" /> Loading invoice…</p>}
                  {inv === null && (
                    <p className="rm-warn">
                      <i className="fa-solid fa-triangle-exclamation" />
                      {row.invoice
                        ? ` Invoice ${row.invoice} was not found, so this payment cannot be approved.`
                        : " This payment is not linked to an invoice, so it cannot be approved. You can still reject it."}
                    </p>
                  )}

                  {inv && (
                    <div className="rm-impact">
                      <div className="rm-ring">
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                          <circle className="bg" cx="60" cy="60" r="52" />
                          <circle className="p1" cx="60" cy="60" r="52" strokeDasharray={`${len(paid)} ${RING}`} />
                          <circle className="p2" cx="60" cy="60" r="52" strokeDasharray={`${len(applied)} ${RING}`} strokeDashoffset={-len(paid)} />
                        </svg>
                        <div><b>{pctAfter}%</b><small>paid after<br />approval</small></div>
                      </div>

                      <dl className="rm-rows">
                        <div><dt><i className="s1" />Already paid</dt><dd>{money(paid)}</dd></div>
                        <div><dt><i className="s2" />This payment</dt><dd className="plus">+ {money(amt)}</dd></div>
                        <div><dt><i className="s3" />Invoice total</dt><dd>{money(total)}</dd></div>
                        <div className="strong">
                          <dt>Balance</dt>
                          <dd>{money(bal)} <i className="fa-solid fa-arrow-right" /> <b>{money(after)}</b></dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {inv && !tooMuch && (
                    <div className={`rm-outcome ${full ? "green" : "purple"}`}>
                      <i className={`fa-solid ${full ? "fa-circle-check" : "fa-chart-pie"}`} />
                      {full ? "Invoice will be marked Paid in full" : `Invoice will become Partially Paid (${money(after)} left)`}
                    </div>
                  )}
                  {tooMuch && (
                    <p className="rm-warn"><i className="fa-solid fa-triangle-exclamation" /> This payment is more than the invoice balance ({money(bal)}). Reject it and ask for a new payment.</p>
                  )}
                </section>
              </div>

              {/* safety checks */}
              {checks.length > 0 && (
                <ul className="rm-checks" aria-label="Checks before approval">
                  {checks.map((c) => (
                    <li key={c.text} className={c.ok ? "ok" : "bad"}>
                      <i className={`fa-solid ${c.ok ? "fa-circle-check" : "fa-circle-xmark"}`} /> {c.text}
                    </li>
                  ))}
                </ul>
              )}

              {/* reject reason */}
              {mode === "reject" && (
                <section className="rm-card rej">
                  <div className="rm-card-h"><span><i className="fa-solid fa-ban" /> Why are you rejecting this payment?</span></div>
                  <div className="rm-chips" role="radiogroup" aria-label="Reject reason">
                    {REASONS.map((r) => (
                      <button key={r.label} type="button" role="radio" aria-checked={chip === r.label}
                        className={`rm-chip${chip === r.label ? " on" : ""}`} onClick={() => { setChip(r.label); setErr(""); }}>
                        <i className={`fa-solid ${r.icon}`} /> {r.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="rm-note" rows={2} maxLength={200} placeholder="Add a note (optional)"
                    value={note} onChange={(e) => setNote(e.target.value)}
                  />
                </section>
              )}

              {err && <p className="rm-err" role="alert"><i className="fa-solid fa-circle-exclamation" /> {err}</p>}
            </div>

            {/* ---------- footer ---------- */}
            <footer className="rm-foot">
              <span className="rm-hint"><kbd>Esc</kbd> to close</span>
              {mode === "review" ? (
                <>
                  <button type="button" className="rm-btn no" onClick={() => { setMode("reject"); setErr(""); }} disabled={busy}>
                    <i className="fa-solid fa-xmark" /> Reject
                  </button>
                  <button type="button" className="rm-btn ok" onClick={approve} disabled={busy || blocked}>
                    <i className={busy ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-check"} /> {busy ? "Approving..." : "Approve payment"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="rm-btn ghost" onClick={() => { setMode("review"); setErr(""); }} disabled={busy}>
                    <i className="fa-solid fa-arrow-left" /> Back
                  </button>
                  <button type="button" className="rm-btn danger" onClick={reject} disabled={busy}>
                    <i className={busy ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-ban"} /> {busy ? "Rejecting..." : "Confirm reject"}
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );

  /* portal keeps position:fixed correct even inside animated page wrappers; stays inside .app for dark mode */
  return createPortal(node, document.querySelector(".app") || document.body);
}