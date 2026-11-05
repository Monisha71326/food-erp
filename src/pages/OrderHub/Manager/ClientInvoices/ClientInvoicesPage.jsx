import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import InvoiceDetail from "@/pages/OrderHub/Client/MyInvoices/InvoiceDetail.jsx";
import { dateColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import useInvoiceDateFilter from "@/components/InvoiceDateFilter/InvoiceDateFilter.jsx";
import { buildInvoiceDocData } from "@/pages/OrderHub/invoiceDocData.js";
import { useHub, manager, client } from "@/data/orderHubStore.js";
import "./ClientInvoicesPage.css";

const money = (n) =>
  "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isPaidRow = (r) => String(r.status).toLowerCase() === "paid";

export default function ClientInvoicesPage() {
  const s = useHub();
  const m = manager(s.session.managerId);
  const [selected, setSelected] = useState(null);
  const [hidePaid, setHidePaid] = useState(false); // "Exclude paid" checkbox
  const [printInvoice, printPortal] = usePrintInvoice(money); // hooks stay above early return

  // invoices of every client this area manager covers
  const allRows = (m ? s.invoices.filter((i) => m.clientIds.includes(i.clientId)) : [])
    .map((i) => ({ ...i, clientName: client(i.clientId)?.name || "-" }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const [rows, filterBar] = useInvoiceDateFilter(allRows); // date / month / year filter (hook stays above early return)

  // pending (not paid) invoices count + list shown in the table
  const pendingCount = rows.filter((r) => !isPaidRow(r)).length;
  const visibleRows = hidePaid ? rows.filter((r) => !isPaidRow(r)) : rows;

  const printRow = (r) => {
    const order = s.orders.find((o) => o.id === r.orderId);
    printInvoice(buildInvoiceDocData(r, order));
  };

  // clicking an invoice opens the full invoice page (Record Payment + tickets)
  if (selected) {
    return (
      <div className="page-anim client-invoices-page">
        <InvoiceDetail invoiceId={selected.id} staff eyebrow="AREA MANAGER" backLabel="Back to Client Invoices" onBack={() => setSelected(null)} />
      </div>
    );
  }

  const outstanding = rows.filter((r) => r.status === "Outstanding").reduce((sum, r) => sum + r.amount, 0);
  const paid = rows.filter((r) => r.status === "Paid").reduce((sum, r) => sum + r.amount, 0);

  const items = [
    { label: "Invoices", value: rows.length, dec: 0, icon: "fa-file-invoice", tone: "blue" },
    { label: "Outstanding", value: outstanding, dec: 2, money: true, icon: "fa-scale-unbalanced", tone: "orange" },
    { label: "Paid", value: paid, dec: 2, money: true, icon: "fa-circle-check", tone: "green" },
  ];

  const columns = [
    { key: "id", label: "Invoice#", sortable: true, render: (r) => <TableLink onClick={() => setSelected(r)}>{r.id}</TableLink> },
    { key: "clientName", label: "Client", sortable: true },
    { key: "orderId", label: "Order", sortable: true },
    dateColumn("date", "Date"),
    amountColumn("amount", "Amount (inc. VAT)", 2),
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
    {
      key: "__actions",
      label: "Print",
      render: (r) => (
        <button type="button" className="btn-ghost" title="Print invoice" onClick={() => printRow(r)}>
          <i className="fa-solid fa-print" />
        </button>
      ),
    },
  ];

  return (
    <div className="page-anim client-invoices-page">
      <PageHeader
        eyebrow="AREA MANAGER"
        title="Client Invoices"
        subtitle="Invoices of the clients you cover. Open one to record a payment."
        icon="fa-file-invoice"
        actions={<ViewingAs kind="manager" />}
      />
      <SummaryStrip items={items} columns={3} />
      {filterBar}
      <DataTable
        columns={columns}
        rows={visibleRows}
        entity="invoices"
        searchPlaceholder="Search in Invoices"
        toolbarExtra={
          <label className={`inv-hide-paid${hidePaid ? " on" : ""}`}>
            <input type="checkbox" checked={hidePaid} onChange={(e) => setHidePaid(e.target.checked)} />
            <span className="inv-hide-paid-box"><i className="fa-solid fa-check" aria-hidden="true" /></span>
            <span className="inv-hide-paid-text">Exclude paid</span>
            <b className="inv-hide-paid-count" title="Pending invoices">{pendingCount}</b>
          </label>
        }
      />
      {printPortal}
    </div>
  );
}