import { createPortal } from "react-dom";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, product, orderTotal, gbp } from "@/data/orderHubStore.js";
import "./ClientOrderModal.css";

export default function ClientOrderModal({ order, onClose }) {
  const s = useHub();
  const c = client(order.clientId);
  const invoice = s.invoices.find((i) => i.orderId === order.id);

  return createPortal(
    <div className="com-backdrop" onClick={onClose}>
      <div className="com-modal" onClick={(e) => e.stopPropagation()}>
        <div className="com-head">
          <h3>Order {order.id}</h3>
          <button className="com-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="com-meta">
          <div><span>Client</span><b>{c?.name || "-"}</b></div>
          <div><span>Date</span><b>{order.date}</b></div>
          <div><span>Status</span><HubStatus status={order.status} /></div>
          <div><span>Placed by</span><b>{order.placedBy || "-"}</b></div>
          {order.promoCode && <div><span>Promo</span><b>{order.promoCode}</b></div>}
          {invoice && <div><span>Invoice</span><b>{invoice.id}</b></div>}
        </div>

        <div className="com-lines-wrap">
          <table className="com-lines">
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

        <div className="com-total"><span>Order total</span><b>{gbp(orderTotal(order))}</b></div>
      </div>
    </div>,
    document.body
  );
}