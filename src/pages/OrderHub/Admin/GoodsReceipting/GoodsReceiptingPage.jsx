import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubCard, HubButton, HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, receiveGoods, product } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "@/components/OrderDetailsModal/OrderDetailsModal.css"; // popup styles (odm-*)
import "./GoodsReceiptingPage.css";

export default function GoodsReceiptingPage() {
  const s = useHub();
  const [selected, setSelected] = useState(null);

  // Esc key-la modal close
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const stats = useMemo(() => {
    const pending = s.purchaseOrders.filter((p) => p.status === "Pending");
    const pendingUnits = pending.reduce((a, p) => a + p.lines.reduce((x, l) => x + l.qty, 0), 0);
    return {
      total: s.purchaseOrders.length,
      pending: pending.length,
      received: s.purchaseOrders.length - pending.length,
      pendingUnits,
      receipts: s.goodsReceipts.length,
    };
  }, [s.purchaseOrders, s.goodsReceipts]);

  const poCols = [
    { key: "id", label: "PO", sortable: true, render: (r) => <TableLink onClick={() => setSelected(r)}>{r.id}</TableLink> },
    { key: "supplier", label: "Supplier", sortable: true },
    {
      key: "lines",
      label: "Lines",
      render: (r) => (
        <div className="grp-chips">
          {r.lines.map((l, i) => (
            <span key={i} className="grp-chip">{l.code} <b>×{l.qty}</b></span>
          ))}
        </div>
      ),
    },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
    {
      key: "act",
      label: "",
      render: (r) =>
        r.status === "Pending" && (
          <HubButton size="sm" variant="ghost" icon="fa-box-archive" onClick={() => receiveGoods(r.id)}>
            Receive goods
          </HubButton>
        ),
    },
  ];

  const grCols = [
    { key: "id", label: "Receipt", sortable: true },
    { key: "poId", label: "PO", sortable: true },
    dateColumn("date", "Date"),
    { key: "status", label: "Status", render: (r) => <HubStatus status={r.status} /> },
  ];

  const receipt = selected ? s.goodsReceipts.find((g) => g.poId === selected.id) : null;
  const isPending = selected?.status === "Pending";
  const totalQty = selected ? selected.lines.reduce((a, l) => a + l.qty, 0) : 0;

  return (
    <div className="page-anim goods-receipting-page">
      <PageHeader
        eyebrow="PURCHASING"
        title="Goods Receipting"
        subtitle="Receiving a PO books the stock into Inventory."
        icon="fa-box-archive"
      />

      {/* Summary cards */}
      <div className="grp-stats">
        <div className="grp-stat grp-stat--warn">
          <i className="fa-solid fa-hourglass-half" />
          <div><span>Pending POs</span><b>{stats.pending}</b></div>
        </div>
        <div className="grp-stat grp-stat--ok">
          <i className="fa-solid fa-circle-check" />
          <div><span>Received POs</span><b>{stats.received}</b></div>
        </div>
        <div className="grp-stat grp-stat--info">
          <i className="fa-solid fa-boxes-stacked" />
          <div><span>Units awaiting</span><b>{stats.pendingUnits}</b></div>
        </div>
        <div className="grp-stat">
          <i className="fa-solid fa-file-invoice" />
          <div><span>Total receipts</span><b>{stats.receipts}</b></div>
        </div>
      </div>

      <HubCard title="Purchase orders">
        <DataTable columns={poCols} rows={s.purchaseOrders} entity="purchase orders" searchPlaceholder="Search purchase orders" />
      </HubCard>
      <HubCard title="Goods receipts">
        <DataTable columns={grCols} rows={s.goodsReceipts} entity="receipts" searchPlaceholder="Search receipts" />
      </HubCard>

      {selected &&
        createPortal(
          <div className="odm-backdrop grp-backdrop" onClick={() => setSelected(null)}>
            <div className="odm-modal grp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="odm-head grp-head">
                <div>
                  <small>Purchase order</small>
                  <h3>{selected.id}</h3>
                </div>
                <button className="odm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
              </div>

              {/* Progress steps */}
              <div className="grp-steps">
                <div className="grp-step grp-step--done"><span>1</span>Ordered</div>
                <div className={`grp-line ${!isPending ? "grp-line--done" : ""}`} />
                <div className={`grp-step ${!isPending ? "grp-step--done" : "grp-step--active"}`}><span>2</span>Received</div>
                <div className={`grp-line ${!isPending ? "grp-line--done" : ""}`} />
                <div className={`grp-step ${!isPending ? "grp-step--done" : ""}`}><span>3</span>In inventory</div>
              </div>

              <div className="odm-meta grp-meta">
                <div><span>Supplier</span><b>{selected.supplier}</b></div>
                <div><span>Date</span><b>{fmtDate(selected.date)}</b></div>
                <div><span>Status</span><HubStatus status={selected.status} /></div>
                {receipt && <div><span>Receipt</span><b>{receipt.id}</b></div>}
              </div>

              <table className="odm-lines grp-lines">
                <thead>
                  <tr><th>Code</th><th>Item</th><th className="grp-num">Qty</th></tr>
                </thead>
                <tbody>
                  {selected.lines.map((l, i) => (
                    <tr key={i}>
                      <td><span className="grp-code">{l.code}</span></td>
                      <td>{product(l.code)?.description || l.code}</td>
                      <td className="grp-num"><b>{l.qty}</b></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2}>Total units</td><td className="grp-num"><b>{totalQty}</b></td></tr>
                </tfoot>
              </table>

              {isPending && (
                <div className="odm-total grp-foot">
                  <span><i className="fa-solid fa-circle-info" /> Not received yet</span>
                  <HubButton
                    size="sm"
                    icon="fa-box-archive"
                    onClick={() => { receiveGoods(selected.id); setSelected(null); }}
                  >
                    Receive goods
                  </HubButton>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}