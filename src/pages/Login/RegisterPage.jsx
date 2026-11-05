import { useId, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, AtSign, Building2, Check, Eye, EyeOff, Hash, KeyRound, Lock,
  Mail, MapPin, Phone, ShieldCheck, TriangleAlert, User, X,
} from "lucide-react";
import logo from "@/assets/logo.webp";
import { ROLES } from "@/data/roleNavigation.js";
import { register, registrableClients, usernameTaken, ADMIN_ACCESS_CODE, MIN_PASSWORD } from "@/data/authStore.js";
import AuthHero from "./AuthHero.jsx";
import "./LoginPage.css"; // shared layout + left hero
import "./RegisterPage.css";

const EMPTY = { fullName: "", company: "", email: "", phone: "", address: "", pincode: "", clientIds: [], accessCode: "", username: "", password: "", confirm: "" };
const STEPS = ["Role", "Details", "Security"];
const USER_RE = /^[a-z0-9._-]{3,24}$/;
const PHONE_RE = /^[+\d][\d\s()-]{6,18}$/;
// Indian 6-digit pincode (600001) OR UK postcode (SW1A 1AA)
const PINCODE_RE = /^([1-9]\d{5}|[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2})$/;
const META = {
  client:  { code: "CL", perks: ["Orders", "Invoices", "Offers"] },
  manager: { code: "AM", perks: ["Visits", "Order for clients"] },
  admin:   { code: "BO", perks: ["Fulfilment", "Pricing", "Finance"], locked: true },
  erp:     { code: "ER", perks: ["Every module", "Full control"], locked: true },
};
const STEP_TITLE = [
  ["Pick your role", "How will you be using Order Hub?"],
  ["Tell us about you", "A few details so we can set up your workspace."],
  ["Secure your account", "Choose how you'll sign in."],
];

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- floating-label field ---------- */
function Field({ icon: Icon, label, error, hint, right, wide, ...props }) {
  const id = useId();
  return (
    <div className={`rg-field${wide ? " wide" : ""}${error ? " bad" : ""}`}>
      <div className="rg-box">
        {Icon && <Icon size={17} className="rg-ico" />}
        <input id={id} placeholder=" " aria-invalid={!!error} {...props} />
        <label htmlFor={id}>{label}</label>
        {right}
      </div>
      {error ? <small className="rg-err"><X size={12} /> {error}</small> : hint ? <small className="rg-hint">{hint}</small> : null}
    </div>
  );
}

/* ---------- password strength ---------- */
function strengthOf(pw) {
  const checks = [pw.length >= MIN_PASSWORD, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = pw ? checks.filter(Boolean).length : 0;
  return { checks, score: pw.length >= MIN_PASSWORD ? Math.max(score, 1) : Math.min(score, 1) };
}
function Strength({ pw }) {
  const { checks, score } = strengthOf(pw);
  const labels = ["", "Weak", "Okay", "Good", "Strong"];
  const items = [`${MIN_PASSWORD}+ characters`, "Aa mix", "123", "#@!"];
  return (
    <div className="rg-strength" data-s={score}>
      <div className="rg-meter"><i /><i /><i /><i /></div>
      <div className="rg-rules">
        {items.map((t, i) => <span key={t} className={checks[i] && pw ? "ok" : ""}><Check size={11} /> {t}</span>)}
        <em>{labels[score]}</em>
      </div>
    </div>
  );
}

/* ---------- live access pass ---------- */
function Pass({ role, f, done }) {
  const r = ROLES[role];
  const m = META[role];
  const name = f.fullName.trim();
  const uname = f.username.trim().toLowerCase();
  const initials = name ? name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "";
  const seed = hash(name + uname + role);
  const bars = useMemo(() => {
    let x = seed || 7;
    return Array.from({ length: 34 }, () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return 1 + (x >>> 16) % 4; });
  }, [seed]);
  const idNo = name || uname ? String(seed % 10000).padStart(4, "0") : "••••";

  return (
    <div className={`rg-pass${done ? " done" : ""}`}>
      <div className="rg-pass-top">
        <img src={logo} alt="" />
        <span>Access pass</span>
      </div>
      <div className="rg-pass-who">
        <div className="rg-avatar" key={role + (initials ? "i" : "n")}>
          {initials || <i className={`fa-solid ${r.icon}`} aria-hidden="true" />}
        </div>
        <div className="rg-pass-name">
          <b className={name ? "" : "ph"}>{name || "Your name"}</b>
          <span><i className={`fa-solid ${r.icon}`} aria-hidden="true" /> {r.label}</span>
        </div>
      </div>
      <dl className="rg-pass-meta">
        <div><dt>{role === "client" ? "Company" : "Organisation"}</dt><dd>{role === "client" && f.company.trim() ? f.company.trim() : "Meg World Technologies"}</dd></div>
        <div><dt>Username</dt><dd>{uname ? `@${uname}` : "—"}</dd></div>
      </dl>
      <div className="rg-pass-bar">
        <div className="rg-bars" aria-hidden="true">{bars.map((w, i) => <span key={i} style={{ width: w * 1.5 }} />)}</div>
        <small>MEG-{m.code}-{idNo}</small>
      </div>
      {done && <div className="rg-stamp"><ShieldCheck size={15} /> Verified</div>}
    </div>
  );
}

