import "./StatusPill.css";

/* Status text -> pill color. Anything not listed here is gray. */
const TONE_BY_STATUS = {
  draft: "gray", void: "gray", expired: "gray",
  sent: "blue", open: "blue",
  paid: "green", approved: "green", active: "green", invoiced: "green", "partially paid": "green",
  "approval overdue": "orange", "pending approval": "orange", pending: "orange",
  "partially invoiced": "orange", stopped: "orange",
  overdue: "red",
};

/*
 * Props
 *   status : text shown inside the pill
 *   icon   : optional Font Awesome class, e.g. "fa-envelope"
 *   tone   : force a color (red | green | blue | purple | orange | gray); default = looked up from status
 *   wide   : true = fixed minimum width (used in the small dashboard tables)
 */
export default function StatusPill({ status, icon, tone, wide = false }) {
  // Some demo/imported records do not include every status field. Never let a
  // missing value crash the entire page/table.
  const label = String(status ?? "Pending").trim() || "Pending";
  const normalizedStatus = label.toLowerCase();
  const color = tone || TONE_BY_STATUS[normalizedStatus] || "gray";

  return (
    <span className={`pill${wide ? "" : " nowrap"} ${color}`}>
      {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />} {label}
    </span>
  );
}
