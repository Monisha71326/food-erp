import { useState } from "react";
import { ArrowRight, AtSign, Check, Eye, EyeOff, Lock, TriangleAlert } from "lucide-react";
import AuthHero from "./AuthHero.jsx";
import AuthField from "./AuthField.jsx";
import "./LoginPage.css";    // shared layout + left hero
import "./RegisterPage.css"; // shared right-side card styles

/* ------------------------------------------------------------------
   STATIC LOGIN - no backend, no authStore. Credentials are hard-coded.
   Change usernames / passwords / ids below as you like.
   ------------------------------------------------------------------ */
const STATIC_USERS = {
  admin:   { id: "ADMIN", name: "Administrator", role: "admin",   username: "admin",   password: "admin123" },
  manager: { id: "AM1",   name: "Area Manager",  role: "manager", username: "manager", password: "manager123" },
  client:  { id: "C1",    name: "Client",        role: "client",  username: "client",  password: "client123" },
};

const ROLE_OPTIONS = [
  { id: "admin",   label: "Admin" },
  { id: "manager", label: "Area Manager" },
  { id: "client",  label: "Client" },
];

export default function StaticLoginPage({ onLogin, onRegister }) {
  const [role, setRole] = useState("admin");
  const [f, setF] = useState({ username: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v }));
    setError("");
  };

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const u = STATIC_USERS[role];
    if (!f.username.trim() || !f.password) return setError("Please enter username and password.");
    if (f.username.trim().toLowerCase() !== u.username || f.password !== u.password) {
      return setError("Wrong username or password for the selected role.");
    }
    setBusy(true);
    const { password, ...user } = u; // never pass the password on
    try {
      if (remember) localStorage.setItem("meg_static_user", JSON.stringify(user));
    } catch { /* ignore */ }
    onLogin(user);
    setBusy(false);
  };

  const eye = (
    <button type="button" className="rg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  const demo = STATIC_USERS[role];

  return (
    <div className="login">
      <AuthHero />

      <main className="rg-panel">
        <div className="rg-bg" aria-hidden="true"><i /><i /><i /></div>

        <div className="rg-wrap">
          {onRegister && (
            <div className="rg-topbar end">
              <span>New here? <button type="button" onClick={onRegister}>Create an account</button></span>
            </div>
          )}

          <div className="rg-card">
            <header className="rg-head">
              <p className="rg-eyebrow"><span /> Welcome back</p>
              <h2>Sign in to continue</h2>
            </header>

            <form className="rg-body" onSubmit={submit} noValidate>
              <div className="rg-main">
                <div className="rg-step-head">
                  <h3>Your account</h3>
                  <p>Choose your role, then sign in.</p>
                </div>

                <div className="rg-step fwd">
                  <label className="rg-role-select-wrap" style={{ marginTop: 0 }}>
                    <span className="rg-group-label">Choose your role</span>
                    <select
                      className="rg-role-select"
                      value={role}
                      onChange={(e) => { setRole(e.target.value); setError(""); }}
                      aria-label="Choose your role"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </label>

                  <div className="rg-grid" style={{ marginTop: 16 }}>
                    <AuthField wide icon={AtSign} label="Username" value={f.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus />
                    <AuthField wide icon={Lock} label="Password" type={show ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete="current-password" right={eye} />
                  </div>
                </div>

                {/* Demo credentials hint - delete this block before going live */}
                <div className="rg-success" role="note" style={{ marginTop: 14 }}>
                  <Check size={16} strokeWidth={3} /> Demo: {demo.username} / {demo.password}
                </div>

                {error && <div className="rg-banner" role="alert"><TriangleAlert size={16} /> {error}</div>}

                <div className="rg-actions">
                  <div className="rg-actions-left">
                    <label className="rg-remember">
                      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                    </label>
                  </div>
                  <button type="submit" className="rg-btn" disabled={busy}>
                    <span>{busy ? "Please wait…" : "Sign in"}</span>
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