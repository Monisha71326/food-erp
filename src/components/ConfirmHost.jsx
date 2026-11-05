import { useEffect, useRef, useState } from "react";
import { useConfirm, closeConfirm } from "@/data/confirm.js";

const HOLD_MS = 1200;

const css = `
.cf-back{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;
  background:rgba(15,23,42,.55);backdrop-filter:blur(6px);animation:cf-fade .18s ease-out}
.cf-card{width:min(440px,100%);background:#fff;border-radius:22px;padding:24px;
  box-shadow:0 30px 80px rgba(2,6,23,.35);animation:cf-pop .28s cubic-bezier(.2,1.2,.4,1);font-family:inherit}
.cf-title{margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a}
.cf-sub{margin:0 0 18px;font-size:14px;color:#64748b}

/* route: Order Hub ---- parcel ----> Eden Farm */
.cf-route{position:relative;display:flex;align-items:center;justify-content:space-between;margin:6px 0 18px}
.cf-node{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#334155;z-index:1}
.cf-dot{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;
  background:#f1f5f9;border:2px solid #e2e8f0;transition:all .3s}
.cf-node.done .cf-dot{background:#dcfce7;border-color:#22c55e;transform:scale(1.12)}
.cf-line{position:absolute;left:46px;right:46px;top:23px;height:4px;border-radius:4px;
  background:repeating-linear-gradient(90deg,#cbd5e1 0 8px,transparent 8px 14px)}
.cf-fill{position:absolute;left:46px;top:23px;height:4px;border-radius:4px;background:linear-gradient(90deg,#6366f1,#22c55e)}
.cf-parcel{position:absolute;top:8px;font-size:22px;transform:translateX(-50%);transition:left .05s linear;
  filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
.cf-idle .cf-parcel{animation:cf-bob 1.4s ease-in-out infinite}

/* summary */
.cf-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
.cf-sum div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px}
.cf-sum small{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.cf-sum b{font-size:15px;color:#0f172a}
.cf-note{font-size:12.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:8px 12px;margin-bottom:16px}

/* hold button */
.cf-hold{position:relative;width:100%;height:54px;border:0;border-radius:16px;overflow:hidden;cursor:pointer;
  font-size:15px;font-weight:700;color:#fff;background:#4f46e5;user-select:none;touch-action:none;
  transition:transform .12s}
.cf-hold:active{transform:scale(.985)}
.cf-hold:focus-visible{outline:3px solid #a5b4fc;outline-offset:2px}
.cf-hold-fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#22c55e,#16a34a)}
.cf-hold span{position:relative}
.cf-cancel{width:100%;margin-top:10px;height:44px;border:0;background:transparent;color:#64748b;
  font-size:14px;font-weight:600;border-radius:12px;cursor:pointer}
.cf-cancel:hover{background:#f1f5f9}
.cf-hint{margin:8px 0 0;text-align:center;font-size:12px;color:#94a3b8}

@keyframes cf-fade{from{opacity:0}to{opacity:1}}
@keyframes cf-pop{from{opacity:0;transform:translateY(14px) scale(.94)}to{opacity:1;transform:none}}
@keyframes cf-bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-5px)}}
@keyframes cf-shake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@media (prefers-reduced-motion:reduce){.cf-card,.cf-back,.cf-idle .cf-parcel{animation:none}}
`;

/* Press-and-hold to confirm — prevents accidental sends */
function HoldToSend({ onDone, label }) {
  const [p, setP] = useState(0); // 0..1
  const raf = useRef(0);
  const start = useRef(0);
  const holding = useRef(false);
  const finished = useRef(false);

  const tick = () => {
    if (!holding.current) return;
    const v = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setP(v);
    if (v >= 1) {
      finished.current = true;
      holding.current = false;
      onDone(1);
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (holding.current || finished.current) return;
    holding.current = true;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const release = () => {
    if (finished.current) return;
    holding.current = false;
    cancelAnimationFrame(raf.current);
    // spring back
    const from = p;
    const t0 = performance.now();
    const back = () => {
      if (holding.current) return;
      const k = Math.min(1, (performance.now() - t0) / 250);
      setP(from * (1 - k));
      if (k < 1) raf.current = requestAnimationFrame(back);
    };
    raf.current = requestAnimationFrame(back);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => { onDone(p); }, [p]); // eslint-disable-line

  return (
    <button
      type="button"
      className="cf-hold"
      onPointerDown={begin}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") release(); }}
      aria-label={`${label} — press and hold to confirm`}
    >
      <div className="cf-hold-fill" style={{ width: `${p * 100}%` }} />
      <span>{p >= 1 ? "Sent ✓" : p > 0 ? "Keep holding…" : label}</span>
    </button>
  );
}

export default function ConfirmHost() {
  const cur = useConfirm();
  const [progress, setProgress] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => { setProgress(0); finishedRef.current = false; }, [cur]);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e) => { if (e.key === "Escape") closeConfirm(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [cur]);

  if (!cur) return null;
  const d = cur.details;

  const onProgress = (v) => {
    setProgress(v);
    if (v >= 1 && !finishedRef.current) {
      finishedRef.current = true;
      setTimeout(() => closeConfirm(true), 450); // let the parcel "arrive" first
    }
  };

  const arrived = progress >= 1;
  const left = `calc(46px + (100% - 92px) * ${progress})`;

  return (
    <div className="cf-back" onMouseDown={(e) => { if (e.target === e.currentTarget) closeConfirm(false); }}>
      <style>{css}</style>
      <div className="cf-card" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
        <h3 id="cf-t" className="cf-title">Send to Eden Farm?</h3>
        <p className="cf-sub">Order <b>{d.orderId}</b>{d.clientName ? <> for <b>{d.clientName}</b></> : null} will go to Eden Farm for fulfilment.</p>

        <div className={`cf-route ${progress === 0 ? "cf-idle" : ""}`}>
          <div className="cf-line" />
          <div className="cf-fill" style={{ width: `calc((100% - 92px) * ${progress})` }} />
          <div className="cf-node"><div className="cf-dot">🏢</div>Order Hub</div>
          <div className="cf-parcel" style={{ left }}>📦</div>
          <div className={`cf-node ${arrived ? "done" : ""}`}><div className="cf-dot">{arrived ? "✅" : "🌾"}</div>Eden Farm</div>
        </div>

        <div className="cf-sum">
          <div><small>Items</small><b>{d.lines}</b></div>
          <div><small>Units</small><b>{d.units}</b></div>
          <div><small>Total</small><b>{d.total}</b></div>
        </div>

        <div className="cf-note">⚠️ Once sent, the order can’t be edited or deleted here.</div>

        <HoldToSend label="Hold to send" onDone={onProgress} />
        <p className="cf-hint">Press &amp; hold the button (or hold Space / Enter)</p>
        <button type="button" className="cf-cancel" onClick={() => closeConfirm(false)}>Cancel</button>
      </div>
    </div>
  );
}