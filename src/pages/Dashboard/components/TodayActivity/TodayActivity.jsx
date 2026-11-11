import { AlertTriangle, Settings, FileText, Landmark, Box, ShoppingCart, Truck, Users } from "lucide-react";
import CardHeader from "../CardHeader/CardHeader.jsx";
import { activities } from "@/data/dashboardData.js";
import "./TodayActivity.css";

const ICONS = {
  alert: AlertTriangle, cog: Settings, file: FileText, bank: Landmark, box: Box,
  cart: ShoppingCart, truck: Truck, users: Users,
};

export default function TodayActivity({ onNavigate }) {
  return (
    <section className="card activity-card">
      <CardHeader
        title="Area Manager Activity"
        viewAll
        viewAllTo="Audit Log"
        onViewAll={onNavigate ? () => onNavigate("Audit Log") : undefined}
      />
      <ul className="timeline">
        {activities.map((a) => {
          const Icon = ICONS[a.icon] || FileText;
          return (
            <li key={a.time + a.text}>
              <i className="tl-dot" style={{ background: a.color }} />
              <span className="tl-icon" style={{ color: a.color }}><Icon size={22} strokeWidth={1.8} /></span>
              <span className="tl-time">{a.time}</span>
              <span className="tl-text">{a.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}