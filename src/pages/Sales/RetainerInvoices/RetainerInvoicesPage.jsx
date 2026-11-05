import { useState } from "react";
import { createPortal } from "react-dom";
import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn, textColumn, statusColumn } from "@/components/DataTable/columnHelpers.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import { fmtDate } from "@/utils/format.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./RetainerInvoicesPage.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* data shown on the printed retainer invoice.
   Rows currently have no amount, so amount / balance fall back to 0. */
const buildDocData = (row) => ({
  number: row.number,
  order: row.ref,
  customer: row.customer,
  date: row.date ? fmtDate(row.date) : "-",
  due: "-",
  status: row.status,
  amount: row.amount ?? 0,
  balance: row.balance ?? row.amount ?? 0,
  lines: row.project ? [{ desc: `Retainer: ${row.project}`, total: row.amount ?? 0 }] : undefined,
});

export default function RetainerInvoicesPage() {
  const [selected, setSelected] = useState(null);
  const [printInvoice, printPortal] = usePrintInvoice(money); // used by the row Print icon

  const printRow = (row) => printInvoice(buildDocData(row));

  const columns = [
    dateColumn("date", "Date"),
    { key: "number", label: "Retainer Invoice Number", sortable: true, render: (row) => <TableLink onClick={() => setSelected(row)}>{row.number}</TableLink> },
    textColumn("ref", "Reference#"),
    textColumn("customer", "Customer Name"),
    textColumn("project", "Project/Estimate"),
    statusColumn(),
    {
      key: "__actions",
      label: "Print",
      render: (row) => (
        <button type="button" className="btn-ghost" title="Print retainer invoice" onClick={() => printRow(row)}>
          <i className="fa-solid fa-print" />
        </button>
      ),
    },
  ];

  return (
    <>
      <ListPage
        className="retainer-invoices-page"
        eyebrow="SALES" title="All Retainer Invoices" icon="fa-file-invoice"
        entity="retainer invoices" searchPlaceholder="Search in Retainer Invoices"
        columns={columns}
      />

      {selected && createPortal(
        <div className="odm-backdrop retainer-modal" onClick={() => setSelected(null)}>
          <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="odm-head">
              <h3>Retainer Invoice {selected.number}</h3>
              <button className="odm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="odm-meta">
              <div><span>Customer</span><b>{selected.customer || "-"}</b></div>
              <div><span>Date</span><b>{selected.date ? fmtDate(selected.date) : "-"}</b></div>
              <div><span>Reference</span><b>{selected.ref || "-"}</b></div>
              <div><span>Project / Estimate</span><b>{selected.project || "-"}</b></div>
              <div className="full"><span>Status</span><b>{selected.status || "-"}</b></div>
            </div>

            <div className="ret-actions">
              <button type="button" className="ret-btn ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {printPortal}
    </>
  );
}