export default function RegisterPage({ onRegistered, onBack }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [role, setRole] = useState("client");
  const [f, setF] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [banner, setBanner] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); setBanner(""); };
  const toggleClient = (id) => setF((p) => ({ ...p, clientIds: p.clientIds.includes(id) ? p.clientIds.filter((x) => x !== id) : [...p.clientIds, id] }));
  const pickRole = (id) => { setRole(id); setErrs({}); setBanner(""); };

  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (f.fullName.trim().length < 2) e.fullName = "Enter your full name.";
      if (role === "client") {
        if (f.company.trim().length < 2) e.company = "Enter your company / shop name.";
        if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
        if (!f.phone.trim()) e.phone = "Phone number is required.";
        else if (!PHONE_RE.test(f.phone.trim())) e.phone = "Enter a valid phone number.";
        if (f.address.trim().length < 5) e.address = "Address is required.";
        if (!f.pincode.trim()) e.pincode = "Pincode / postcode is required.";
        else if (!PINCODE_RE.test(f.pincode.trim())) e.pincode = "Enter a valid pincode (e.g. 600001) or postcode.";
      }
      if ((role === "admin" || role === "erp") && f.accessCode.trim() !== ADMIN_ACCESS_CODE) e.accessCode = "Invalid admin access code.";
    }
    if (s === 2) {
      const u = f.username.trim().toLowerCase();
      if (!USER_RE.test(u)) e.username = "3–24 characters: letters, numbers, dot, dash or underscore.";
      else if (usernameTaken(u)) e.username = "That username is already taken.";
      if (f.password.length < MIN_PASSWORD) e.password = `At least ${MIN_PASSWORD} characters.`;
      if (f.confirm !== f.password || !f.confirm) e.confirm = "Passwords do not match.";
    }
    return e;
  };

  const go = (to) => { setDir(to > step ? 1 : -1); setStep(to); setBanner(""); };
  const next = () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrs(e); return; }
    setErrs({}); go(step + 1);
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (done) return;
    if (step < 2) { next(); return; }
    const e = validate(2);
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setBanner("");
    try {
      const r = await register({ ...f, role });
      if (!r.ok) { setBanner(r.msg); return; }
      setDone(r.user);
      setTimeout(() => (onRegistered ? onRegistered(r.user) : onBack()), 1600);
    } catch { setBanner("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const uname = f.username.trim().toLowerCase();
  const uState = !uname ? "" : !USER_RE.test(uname) ? "bad" : usernameTaken(uname) ? "taken" : "ok";
  const pwMatch = f.confirm && f.confirm === f.password;
  const [title, lead] = STEP_TITLE[step];
  const r = ROLES[role];

  const pwToggle = (
    <button type="button" className="rg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <div className="login">
      <AuthHero />

      <main className="rg-panel">
        <div className="rg-bg" aria-hidden="true"><i /><i /><i /></div>

        <div className="rg-wrap">
          <div className="rg-topbar">
            <button type="button" className="rg-back" onClick={onBack}><ArrowLeft size={15} /> Back to sign in</button>
            <span>Already registered? <button type="button" onClick={onBack}>Sign in</button></span>
          </div>

          <div className="rg-card">
            <header className="rg-head">
              <p className="rg-eyebrow"><span /> New account</p>
              <h2>{done ? "Registration complete" : "Let's get you onboard"}</h2>
            </header>

            <ol className="rg-steps" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className={done || i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}>
                  <button type="button" disabled={done || i > step} onClick={() => go(i)}>
                    <span className="rg-dot">{done || i < step ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                    <span className="rg-step-name">{s}</span>
                  </button>
                </li>
              ))}
            </ol>

            <form className="rg-body" onSubmit={submit} noValidate>
              <div className="rg-main">
                {done ? (
                  <div className="rg-done">
                    <div className="rg-ring"><Check size={34} strokeWidth={3} /></div>
                    <h3>Account created, {f.fullName.trim().split(/\s+/)[0]}!</h3>
                    <p>Taking you to Sign in…</p>
                    <div className="rg-load"><i /></div>
                  </div>
                ) : (
                  <>
                    <div className="rg-step-head">
                      <h3>{title}</h3>
                      <p>{lead}</p>
                    </div>

                    <div className={`rg-step ${dir > 0 ? "fwd" : "back"}`} key={step + role}>
                      {step === 0 && (
                        <label className="rg-role-select-wrap">
                          <span className="rg-group-label">Choose your role</span>
                          <select className="rg-role-select" value={role} onChange={(e) => pickRole(e.target.value)} aria-label="Choose your role">
                            {Object.entries(ROLES).map(([id, ro]) => <option key={id} value={id}>{ro.label}</option>)}
                          </select>
                          <small className="rg-hint">Select the account type you want to create.</small>
                        </label>
                      )}

                      {step === 1 && (
                        <div className="rg-grid">
                          <Field wide icon={User} label="Full name" value={f.fullName} onChange={set("fullName")} error={errs.fullName} autoComplete="name" autoFocus />
                          {role === "client" && (
                            <>
                              <Field wide icon={Building2} label="Company / shop name" value={f.company} onChange={set("company")} error={errs.company} />
                              <Field icon={Mail} label="Email" type="email" value={f.email} onChange={set("email")} error={errs.email} autoComplete="email" />
                              <Field icon={Phone} label="Phone *" type="tel" value={f.phone} onChange={set("phone")} error={errs.phone} autoComplete="tel" />
                              <Field wide icon={MapPin} label="Address *" value={f.address} onChange={set("address")} error={errs.address} autoComplete="street-address" />
                              <Field icon={Hash} label="Pincode / Postcode *" value={f.pincode} onChange={set("pincode")} error={errs.pincode} autoComplete="postal-code" />
                            </>
                          )}
                          {role === "manager" && (
                            <div className="rg-field wide">
                              <span className="rg-group-label">Clients you cover <em>(optional)</em></span>
                              <div className="rg-chips">
                                {registrableClients().map((c) => (
                                  <button type="button" key={c.id} className={`rg-chip${f.clientIds.includes(c.id) ? " on" : ""}`} aria-pressed={f.clientIds.includes(c.id)} onClick={() => toggleClient(c.id)}>
                                    <Check size={13} strokeWidth={3} /> {c.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {(role === "admin" || role === "erp") && (
                            <Field wide icon={KeyRound} label="Admin access code" value={f.accessCode} onChange={set("accessCode")} error={errs.accessCode} hint="Provided by your administrator." autoComplete="off" />
                          )}
                        </div>
                      )}

                      {step === 2 && (
                        <div className="rg-grid">
                          <Field
                            wide icon={AtSign} label="Username" value={f.username} onChange={set("username")} error={errs.username}
                            autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus
                            right={uState && <span className={`rg-status ${uState}`}>{uState === "ok" ? "Available" : uState === "taken" ? "Taken" : ""}</span>}
                          />
                          <Field wide icon={Lock} label="Password" type={show ? "text" : "password"} value={f.password} onChange={set("password")} error={errs.password} autoComplete="new-password" right={pwToggle} />
                          <div className="rg-field wide"><Strength pw={f.password} /></div>
                          <Field
                            wide icon={Lock} label="Confirm password" type={show ? "text" : "password"} value={f.confirm} onChange={set("confirm")} error={errs.confirm} autoComplete="new-password"
                            right={pwMatch ? <span className="rg-match"><Check size={14} strokeWidth={3} /></span> : null}
                          />
                        </div>
                      )}
                    </div>

                    {banner && <div className="rg-banner" role="alert"><TriangleAlert size={16} /> {banner}</div>}

                    <div className="rg-actions">
                      {step > 0
                        ? <button type="button" className="rg-ghost" onClick={() => go(step - 1)}><ArrowLeft size={15} /> Back</button>
                        : <span />}
                      <button type="submit" className="rg-btn" disabled={busy}>
                        <span>{busy ? "Creating…" : step < 2 ? "Continue" : "Create account"}</span>
                        <i>{step < 2 ? <ArrowRight size={16} /> : <Check size={16} strokeWidth={3} />}</i>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}