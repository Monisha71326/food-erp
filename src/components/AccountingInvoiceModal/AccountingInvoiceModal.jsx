import { createPortal } from "react-dom";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import PayInvoice from "@/components/PayInvoice/PayInvoice.jsx";
import { useHub, client, product, gbp } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./AccountingInvoiceModal.css";

export default function AccountingInvoiceModal({ invoice: passed, onClose }) {
  const s = useHub();
  // always use the latest copy from the store so the status updates after payment
  const invoice = s.invoices.find((i) => i.id === passed.id) || passed;
  const c = client(invoice.clientId);
  const order = s.orders.find((o) => o.id === invoice.orderId);

  return createPortal(
    <div className="aim-backdrop" onClick={onClose}>
      <div className="aim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aim-head">
          <h3>Invoice {invoice.id}</h3>
          <button className="aim-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="aim-meta">
          <div><span>Client</span><b>{c?.name || "-"}</b></div>
          <div><span>Order</span><b>{invoice.orderId || "-"}</b></div>
          <div><span>Date</span><b>{invoice.date ? fmtDate(invoice.date) : "-"}</b></div>
          <div><span>Status</span><HubStatus status={invoice.status} /></div>
        </div>

        {order && (
          <div className="aim-lines-wrap">
            <table className="aim-lines">
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
          </div>
        )}

        <div className="aim-totals">
          <div><span>Net</span><b>{gbp(invoice.amount - invoice.vat)}</b></div>
          <div><span>VAT (20%)</span><b>{gbp(invoice.vat)}</b></div>
          <div className="aim-grand"><span>Total</span><b>{gbp(invoice.amount)}</b></div>
        </div>

        <div className="aim-pay">
          <PayInvoice invoice={invoice} label="Record Payment" />
        </div>
      </div>
    </div>,
    document.body
  );
}