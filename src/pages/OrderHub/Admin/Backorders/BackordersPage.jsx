import { useState } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import ClientOrderModal from "@/components/ClientOrderModal/ClientOrderModal.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubButton } from "@/components/HubUI/HubUI.jsx";
import { useHub, raisePOFromBackorder } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./BackordersPage.css";

export default function BackordersPage() {
  const s = useHub();
  const [selected, setSelected] = useState(null); // clicked backorder row

  const columns = [
    { key: "orderId", label: "Order", sortable: true, render: (r) => <TableLink onClick={() => setSelected(r)}>{r.orderId}</TableLink> },
    { key: "client", label: "Client", sortable: true },
    dateColumn("date", "Date"),
    { key: "code", label: "Item", sortable: true, render: (r) => <span className="hub-mono">{r.code}</span> },
    { key: "description", label: "Description" },
    { key: "qty", label: "Qty Short", align: "right", sortable: true },
    { key: "act", label: "", render: (r) => <HubButton size="sm" variant="ghost" icon="fa-cart-flatbed" onClick={() => raisePOFromBackorder(r.id)}>Raise replenishment PO</HubButton> },
  ];

  const order = selected ? s.orders.find((o) => o.id === selected.orderId) : null;

  return (
    <div className="page-anim backorders-page">
      <PageHeader eyebrow="FULFILMENT & LOGISTICS" title="Backorders" subtitle="Short-shipped lines flagged automatically during POD matching." icon="fa-box-open" />
      <DataTable columns={columns} rows={s.backorders} entity="backorders" searchPlaceholder="Search in Backorders" />

      {/* real order found -> full order popup (portal, centered) */}
      {selected && order && <ClientOrderModal order={order} onClose={() => setSelected(null)} />}

      {/* demo backorder with no real order -> backorder details only */}
      {selected && !order && createPortal(
        <div className="bo-backdrop" onClick={() => setSelected(null)}>
          <div className="bo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bo-head">
              <h3>Backorder #{selected.id}</h3>
              <button className="bo-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="bo-meta">
              <div><span>Order</span><b>{selected.orderId}</b></div>
              <div><span>Client</span><b>{selected.client || "-"}</b></div>
              <div className="full"><span>Date</span><b>{selected.date ? fmtDate(selected.date) : "-"}</b></div>
            </div>

            <div className="bo-lines-wrap">
              <table className="bo-lines">
                <thead>
                  <tr><th>Code</th><th>Item</th><th>Qty short</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{selected.code}</td>
                    <td>{selected.description}</td>
                    <td>{selected.qty}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="bo-note">Full order details are not available for this order.</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}