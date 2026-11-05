import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import InvoiceDetail from "@/pages/OrderHub/Client/MyInvoices/InvoiceDetail.jsx";
import { dateColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, HubButton } from "@/components/HubUI/HubUI.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import useInvoiceDateFilter from "@/components/InvoiceDateFilter/InvoiceDateFilter.jsx";
import { buildInvoiceDocData } from "@/pages/OrderHub/invoiceDocData.js";
import { useHub, client, invoiceTickets } from "@/data/orderHubStore.js";
import "./AccountingInvoicesPage.css";

const money = (n) =>
  "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isPaidRow = (r) => String(r.status).toLowerCase() === "paid";

export default function AccountingInvoicesPage() {
  const s = useHub();
  const [openId, setOpenId] = useState(null); // invoice shown on its own page
  const [hidePaid, setHidePaid] = useState(false); // "Exclude paid" checkbox
  const [printInvoice, printPortal] = usePrintInvoice(money); // hooks stay above early return

  const allRows = [...s.invoices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((i) => ({ ...i, ticketCount: invoiceTickets(i.id).length }));
  const [rows, filterBar] = useInvoiceDateFilter(allRows); // date / month / year filter (hook stays above early return)

  // pending (not paid) invoices count + list shown in the table
  const pendingCount = rows.filter((r) => !isPaidRow(r)).length;
  const visibleRows = hidePaid ? rows.filter((r) => !isPaidRow(r)) : rows;

  const printRow = (r) => {
    const order = s.orders.find((o) => o.id === r.orderId);
    printInvoice(buildInvoiceDocData(r, order));
  };

  // clicking an invoice opens the full invoice page (Record Payment + tickets)
  if (openId) {
    return (
      <div className="page-anim accounting-invoices-page">
        <InvoiceDetail invoiceId={openId} staff eyebrow="FINANCE & CREDIT CONTROL" backLabel="Back to Invoices" onBack={() => setOpenId(null)} />
      </div>
    );
  }

  const sum = (st) => rows.filter((i) => i.status === st).reduce((t, i) => t + i.amount, 0);
  const openTickets = (s.tickets || []).filter((t) => t.status === "Open" || t.status === "In Review").length;

  const items = [
    { label: "Outstanding", value: sum("Outstanding"), dec: 2, money: true, icon: "fa-arrow-trend-down", tone: "orange" },
    { label: "Paid", value: sum("Paid"), dec: 2, money: true, icon: "fa-circle-check", tone: "green" },
    { label: "VAT Raised", value: rows.reduce((t, i) => t + i.vat, 0), dec: 2, money: true, icon: "fa-percent", tone: "purple" },
    { label: "Open Tickets", value: openTickets, dec: 0, icon: "fa-ticket", tone: "red" },
  ];
  const columns = [
    { key: "id", label: "Invoice#", sortable: true, render: (r) => <TableLink onClick={() => setOpenId(r.id)}>{r.id}</TableLink> },
    { key: "client", label: "Client", sortable: true, sortValue: (r) => client(r.clientId)?.name || "", render: (r) => client(r.clientId)?.name || "-" },
    { key: "orderId", label: "Order", sortable: true },
    dateColumn("date", "Date"),
    amountColumn("vat", "VAT", 2),
    amountColumn("amount", "Total", 2),
    { key: "ticketCount", label: "Tickets", sortable: true, render: (r) => (r.ticketCount ? r.ticketCount : "-") },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
    {
      key: "__actions",
      label: "Actions",
      render: (r) => (
        <span className="acc-inv-actions">
          {r.status === "Outstanding" && (
            <HubButton size="sm" variant="ghost" icon="fa-money-bill-transfer" onClick={() => setOpenId(r.id)}>Record payment</HubButton>
          )}
          <HubButton size="sm" variant="ghost" icon="fa-print" onClick={() => printRow(r)}>Print</HubButton>
        </span>
      ),
    },
  ];
  return (
    <div className="page-anim accounting-invoices-page">
      <PageHeader eyebrow="FINANCE & CREDIT CONTROL" title="Accounting / Invoices" subtitle="Invoices raised automatically when a POD is matched. Open one to record a payment or handle tickets." icon="fa-file-invoice-dollar" />
      <SummaryStrip items={items} columns={4} />
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