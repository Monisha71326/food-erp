import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import OrderDetailPage from "@/components/OrderDetailPage/OrderDetailPage.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import VisitBadge from "@/components/VisitBadge/VisitBadge.jsx";
import useInvoiceDateFilter from "@/components/InvoiceDateFilter/InvoiceDateFilter.jsx";
import { useHub, client, managerOrders, orderTotal, gbp } from "@/data/orderHubStore.js";
import "./ClientOrdersPage.css";

export default function ClientOrdersPage() {
  const s = useHub();
  const [selectedId, setSelectedId] = useState(null); // the order whose full page is open
  const [hidePaid, setHidePaid] = useState(false); // "Exclude paid" checkbox

  const allRows = managerOrders(s.session.managerId);

  // an order is "paid" when its invoice is Paid
  const paidOrderIds = new Set(
    s.invoices.filter((i) => String(i.status).toLowerCase() === "paid").map((i) => i.orderId)
  );
  const isPaidOrder = (o) => paidOrderIds.has(o.id);

  const [rows, filterBar] = useInvoiceDateFilter(allRows, "date", "orders"); // date / month / year filter

  /* clicking an order id opens the full order page (instead of a popup) */
  const selected = selectedId ? s.orders.find((o) => o.id === selectedId) : null;
  if (selected) {
    return (
      <OrderDetailPage
        order={selected}
        onBack={() => setSelectedId(null)}
        backLabel="Back to client orders"
        eyebrow="AREA MANAGER"
      />
    );
  }

  const pendingCount = rows.filter((o) => !isPaidOrder(o)).length;
  const visibleRows = hidePaid ? rows.filter((o) => !isPaidOrder(o)) : rows;

  const columns = [
    { key: "id", label: "Order", sortable: true, render: (r) => <TableLink onClick={() => setSelectedId(r.id)}>{r.id}</TableLink> },
    { key: "client", label: "Client", sortable: true, sortValue: (r) => client(r.clientId)?.name || "", render: (r) => client(r.clientId)?.name || "-" },
    dateColumn("date", "Date"),
    { key: "items", label: "Items", render: (r) => r.lines.length },
    { key: "total", label: "Total", align: "right", sortable: true, sortValue: orderTotal, render: (r) => gbp(orderTotal(r)) },
    { key: "visitType", label: "Visit", sortable: true, sortValue: (r) => String(r.visitType || "").toLowerCase(), render: (r) => <VisitBadge order={r} /> },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
  ];

  return (
    <div className="page-anim client-orders-page">
      <PageHeader eyebrow="AREA MANAGER" title="Client Orders" subtitle="Every order placed by clients you cover." icon="fa-clipboard-list" actions={<ViewingAs kind="manager" />} />
      {filterBar}
      <DataTable
        columns={columns}
        rows={visibleRows}
        entity="orders"
        searchPlaceholder="Search in Client Orders"
        toolbarExtra={
          <label className={`inv-hide-paid${hidePaid ? " on" : ""}`}>
            <input type="checkbox" checked={hidePaid} onChange={(e) => setHidePaid(e.target.checked)} />
            <span className="inv-hide-paid-box"><i className="fa-solid fa-check" aria-hidden="true" /></span>
            <span className="inv-hide-paid-text">Exclude paid</span>
            <b className="inv-hide-paid-count" title="Pending orders">{pendingCount}</b>
          </label>
        }
      />
    </div>
  );
}