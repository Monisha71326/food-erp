import {
  ShoppingCart, FileText, Box, Factory, Users, Landmark, AlertTriangle, CalendarDays, Truck,
  ArrowUp, ArrowDown,
} from "lucide-react";
import Sparkline from "./Sparkline.jsx";
import "./StatCard.css";

const ICONS = {
  cart: ShoppingCart, file: FileText, box: Box, factory: Factory, users: Users,
  bank: Landmark, alert: AlertTriangle, calendar: CalendarDays, truck: Truck,
};

function Change({ value }) {
  if (value === undefined) return null;
  const up = value >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span className={`change ${up ? "up" : "down"}`}>
      <Arrow size={13} strokeWidth={2.4} /> {Math.abs(value)}%
    </span>
  );
}

/* variant="kpi" -> big card with sparkline | variant="mini" -> compact card */
export default function StatCard({ variant = "kpi", icon, tone = "red", label, value, change, sub, color, spark }) {
  const Icon = ICONS[icon];

  if (variant === "kpi") {
    return (
      <article className="card stat kpi">
        <span className={`stat-icon tone-${tone}`}><Icon size={26} strokeWidth={1.7} /></span>
        <div className="stat-body">
          <p className="stat-label">{label}</p>
          <h3 className="stat-value">{value}</h3>
          <div className="stat-foot">
            <Change value={change} />
            <span className="muted">{sub}</span>
          </div>
        </div>
        <div className="stat-spark"><Sparkline data={spark} color={color} /></div>
      </article>
    );
  }

  return (
    <article className="card stat mini">
      <span className="stat-icon tone-red small"><Icon size={24} strokeWidth={1.7} /></span>
      <div className="stat-body">
        <p className="stat-label">{label}</p>
        <h3 className="stat-value">{value}</h3>
        <div className="stat-foot">
          <Change value={change} />
          <span className="muted">{sub}</span>
        </div>
      </div>
    </article>
  );
}
