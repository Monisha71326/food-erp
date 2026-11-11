import { useState } from "react";
import {
  ArrowLeft, ArrowRight, AtSign, Check, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, TriangleAlert, User,
} from "lucide-react";
import { ROLES } from "@/data/roleNavigation.js";
import { verifyResetIdentity, resetPassword, MIN_PASSWORD } from "@/data/authStore.js";
import AuthHero from "./AuthHero.jsx";
import AuthField from "./AuthField.jsx";
import "./LoginPage.css";    // shared layout + left hero
import "./RegisterPage.css"; // shared right-side card styles (same look as Register)

/* what the person must enter to prove it is their account (per role) */
const PROOF = {
  client:  { label: "Registered email address", icon: Mail,        type: "email",    hint: "Enter the email address used when this account was created." },
  manager: { label: "Full name (as registered)", icon: User,        type: "text",     hint: "Enter your full name exactly as it appears on your account." },
  admin:   { label: "Admin access code",         icon: ShieldCheck, type: "password", hint: "Enter the admin access code." },
  erp:     { label: "Admin access code",         icon: ShieldCheck, type: "password", hint: "Enter the admin access code." },
};

const COPY = {
  login:  { eyebrow: "Welcome back",     title: "Sign in to continue",   step: "Your account",       lead: "Choose your role, then sign in." },
  verify: { eyebrow: "Account recovery", title: "Forgot your password?", step: "Verify it's you",    lead: "" },
  reset:  { eyebrow: "Almost there",     title: "Set a new password",    step: "New password",       lead: `Use at least ${MIN_PASSWORD} characters.` },
};

/* ---------- STATIC CREDENTIALS (change as you like) ---------- */
const STATIC_USERS = {
  admin:   { id: "ADMIN", name: "Administrator", role: "admin",   username: "admin",   password: "admin123" },
  manager: { id: "AM1",   name: "Area Manager",  role: "manager", username: "manager", password: "manager123" },
  client:  { id: "C1",    name: "Client",        role: "client",  username: "client",  password: "client123" },
  erp:     { id: "ERP",   name: "ERP",           role: "erp",     username: "erp",     password: "erp123" },
};

const staticLogin = ({ username, password, role }) => {
  const u = STATIC_USERS[role];
  if (!u || username.trim().toLowerCase() !== u.username || password !== u.password) {
    return { ok: false, msg: "Wrong username or password for the selected role." };
  }
  const { password: _pw, ...user } = u; // never pass the password on
  return { ok: true, user };
};

