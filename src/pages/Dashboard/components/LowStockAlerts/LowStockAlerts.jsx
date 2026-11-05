import { ArrowRight } from "lucide-react";
import MiniTable from "../MiniTable/MiniTable.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { lowStock } from "@/data/dashboardData.js";
import { goTo } from "@/data/orderHubStore.js";
import "./LowStockAlerts.css";

const columns = [
  { label: "Product", render: (r) => r.product },
  { label: "Current", className: "cell-current", render: (r) => r.current },
  { label: "Min. Level", render: (r) => r.min },
  { label: "Status", render: () => <StatusPill status="Low Stock" tone="red" wide /> },
];

/* onNavigate is optional: if the dashboard passes it, it is used; otherwise goTo() sends the "meg:navigate" event */
export default function LowStockAlerts({ onNavigate }) {
  const viewAll = () => (onNavigate ? onNavigate("Stock & Expiry") : goTo("Stock & Expiry"));

  return (
    <section className="card lowstock-card">
      <div className="lsa-head">
        <h3>Low Stock Alerts</h3>
        <button type="button" className="lsa-viewall" onClick={viewAll}>
          View All <ArrowRight size={14} />
        </button>
      </div>
      <MiniTable columns={columns} rows={lowStock} getKey={(r) => r.product} />
    </section>
  );
}