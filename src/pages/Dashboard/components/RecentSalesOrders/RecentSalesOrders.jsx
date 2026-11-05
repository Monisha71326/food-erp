import { useState } from "react";
import { createPortal } from "react-dom";
import CardHeader from "../CardHeader/CardHeader.jsx";
import MiniTable from "../MiniTable/MiniTable.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { recentOrders } from "@/data/dashboardData.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./RecentSalesOrders.css";

/* order status -> pill color */
const TONE_BY_STATUS = {
  Confirmed: "green",
  Picking: "blue",
  Dispatched: "purple",
  Pending: "orange",
};

export default function RecentSalesOrders({ onNavigate }) {
  const [selected, setSelected] = useState(null);

  const columns = [
    { label: "Order No.", render: (o) => <TableLink onClick={() => setSelected(o)}>{o.no}</TableLink> },
    { label: "Customer", render: (o) => o.customer },
    { label: "Amount", render: (o) => o.amount },
    { label: "Status", render: (o) => <StatusPill status={o.status} tone={TONE_BY_STATUS[o.status]} wide /> },
  ];

  return (
    <section className="card recent-orders-card">
      <CardHeader
        title="Recent Sales Orders"
        viewAll
        viewAllTo="Orders"
        onViewAll={onNavigate ? () => onNavigate("Orders") : undefined}
      />
      <MiniTable columns={columns} rows={recentOrders} getKey={(o) => o.no} />

      {selected && createPortal(
        <div className="odm-backdrop" onClick={() => setSelected(null)}>
          <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="odm-head">
              <h3>Sales Order {selected.no}</h3>
              <button className="odm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            <div className="odm-meta">
              <div><span>Customer</span><b>{selected.customer}</b></div>
              <div><span>Status</span><StatusPill status={selected.status} tone={TONE_BY_STATUS[selected.status]} wide /></div>
            </div>
            <div className="odm-total"><span>Amount</span><b>{selected.amount}</b></div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}