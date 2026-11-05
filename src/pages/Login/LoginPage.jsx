import { useState } from "react";
import { ArrowRight, AtSign, Check, Eye, EyeOff, Lock, TriangleAlert } from "lucide-react";
import { ROLES } from "@/data/roleNavigation.js";
import { login } from "@/data/authStore.js";
import AuthHero from "./AuthHero.jsx";
import AuthField from "./AuthField.jsx";
import "./LoginPage.css";    // shared layout + left hero
import "./RegisterPage.css"; // shared right-side card styles (same look as Register)

export default function LoginPage({ onLogin, onRegister, prefill }) {
  const [role, setRole] = useState(prefill?.role || "erp");
  const [f, setF] = useState({ username: prefill?.username || "", password: "" });
  const [notice, setNotice] = useState(!!prefill);
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); setError(""); setNotice(false); };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await login({ username: f.username, password: f.password, role, remember });
      if (!r.ok) setError(r.msg); else onLogin(r.user);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

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
          <div className="rg-topbar end">
            <span>New here? <button type="button" onClick={onRegister}>Create an account</button></span>
          </div>

          <div className="rg-card">
            <header className="rg-head">
              <p className="rg-eyebrow"><span /> Welcome back</p>
              <h2>Sign in to continueee</h2>
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
                    <select className="rg-role-select" value={role} onChange={(e) => { setRole(e.target.value); setError(""); setNotice(false); }} aria-label="Choose your role">
                      {Object.entries(ROLES).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
                    </select>
                  </label>

                  <div className="rg-grid" style={{ marginTop: 16 }}>
                    <AuthField wide icon={AtSign} label="Username" value={f.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus={!prefill} />
                    <AuthField wide icon={Lock} label="Password" type={show ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete="current-password" right={pwToggle} autoFocus={!!prefill} />
                  </div>
                </div>

                {notice && !error && <div className="rg-success" role="status"><Check size={16} strokeWidth={3} /> Account created. Please sign in to continue.</div>}

                {error && <div className="rg-banner" role="alert"><TriangleAlert size={16} /> {error}</div>}

                <div className="rg-actions">
                  <label className="rg-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
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
