import { createPortal } from "react-dom";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, product, gbp } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./InvoiceDetailsModal.css";

/* Popup showing one invoice. Usage: {invoice && <InvoiceDetailsModal invoice={invoice} onClose={() => setInvoice(null)} />} */
export default function InvoiceDetailsModal({ invoice, onClose }) {
  const s = useHub();
  if (!invoice) return null;
  const c = client(invoice.clientId);
  const order = s.orders.find((o) => o.id === invoice.orderId);
  const net = invoice.amount - invoice.vat;

  return createPortal(
    <div className="idm-backdrop" onClick={onClose}>
      <div className="idm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="idm-head">
          <h3>Invoice {invoice.id}</h3>
          <button className="idm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="idm-meta">
          {c && <div><span>Client</span><b>{c.name}</b></div>}
          <div><span>Order</span><b>{invoice.orderId}</b></div>
          <div><span>Date</span><b>{fmtDate(invoice.date)}</b></div>
          <div><span>Status</span><HubStatus status={invoice.status} /></div>
        </div>

        {order && (
          <table className="idm-lines">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td>{product(l.code)?.description || l.code}</td>
                  <td>{l.qty}</td>
                  <td>{gbp(l.price)}</td>
                  <td>{gbp(l.qty * l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {order?.status === "Partially Delivered" && (
          <p className="idm-note">Partial delivery: invoice covers only the delivered quantity.</p>
        )}

        <div className="idm-totals">
          <div><span>Net</span><b>{gbp(net)}</b></div>
          <div><span>VAT (20%)</span><b>{gbp(invoice.vat)}</b></div>
          <div className="idm-grand"><span>Total</span><b>{gbp(invoice.amount)}</b></div>
        </div>
      </div>
    </div>,
    document.body
  );
}