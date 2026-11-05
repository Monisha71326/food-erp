import { useState } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubCard, Field, HubButton, HubStatus, HubNotice } from "@/components/HubUI/HubUI.jsx";
import { useHub, createPO, product } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./PurchaseOrdersPage.css";

export default function PurchaseOrdersPage() {
  const s = useHub();
  const [supplier, setSupplier] = useState("Eden Farm");
  const [code, setCode] = useState(s.products[0].code);
  const [qty, setQty] = useState("50");
  const [remarks, setRemarks] = useState("");
  const [msg, setMsg] = useState(null);
  const [selected, setSelected] = useState(null);

  const columns = [
    { key: "id", label: "PO", sortable: true, render: (r) => <TableLink onClick={() => setSelected(r)}>{r.id}</TableLink> },
    { key: "supplier", label: "Supplier", sortable: true },
    { key: "lines", label: "Lines", render: (r) => r.lines.map((l) => `${l.code} x${l.qty}`).join(", ") },
    dateColumn("date", "Date"),
    { key: "remarks", label: "Remarks", render: (r) => r.remarks || "-" },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
  ];

  const raise = async () => {
    const n = parseInt(qty || "0", 10);
    if (!n) { setMsg({ ok: false, text: "Enter a quantity." }); return; }
    const r = await createPO({ supplier: supplier.trim() || "Eden Farm", code, qty: n, remarks: remarks.trim() });
    setMsg({ ok: r.ok, text: r.msg });
    if (r.ok) setRemarks("");
  };

  const receipt = selected ? s.goodsReceipts.find((g) => g.poId === selected.id) : null;

  return (
    <div className="page-anim hub-po-page">
      <PageHeader eyebrow="PURCHASING" title="Purchase Orders" subtitle="Replenishment orders to suppliers (also raised from Backorders and Demand Forecasting)." icon="fa-cart-flatbed" />
      <HubCard title="All purchase orders"><DataTable columns={columns} rows={s.purchaseOrders} entity="purchase orders" searchPlaceholder="Search in Purchase Orders" /></HubCard>
      <HubCard title="New purchase order">
        <div className="hub-form">
          <Field label="Supplier"><input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
          <Field label="Item"><select value={code} onChange={(e) => setCode(e.target.value)}>{s.products.map((p) => <option key={p.code} value={p.code}>{p.code} - {p.description}</option>)}</select></Field>
          <Field label="Quantity"><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Remarks"><textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks for this purchase order (optional)" /></Field>
        </div>
        <div className="po-save"><HubButton size="sm" icon="fa-plus" onClick={raise}>Raise PO</HubButton></div>
        <HubNotice tone={msg?.ok ? "green" : "red"}>{msg?.text}</HubNotice>
      </HubCard>

      {selected && createPortal(
        <div className="odm-backdrop po-modal" onClick={() => setSelected(null)}>
          <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="odm-head">
              <h3>Purchase order {selected.id}</h3>
              <button className="odm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <div className="odm-meta">
              <div><span>Supplier</span><b>{selected.supplier}</b></div>
              <div><span>Date</span><b>{fmtDate(selected.date)}</b></div>
              <div><span>Status</span><HubStatus status={selected.status} /></div>
              {receipt && <div><span>Receipt</span><b>{receipt.id}</b></div>}
              <div><span>Remarks</span><b>{selected.remarks || "-"}</b></div>
            </div>

            <div className="odm-lines-wrap">
              <table className="odm-lines">
                <thead>
                  <tr><th>Code</th><th>Item</th><th>Qty</th></tr>
                </thead>
                <tbody>
                  {selected.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.code}</td>
                      <td>{product(l.code)?.description || l.code}</td>
                      <td>{l.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}