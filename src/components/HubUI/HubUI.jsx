import { useEffect } from "react";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { useHub, setSession } from "@/data/orderHubStore.js";
import "./HubUI.css";

/*
 * Small building blocks shared by every Order Hub page:
 * HubCard, Field, HubButton, HubNotice, HubStatus, HubModal, ViewingAs, LineItemsTable
 */

/* White panel with an optional title row */
export function HubCard({ title, actions, children, className = "" }) {
  return (
    <section className={`card hub-card ${className}`.trim()}>
      {(title || actions) && (
        <div className="hub-card-head">
          <h3>{title}</h3>
          <div className="hub-card-actions">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

/* Label + input wrapper */
export function Field({ label, children, className = "" }) {
  return (
    <label className={`hub-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/* variant: primary (maroon) | ghost | danger ; size: md | sm */
export function HubButton({ variant = "primary", size = "md", icon, children, ...rest }) {
  return (
    <button type="button" className={`hub-btn ${variant} ${size}`} {...rest}>
      {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
      {children}
    </button>
  );
}

/* tone: green | red | gray | blue | orange */
export function HubNotice({ tone = "gray", children }) {
  if (!children) return null;
  return <p className={`hub-notice ${tone}`}>{children}</p>;
}

/* Order Hub status text -> MEG pill color */
const TONE = {
  "Placed": "gray", "With Delivery Partner": "blue", "Partially Delivered": "orange", "Delivered & Invoiced": "green",
  "Outstanding": "orange", "Paid": "green", "Overdue": "red", "Pending": "orange", "Received": "green",
  "Booked in": "green", "Label generated": "green", "Active": "green", "Inactive": "gray",
};
export function HubStatus({ status }) {
  return <StatusPill status={status} tone={TONE[status] || "gray"} />;
}

/* Centered dialog */
export function HubModal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="hub-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card hub-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* "Viewing as" selector for the Client Portal / Area Manager menus (there is no login inside the ERP) */
export function ViewingAs({ kind }) {
  const s = useHub();
  if (s.session.locked) return null; // logged in as a specific client / manager
  const isClient = kind === "client";
  const list = isClient ? s.clients : s.areaManagers;
  const value = isClient ? s.session.clientId : s.session.managerId;
  return (
    <label className="hub-viewing">
      <i className={`fa-solid ${isClient ? "fa-store" : "fa-user-tie"}`} aria-hidden="true" />
      <span>Viewing as</span>
      <select value={value} onChange={(e) => setSession(isClient ? { clientId: e.target.value } : { managerId: e.target.value })}>
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  );
}