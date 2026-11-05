import { useState } from "react";
import { createPortal } from "react-dom";
import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import RaiseCreditNote from "@/components/RaiseCreditNote/RaiseCreditNote.jsx";
import { CellIcon, dateColumn, textColumn, amountColumn, statusColumn } from "@/components/DataTable/columnHelpers.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import { fmtDate } from "@/utils/format.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./CreditNotesPage.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* data shown on the printed credit note (uses the invoice template, with its own title) */
const buildDocData = (row) => ({
  title: "CREDIT NOTE",
  number: row.number,
  order: row.ref,
  customer: row.customer,
  date: row.date ? fmtDate(row.date) : "-",
  due: "-",
  status: row.status,
  amount: row.amount ?? 0,
  paid: 0,
  balance: row.amount ?? 0,
  lines: [{ desc: row.invoice ? `Credit note against invoice ${row.invoice}` : `Credit note ${row.number}`, total: row.amount ?? 0 }],
});

export default function CreditNotesPage() {
  const [selected, setSelected] = useState(null);
  const [showRaise, setShowRaise] = useState(false); // "Raise credit note" panel
  const [listKey, setListKey] = useState(0); // changing this reloads the list after a new credit note
  const [printInvoice, printPortal] = usePrintInvoice(money); // one print path for row + popup

  const printRow = (row) => printInvoice(buildDocData(row));

  const columns = [
    dateColumn("date", "Date"),
    {
      key: "number", label: "Credit Note#", sortable: true,
      render: (row) => <><TableLink onClick={() => setSelected(row)}>{row.number}</TableLink> <CellIcon name="fa-envelope" /></>,
    },
    textColumn("ref", "Reference Number"),
    textColumn("customer", "Customer Name"),
    textColumn("invoice", "Invoice#"),
    statusColumn(),
    amountColumn("amount", "Amount", 2),
    {
      key: "__actions",
      label: "Print",
      render: (row) => (
        <button type="button" className="btn-ghost" title="Print credit note" onClick={() => printRow(row)}>
          <i className="fa-solid fa-print" />
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="credit-notes-raise">
        <button type="button" className="cn-btn" onClick={() => setShowRaise((v) => !v)} aria-expanded={showRaise}>
          <i className={`fa-solid ${showRaise ? "fa-chevron-up" : "fa-plus"}`} aria-hidden="true" /> {showRaise ? "Hide form" : "Raise credit note"}
        </button>
        {showRaise && <RaiseCreditNote onRaised={() => setListKey((k) => k + 1)} />}
      </div>

      <ListPage
        key={listKey}
        className="credit-notes-page"
        eyebrow="SALES" title="All Credit Notes" icon="fa-file-circle-minus"
        entity="credit notes" searchPlaceholder="Search in Credit Notes"
        columns={columns}
      />

      {selected && createPortal(
        <div className="odm-backdrop credit-modal" onClick={() => setSelected(null)}>
          <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="odm-head">
              <h3>Credit Note {selected.number}</h3>
              <button className="odm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="odm-meta">
              <div><span>Customer</span><b>{selected.customer || "-"}</b></div>
              <div><span>Date</span><b>{selected.date ? fmtDate(selected.date) : "-"}</b></div>
              <div><span>Reference</span><b>{selected.ref || "-"}</b></div>
              <div><span>Invoice</span><b>{selected.invoice || "-"}</b></div>
              <div className="full"><span>Status</span><b>{selected.status || "-"}</b></div>
            </div>

            <div className="odm-total"><span>Credit Amount</span><b>{money(selected.amount)}</b></div>

            <div className="cn-actions">
              <button type="button" className="cn-btn ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {printPortal}
    </>
  );
}