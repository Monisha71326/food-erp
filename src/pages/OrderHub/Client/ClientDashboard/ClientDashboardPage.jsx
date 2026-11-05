import { useState } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import useInvoiceDateFilter from "@/components/InvoiceDateFilter/InvoiceDateFilter.jsx";
import { useHub, client, clientOrders, clientBalance, orderTotal, product, gbp } from "@/data/orderHubStore.js";
import "./ClientDashboardPage.css";

export default function ClientDashboardPage() {
  const s = useHub();
  const [selected, setSelected] = useState(null);
  const [hidePaid, setHidePaid] = useState(false); // "Exclude paid" checkbox
  const c = client(s.session.clientId);
  const orders = clientOrders(c.id);
  const balance = clientBalance(c.id);
  const openOrders = orders.filter((o) => o.status !== "Delivered & Invoiced").length;
  const offers = s.promotions.filter((p) => c.promoIds.includes(p.id) && p.active).length;

  // ===== payment helpers =====
  // NOTE: partial amount field name unga store-la vera maari irundha (eg: amountPaid) inga mathunga
  const paidAmountOf = (o) => {
    const inv = s.invoices.find((i) => i.orderId === o.id);
    if (!inv) return 0;
    const st = String(inv.status).toLowerCase();
    if (st === "paid") return orderTotal(o);
    if (st.includes("partial")) return Number(inv.paidAmount ?? inv.paid ?? 0);
    return 0;
  };
  const payStatusOf = (o) => {
    const paid = paidAmountOf(o);
    const total = orderTotal(o);
    if (total > 0 && paid >= total) return "Paid";
    if (paid > 0) return "Partially Paid";
    return "Outstanding";
  };
  const payClassOf = (st) => (st === "Paid" ? "paid" : st === "Partially Paid" ? "partial" : "due");
  const isPaidOrder = (o) => payStatusOf(o) === "Paid";
  const totalPaid = orders.reduce((sum, o) => sum + paidAmountOf(o), 0);

  const [dateRows, filterBar] = useInvoiceDateFilter(orders, "date", "orders"); // date / month / year filter
  const pendingCount = dateRows.filter((o) => !isPaidOrder(o)).length;
  const filtered = hidePaid ? dateRows.filter((o) => !isPaidOrder(o)) : dateRows;
  // no filter on -> latest 10 orders (as before); filter on -> every match
  const filtersOn = hidePaid || dateRows.length !== orders.length;
  const tableRows = filtersOn ? filtered : filtered.slice(0, 10);

  const items = [
    { label: "Open Orders", value: openOrders, dec: 0, icon: "fa-bag-shopping", tone: "blue" },
    { label: "Paid Amount", value: totalPaid, dec: 2, money: true, icon: "fa-circle-check", tone: "green" }, // "green" illana "blue" use pannunga
    { label: "Outstanding Balance", value: balance, dec: 2, money: true, icon: "fa-sterling-sign", tone: "orange" },
    { label: "Active Offers", value: offers, dec: 0, icon: "fa-gift", tone: "purple" },
  ];

  const columns = [
    { key: "id", label: "Order", sortable: true, render: (r) => <TableLink onClick={() => setSelected(r)}>{r.id}</TableLink> },
    dateColumn("date", "Date"),
    { key: "items", label: "Items", render: (r) => r.lines.length },
    { key: "total", label: "Total", align: "right", sortable: true, sortValue: orderTotal, render: (r) => gbp(orderTotal(r)) },
    {
      key: "payment",
      label: "Payment",
      sortable: true,
      sortValue: payStatusOf,
      render: (r) => {
        const st = payStatusOf(r);
        return (
          <span className={`cd-pay ${payClassOf(st)}`}>
            {st}
            {st === "Partially Paid" && <em> · {gbp(paidAmountOf(r))}</em>}
          </span>
        );
      },
    },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
  ];

  const invoice = selected ? s.invoices.find((i) => i.orderId === selected.id) : null;
  const selPayStatus = selected ? payStatusOf(selected) : "";

  return (
    <div className="page-anim client-dashboard-page">
      <PageHeader eyebrow="CLIENT PORTAL" title={`Welcome back, ${c.contact.split(" ")[0]}`} subtitle={`${c.name} - account overview`} icon="fa-gauge-high" actions={<ViewingAs kind="client" />} />
      <SummaryStrip items={items} columns={4} />
      {filterBar}
      <DataTable
        columns={columns}
        rows={tableRows}
        entity="orders"
        searchPlaceholder="Search recent orders"
        toolbarExtra={
          <label className={`inv-hide-paid${hidePaid ? " on" : ""}`}>
            <input type="checkbox" checked={hidePaid} onChange={(e) => setHidePaid(e.target.checked)} />
            <span className="inv-hide-paid-box"><i className="fa-solid fa-check" aria-hidden="true" /></span>
            <span className="inv-hide-paid-text">Exclude paid</span>
            <b className="inv-hide-paid-count" title="Pending orders">{pendingCount}</b>
          </label>
        }
      />

      {selected && createPortal(
        <div className="cd-backdrop" onClick={() => setSelected(null)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-head">
              <h3>Order {selected.id}</h3>
              <button className="cd-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="cd-meta">
              <div><span>Date</span><b>{selected.date}</b></div>
              <div><span>Status</span><HubStatus status={selected.status} /></div>
              <div><span>Placed by</span><b>{selected.placedBy}</b></div>
              {selected.promoCode && <div><span>Promo</span><b>{selected.promoCode}</b></div>}
              {invoice && <div><span>Invoice</span><b>{invoice.id}</b></div>}
              <div><span>Payment</span><span className={`cd-pay ${payClassOf(selPayStatus)}`}>{selPayStatus}</span></div>
              <div><span>Paid amount</span><b>{gbp(paidAmountOf(selected))}</b></div>
            </div>

            <div className="cd-lines-wrap">
              <table className="cd-lines">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {selected.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{product(l.code)?.description || l.code}</td>
                      <td>{l.qty}</td>
                      <td>{gbp(l.price)}</td>
                      <td>{gbp(l.qty * l.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cd-total"><span>Order total</span><b>{gbp(orderTotal(selected))}</b></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}