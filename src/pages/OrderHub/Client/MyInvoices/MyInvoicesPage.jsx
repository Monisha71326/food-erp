import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import useInvoiceDateFilter from "@/components/InvoiceDateFilter/InvoiceDateFilter.jsx";
import { useHub, clientInvoices, invoiceTickets } from "@/data/orderHubStore.js";
import { buildInvoiceDocData } from "@/pages/OrderHub/invoiceDocData.js";
import InvoiceDetail from "./InvoiceDetail.jsx";
import "./MyInvoicesPage.css";

const money = (n) => "\u00a3" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isPaidRow = (r) => String(r.status).toLowerCase() === "paid";

export default function MyInvoicesPage() {
  const s = useHub();
  const [openId, setOpenId] = useState(null);
  const [hidePaid, setHidePaid] = useState(false); // "Exclude paid" checkbox
  const [printInvoice, printPortal] = usePrintInvoice(money);

  const allRows = clientInvoices(s.session.clientId).map((i) => {
    const isPaid = isPaidRow(i);
    return {
      ...i,
      ticketCount: invoiceTickets(i.id).length,
      // Paid invoice = 0, otherwise amount minus part payments
      balance: isPaid ? 0 : Math.max(0, round2(Number(i.amount || 0) - Number(i.paid || 0))),
    };
  });
  const [rows, filterBar] = useInvoiceDateFilter(allRows); // date / month / year filter (hook stays above early return)

  // pending (not paid) invoices count + list shown in the table
  const pendingCount = rows.filter((r) => !isPaidRow(r)).length;
  const visibleRows = hidePaid ? rows.filter((r) => !isPaidRow(r)) : rows;

  if (openId) {
    return (
      <div className="page-anim my-invoices-page">
        <InvoiceDetail invoiceId={openId} onBack={() => setOpenId(null)} />
      </div>
    );
  }

  const printRow = (r) => {
    const order = s.orders.find((o) => o.id === r.orderId);
    const isPaid = isPaidRow(r);
    printInvoice({
      ...buildInvoiceDocData(r, order),
      paid: isPaid ? Number(r.amount || 0) : Number(r.paid || 0),
      balance: r.balance, // already computed in allRows
    });
  };

  const columns = [
    { key: "id", label: "Invoice#", sortable: true, render: (r) => <TableLink onClick={() => setOpenId(r.id)}>{r.id}</TableLink> },
    { key: "orderId", label: "Order", sortable: true },
    dateColumn("date", "Date"),
    amountColumn("amount", "Amount (inc. VAT)", 2),
    {
      ...amountColumn("balance", "Balance", 2),
      render: (r) => (
        <span style={{ fontWeight: r.balance > 0 ? 600 : 400, color: r.balance > 0 ? "#b45309" : undefined }}>
          {money(r.balance)}
        </span>
      ),
    },
    { key: "ticketCount", label: "Tickets", sortable: true, render: (r) => (r.ticketCount ? r.ticketCount : "-") },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
    {
      key: "__actions", label: "Print",
      render: (r) => (
        <button type="button" className="btn-ghost" title="Print invoice"
          aria-label={`Print invoice ${r.id}`} onClick={() => printRow(r)}>
          <i className="fa-solid fa-print" />
        </button>
      ),
    },
  ];

  return (
    <div className="page-anim my-invoices-page">
      <PageHeader
        eyebrow="CLIENT PORTAL"
        title="My Invoices"
        subtitle="Invoices appear once an order is delivered and matched. Open one to view details and pay."
        icon="fa-file-invoice"
        actions={<ViewingAs kind="client" />}
      />
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