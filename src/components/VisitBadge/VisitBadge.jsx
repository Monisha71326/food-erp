/* ONSITE / OFFSITE badge.
   Client portal orders and old orders have no visitType, so they show "-". */
export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${Number(km).toFixed(1)} km`);

export default function VisitBadge({ order }) {
  const t = String(order?.visitType || "").toLowerCase();
  if (!t) return <span className="muted">-</span>;

  const on = t === "onsite";
  const dist = order.visitDistanceKm != null ? ` - ${fmtKm(order.visitDistanceKm)} from the store` : "";

  return (
    <span
      title={on ? "Placed at the store" : `Placed away from the store${dist}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 999, whiteSpace: "nowrap",
        fontSize: 11.5, fontWeight: 800,
        color: on ? "#15803d" : "#b45309",
        background: on ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
      }}
    >
      <i className={`fa-solid ${on ? "fa-location-crosshairs" : "fa-location-pin-lock"}`} aria-hidden="true" />
      {on ? "ONSITE" : "OFFSITE"}
    </span>
  );
}