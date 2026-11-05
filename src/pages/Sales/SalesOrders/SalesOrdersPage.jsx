import { useState } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn, textColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import { clientRemarkOf, managerRemarkOf } from "@/components/OrderDetailPage/OrderDetailPage.jsx";
import { useHub, client, orderTotal } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./SalesOrdersPage.css";

/*
 * Sales Orders now come from the real Order Hub orders, so the remarks are the ones
 * the client / area manager actually typed when placing the order:
 *   Analysis 1 = Client remark        (order.clientRemark)
 *   Analysis 2 = Area manager remark  (order.managerRemark)
 */
const CLIENT_REMARK = "Analysis 1";   // = client remark
const MANAGER_REMARK = "Analysis 2";  // = area manager remark
const NONE = "__none__";              // filter value for "no remark"

/* dropdown filter: All / (No remark) / every distinct remark */
function RemarkFilter({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Filter by ${label}`}
      style={{
        height: 38, maxWidth: 220, padding: "0 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
        border: "1.5px solid var(--border, #e2e8f0)", background: "var(--card, #fff)", color: "var(--text, #0f172a)", cursor: "pointer",
      }}
    >
      <option value="">{label}: All</option>
      <option value={NONE}>{label}: (No remark)</option>
      {options.map((o) => <option key={o} value={o}>{o.length > 40 ? `${o.slice(0, 40)}...` : o}</option>)}
    </select>
  );
}

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const invoicedText = (v) => (v === "yes" ? "Invoiced" : v === "partial" ? "Partially invoiced" : "Not invoiced");

/* "Invoiced" column: green tick / half circle / empty circle */
function InvoicedIcon({ value }) {
  if (value === "yes") return <i className="fa-solid fa-circle-check ok" title="Invoiced" />;
  if (value === "partial") return <i className="fa-solid fa-circle-half-stroke warn" title="Partially invoiced" />;
  return <i className="fa-regular fa-circle idle" title="Not invoiced" />;
}

/* Popup-la Invoiced value-ku colored badge */
function InvoicedBadge({ value }) {
  const cls = value === "yes" ? "yes" : value === "partial" ? "partial" : "no";
  return <span className={`so-badge ${cls}`}>{invoicedText(value)}</span>;
}

/* remark cell: shortened in the table, full text on hover */
const remarkCell = (text) =>
  text ? <span title={text} style={{ display: "inline-block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{text}</span> : "-";

export default function SalesOrdersPage() {
  const s = useHub();
  const [selectedId, setSelectedId] = useState(null);
  const [f1, setF1] = useState(""); // Analysis 1 filter ("" = All)
  const [f2, setF2] = useState(""); // Analysis 2 filter ("" = All)

  /* Order Hub orders -> sales order rows (newest first) */
  const allRows = [...s.orders]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((o) => {
      const inv = s.invoices.find((i) => i.orderId === o.id);
      return {
        id: o.id,
        number: o.id,
        date: o.date,
        ref: o.promoCode || "",
        customer: client(o.clientId)?.name || "-",
        status: o.status,
        amount: orderTotal(o),
        analysis1: clientRemarkOf(o),
        analysis2: managerRemarkOf(o),
        invoiced: inv ? "yes" : "no",
        placedBy: o.placedBy,
      };
    });
  const selected = selectedId ? allRows.find((r) => r.id === selectedId) : null;

  /* filter options = the remarks that really exist on the orders */
  const distinct = (key) => [...new Set(allRows.map((r) => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const match = (value, f) => !f || (f === NONE ? !value : value === f);
  const rows = allRows.filter((r) => match(r.analysis1, f1) && match(r.analysis2, f2));

  const columns = [
    dateColumn("date", "Date"),
    { key: "number", label: "Sales Order#", sortable: true, render: (row) => <TableLink onClick={() => setSelectedId(row.id)}>{row.number}</TableLink> },
    textColumn("ref", "Promo"),
    textColumn("customer", "Customer Name"),
    { key: "status", label: "Status", sortable: true, render: (row) => <HubStatus status={row.status} /> },
    amountColumn("amount", "Amount"),
    { key: "analysis1", label: CLIENT_REMARK, sortable: true, render: (row) => remarkCell(row.analysis1) },
    { key: "analysis2", label: MANAGER_REMARK, sortable: true, render: (row) => remarkCell(row.analysis2) },
    { key: "invoiced", label: "Invoiced", sortable: true, render: (row) => <InvoicedIcon value={row.invoiced} /> },
  ];

  return (
    <>
      <div className="page-anim sales-orders-page">
        <PageHeader eyebrow="SALES" title="All Sales Orders" subtitle="Orders placed by clients and area managers, with their remarks." icon="fa-clipboard-list" />
        <DataTable
          columns={columns}
          rows={rows}
          entity="sales orders"
          searchPlaceholder="Search in Sales Orders"
          toolbarExtra={
            <>
              <RemarkFilter label={CLIENT_REMARK} value={f1} onChange={setF1} options={distinct("analysis1")} />
              <RemarkFilter label={MANAGER_REMARK} value={f2} onChange={setF2} options={distinct("analysis2")} />
            </>
          }
        />
      </div>

      {selected && createPortal(
        <div className="odm-backdrop sales-modal" onClick={() => setSelectedId(null)}>
          <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="odm-head">
              <h3>Sales Order {selected.number}</h3>
              <button className="odm-close" onClick={() => setSelectedId(null)} aria-label="Close">×</button>
            </div>

            <div className="odm-meta">
              <div><span>Customer</span><b>{selected.customer || "-"}</b></div>
              <div><span>Date</span><b>{selected.date ? fmtDate(selected.date) : "-"}</b></div>
              <div><span>Placed by</span><b>{selected.placedBy || "-"}</b></div>
              <div><span>Status</span><b>{selected.status || "-"}</b></div>
              <div className="full"><span>{CLIENT_REMARK} - Client remark</span><b>{selected.analysis1 || "-"}</b></div>
              <div className="full"><span>{MANAGER_REMARK} - Area manager remark</span><b>{selected.analysis2 || "-"}</b></div>
              <div className="full"><span>Invoiced</span><b><InvoicedBadge value={selected.invoiced} /></b></div>
            </div>

            <div className="odm-total"><span>Amount</span><b>{money(selected.amount)}</b></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}