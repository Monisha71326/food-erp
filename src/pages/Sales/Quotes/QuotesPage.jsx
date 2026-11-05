import { useState } from "react";
import { createPortal } from "react-dom";
import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { CellIcon, dateColumn, textColumn, amountColumn, statusColumn } from "@/components/DataTable/columnHelpers.jsx";
import { fmtDate } from "@/utils/format.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./QuotesPage.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuotesPage() {
  const [selected, setSelected] = useState(null);

  const columns = [
    dateColumn("date", "Date"),
    {
      key: "number", label: "Estimate Number", sortable: true,
      render: (row) => (
        <>
          <TableLink onClick={() => setSelected(row)}>{row.number}</TableLink>{" "}
          <span style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelected(row); }}>
            <CellIcon name="fa-eye" />
          </span>
        </>
      ),
    },
    textColumn("ref", "Reference Number"),
    textColumn("customer", "Customer Name"),
    statusColumn(),
    amountColumn("amount", "Amount", 2),
    { key: "att", label: "", render: () => <CellIcon name="fa-paperclip" /> },
  ];

  return (
    <>
      <ListPage
        className="quotes-page"
        eyebrow="SALES" title="All Estimates" icon="fa-file-lines"
        entity="estimates" searchPlaceholder="Search in Quotes"
        columns={columns}
      />

      {selected && createPortal(
        <div className="odm-backdrop quotes-modal" onClick={() => setSelected(null)}>
          <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="odm-head">
              <h3>Estimate {selected.number}</h3>
              <button className="odm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="odm-meta">
              <div><span>Customer</span><b>{selected.customer || "-"}</b></div>
              <div><span>Date</span><b>{selected.date ? fmtDate(selected.date) : "-"}</b></div>
              <div><span>Reference</span><b>{selected.ref || "-"}</b></div>
              <div><span>Status</span><b>{selected.status || "-"}</b></div>
            </div>

            <div className="odm-total"><span>Amount</span><b>{money(selected.amount)}</b></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}