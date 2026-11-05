import logo from "@/assets/logo.webp";

/* Left brand panel shared by Sign in + Register (unchanged design) */
export default function AuthHero() {
  return (
    <aside className="login-hero">
      <img src={logo} alt="Meg World Technologies" className="login-logo" />
      <div className="login-hero-text">
        <p className="login-eyebrow">Meg World Technologies</p>
        <h1>Order Hub</h1>
        <p>One system for client ordering, area manager visits and back-office fulfilment. Sign in with your account to continue.</p>
      </div>
      <div className="bowls" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} className={`bowl bowl-${n}`} style={{ "--n": n }} />)}
      </div>
    </aside>
  );
}
