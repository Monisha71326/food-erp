import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./OffsiteConfirm.css";

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

function OffsiteDialog({ clientName, distanceKm, totalText, onDone }) {
  const cancelRef = useRef(null);
  const known = distanceKm != null && !Number.isNaN(distanceKm);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onDone(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onDone]);

  return (
    <div className="oc-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onDone(false); }}>
      <div className="oc-modal" role="alertdialog" aria-modal="true" aria-labelledby="oc-title" aria-describedby="oc-desc">
        <div className="oc-top">
          <span className="oc-icon"><i className="fa-solid fa-location-pin-lock" /></span>
          <h3 id="oc-title">You are not at the store</h3>
          <p id="oc-desc">
            {known
              ? "This order will be saved as OFFSITE because you are away from the client's store."
              : "Your location or the store location is not available, so this order will be saved as OFFSITE."}
          </p>
        </div>

        <div className="oc-info">
          {clientName && (
            <div className="oc-row">
              <span><i className="fa-solid fa-store" /> Client</span>
              <b>{clientName}</b>
            </div>
          )}
          <div className="oc-row">
            <span><i className="fa-solid fa-route" /> Distance from store</span>
            <b className="oc-dist">{known ? fmtKm(distanceKm) : "Location not available"}</b>
          </div>
          {totalText && (
            <div className="oc-row">
              <span><i className="fa-solid fa-sterling-sign" /> Order total</span>
              <b>{totalText}</b>
            </div>
          )}
          <div className="oc-row">
            <span><i className="fa-solid fa-tag" /> Visit type</span>
            <b><em className="oc-badge"><i className="fa-solid fa-location-pin-lock" /> OFFSITE</em></b>
          </div>
        </div>

        <div className="oc-actions">
          <button type="button" ref={cancelRef} className="oc-btn" onClick={() => onDone(false)}>
            <i className="fa-solid fa-arrow-left" /> Go back
          </button>
          <button type="button" className="oc-btn primary" onClick={() => onDone(true)}>
            <i className="fa-solid fa-check" /> Place as OFFSITE
          </button>
        </div>
      </div>
    </div>
  );
}

/* Drop-in replacement for window.confirm. Returns a Promise<boolean>.
   const ok = await confirmOffsite({ clientName: "Tesco", distanceKm: 2.4 }); */
export function confirmOffsite({ clientName, distanceKm, totalText } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (ok) => {
      root.unmount();
      host.remove();
      resolve(ok);
    };
    root.render(<OffsiteDialog clientName={clientName} distanceKm={distanceKm} totalText={totalText} onDone={done} />);
  });
}

export default OffsiteDialog;