export default function LoginPage({ onLogin, onRegister, prefill }) {
  const [mode, setMode] = useState("login"); // login | verify | reset
  const [role, setRole] = useState(prefill?.role || "erp");
  const [f, setF] = useState({ username: prefill?.username || "", password: "" });
  const [fp, setFp] = useState({ username: "", proof: "" });   // forgot: verify step
  const [np, setNp] = useState({ password: "", confirm: "" }); // forgot: new password step
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState(prefill ? "Account created. Please sign in to continue." : "");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = () => { setError(""); setNotice(""); };
  const setLogin = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); clear(); };
  const setForgot = (k) => (e) => { const v = e.target.value; setFp((p) => ({ ...p, [k]: v })); clear(); };
  const setNew = (k) => (e) => { const v = e.target.value; setNp((p) => ({ ...p, [k]: v })); clear(); };

  const openForgot = () => { setFp({ username: f.username, proof: "" }); setShow(false); clear(); setMode("verify"); };
  const backToLogin = () => {
    setF((p) => ({ ...p, username: fp.username || p.username, password: "" }));
    setFp({ username: "", proof: "" }); setNp({ password: "", confirm: "" }); setToken("");
    setShow(false); clear(); setMode("login");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      if (mode === "login") {
        const r = staticLogin({ username: f.username, password: f.password, role });
        if (!r.ok) setError(r.msg);
        else onLogin(r.user);
      } else if (mode === "verify") {
        const r = await verifyResetIdentity({ username: fp.username, role, proof: fp.proof });
        if (!r.ok) setError(r.msg);
        else { setToken(r.token); setShow(false); setMode("reset"); }
      } else {
        const r = await resetPassword({ token, password: np.password, confirm: np.confirm });
        if (!r.ok) {
          setError(r.msg);
          if (r.expired) { setToken(""); setMode("verify"); }
        } else {
          setF({ username: fp.username, password: "" });
          setFp({ username: "", proof: "" }); setNp({ password: "", confirm: "" }); setToken("");
          setShow(false);
          setNotice("Password updated. Please sign in with your new password.");
          setMode("login");
        }
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const eye = (
    <button type="button" className="rg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  const roleSelect = (
    <label className="rg-role-select-wrap" style={{ marginTop: 0 }}>
      <span className="rg-group-label">Choose your role</span>
      <select className="rg-role-select" value={role} onChange={(e) => { setRole(e.target.value); clear(); }} aria-label="Choose your role">
        {Object.entries(ROLES).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
      </select>
    </label>
  );

  const copy = COPY[mode];
  const proof = PROOF[role] || PROOF.client;
  const lead = mode === "verify" ? proof.hint : copy.lead;
  const submitLabel = busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "verify" ? "Verify" : "Update password";

  return (
    <div className="login">
      <AuthHero />

      <main className="rg-panel">
        <div className="rg-bg" aria-hidden="true"><i /><i /><i /></div>

        <div className="rg-wrap">
          <div className="rg-topbar end">
            {mode === "login" ? (
              <span>New here? <button type="button" onClick={onRegister}>Create an account</button></span>
            ) : (
              <span>Remembered it? <button type="button" onClick={backToLogin}>Back to sign in</button></span>
            )}
          </div>

          <div className="rg-card">
            <header className="rg-head">
              <p className="rg-eyebrow"><span /> {copy.eyebrow}</p>
              <h2>{copy.title}</h2>
            </header>

            <form className="rg-body" onSubmit={submit} noValidate>
              <div className="rg-main">
                <div className="rg-step-head">
                  <h3>{copy.step}</h3>
                  <p>{lead}</p>
                </div>

                {/* ---------- SIGN IN ---------- */}
                {mode === "login" && (
                  <div className="rg-step fwd">
                    {roleSelect}
                    <div className="rg-grid" style={{ marginTop: 16 }}>
                      <AuthField wide icon={AtSign} label="Username" value={f.username} onChange={setLogin("username")} autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus={!prefill} />
                      <AuthField wide icon={Lock} label="Password" type={show ? "text" : "password"} value={f.password} onChange={setLogin("password")} autoComplete="current-password" right={eye} autoFocus={!!prefill} />
                    </div>
                  </div>
                )}

                {/* ---------- FORGOT: VERIFY ---------- */}
                {mode === "verify" && (
                  <div className="rg-step fwd">
                    {roleSelect}
                    <div className="rg-grid" style={{ marginTop: 16 }}>
                      <AuthField wide icon={AtSign} label="Username" value={fp.username} onChange={setForgot("username")} autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus />
                      <AuthField wide icon={proof.icon} label={proof.label} type={proof.type} value={fp.proof} onChange={setForgot("proof")} autoComplete="off" autoCapitalize="none" spellCheck="false" />
                    </div>
                  </div>
                )}

                {/* ---------- FORGOT: NEW PASSWORD ---------- */}
                {mode === "reset" && (
                  <div className="rg-step fwd">
                    <div className="rg-grid">
                      <AuthField wide icon={Lock} label="New password" type={show ? "text" : "password"} value={np.password} onChange={setNew("password")} autoComplete="new-password" right={eye} autoFocus />
                      <AuthField wide icon={Lock} label="Confirm new password" type={show ? "text" : "password"} value={np.confirm} onChange={setNew("confirm")} autoComplete="new-password" />
                    </div>
                  </div>
                )}

                {notice && !error && <div className="rg-success" role="status"><Check size={16} strokeWidth={3} /> {notice}</div>}
                {error && <div className="rg-banner" role="alert"><TriangleAlert size={16} /> {error}</div>}

                <div className="rg-actions">
                  {mode === "login" ? (
                    <div className="rg-actions-left">
                      <label className="rg-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
                      <button type="button" className="rg-forgot" onClick={openForgot}>
                        <i className="rg-forgot-ico"><KeyRound size={14} /></i>
                        <span>Forgot password?</span>
                        <ArrowRight size={14} className="rg-forgot-arrow" />
                      </button>
                    </div>
                  ) : (
                    <div className="rg-actions-left">
                      <button type="button" className="rg-link" onClick={backToLogin}><ArrowLeft size={15} /> Back to sign in</button>
                    </div>
                  )}

                  <button type="submit" className="rg-btn" disabled={busy}>
                    <span>{submitLabel}</span>
                    <i><ArrowRight size={16} /></i>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}