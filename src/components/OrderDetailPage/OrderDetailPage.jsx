import { useEffect, useState } from "react";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, product, orderTotal, gbp } from "@/data/orderHubStore.js";
import "./OrderDetailPage.css";

/*
 * Full order page (read-only). Opens in place of a list when an order id is clicked.
 *   order             : the order object
 *   onBack            : called by the "Back" button
 *   backLabel         : text of the back button
 *   eyebrow           : small heading above the title (e.g. "AREA MANAGER")
 *   showManagerRemark : true  -> client remark + area manager remark
 *                       false -> client remark only (client portal)
 */
const STEPS = [
  { key: "Placed", label: "Order placed", icon: "fa-inbox" },
  { key: "With Delivery Partner", label: "With Delivery Partner", icon: "fa-truck-fast" },
  { key: "Delivered", label: "Delivered & Invoiced", icon: "fa-circle-check" },
];
const stepIndex = (status) =>
  status === "Placed" ? 0 : status === "With Delivery Partner" ? 1 : 2;

const initials = (t) =>
  String(t || "?").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

/* New orders carry clientRemark / managerRemark. Old orders only have one `remark`:
   it belongs to whoever placed the order. */
const isManagerOrder = (o) => /area manager/i.test(o.placedBy || "");
export const clientRemarkOf = (o) =>
  (o.clientRemark !== undefined ? o.clientRemark : !isManagerOrder(o) ? o.remark : "") || "";
export const managerRemarkOf = (o) =>
  (o.managerRemark !== undefined ? o.managerRemark : isManagerOrder(o) ? o.remark : "") || "";

function OrderImg({ code }) {
  const p = product(code);
  const src = p?.image || `/products/${code}.png`;
  const [bad, setBad] = useState(false);
  const label = p?.description || code;
  if (bad) return <span className="od-img od-img-fb"><b>{initials(label)}</b></span>;
  return <img className="od-img" src={src} alt={label} onError={() => setBad(true)} />;
}

export default function OrderDetailPage({
  order, onBack, backLabel = "Back to orders", eyebrow = "ORDER", showManagerRemark = true,
}) {
  const s = useHub();
  const c = client(order.clientId);
  const invoice = s.invoices.find((i) => i.orderId === order.id);
  const units = order.lines.reduce((t, l) => t + l.qty, 0);
  const total = orderTotal(order);
  const active = stepIndex(order.status);
  const partial = order.status === "Partially Delivered";
  const clientRemark = clientRemarkOf(order);
  const managerRemark = managerRemarkOf(order);

  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [order.id]);

  return (
    <div className="page-anim od-page">
      {/* ----- hero ----- */}
      <header className="od-hero">
        <div className="od-hero-left">
          <button type="button" className="od-back" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> {backLabel}
          </button>
          <span className="od-eyebrow"><i className="fa-solid fa-clipboard-list" /> {eyebrow}</span>
          <h1>Order {order.id}</h1>
          <p>
            {c ? <b>{c.name}</b> : "Unknown client"} - placed by {order.placedBy} on {order.date}
          </p>
        </div>
        <div className="od-hero-right">
          <HubStatus status={order.status} />
        </div>
      </header>

      {/* ----- stat cards ----- */}
      <div className="od-stats">
        <div className="od-stat t-blue"><i className="fa-solid fa-boxes-stacked" /><span>Products</span><b>{order.lines.length}</b></div>
        <div className="od-stat t-purple"><i className="fa-solid fa-cubes" /><span>Total units</span><b>{units}</b></div>
        <div className="od-stat t-orange"><i className="fa-solid fa-tag" /><span>Promo</span><b>{order.promoCode || "None"}</b></div>
        <div className="od-stat t-green"><i className="fa-solid fa-sterling-sign" /><span>Order total</span><b>{gbp(total)}</b></div>
      </div>

      {/* ----- status timeline ----- */}
      <section className="od-card">
        <h4><i className="fa-solid fa-route" /> Order progress</h4>
        <ol className="od-steps">
          {STEPS.map((st, i) => {
            const done = i < active || (i === active && i === 2 && !partial);
            const now = i === active && !done;
            return (
              <li key={st.key} className={`${done ? "done" : ""}${now ? " now" : ""}${partial && i === 2 ? " warn" : ""}`}>
                <span className="od-dot"><i className={`fa-solid ${partial && i === 2 ? "fa-box-open" : st.icon}`} /></span>
                <b>{partial && i === 2 ? "Partially delivered" : st.label}</b>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="od-grid">
        {/* ----- left: details + remarks ----- */}
        <div className="od-col">
          <section className="od-card">
            <h4><i className="fa-solid fa-circle-info" /> Order details</h4>
            <dl className="od-meta">
              <div><dt>Order</dt><dd className="mono">{order.id}</dd></div>
              <div><dt>Client</dt><dd>{c?.name || "-"}</dd></div>
              <div><dt>Contact</dt><dd>{c?.contact || "-"}</dd></div>
              <div><dt>Placed by</dt><dd>{order.placedBy}</dd></div>
              <div><dt>Date</dt><dd>{order.date}</dd></div>
              <div><dt>Invoice</dt><dd>{invoice ? `${invoice.id} (${invoice.status})` : "Not raised yet"}</dd></div>
            </dl>
          </section>

          <section className="od-card od-remark-card">
            <h4><i className="fa-solid fa-comment-dots" /> Client remark</h4>
            <blockquote className={clientRemark ? "" : "empty"}>
              {clientRemark || "No remark given by the client."}
            </blockquote>
          </section>

          {showManagerRemark && (
            <section className="od-card od-remark-card mgr">
              <h4><i className="fa-solid fa-user-tie" /> Area manager remark</h4>
              <blockquote className={managerRemark ? "" : "empty"}>
                {managerRemark || "No remark given by the area manager."}
              </blockquote>
            </section>
          )}
        </div>

        {/* ----- right: items ----- */}
        <section className="od-card od-items">
          <h4><i className="fa-solid fa-basket-shopping" /> Items ({order.lines.length})</h4>
          <ul>
            {order.lines.map((l) => {
              const p = product(l.code);
              return (
                <li key={l.code}>
                  <OrderImg code={l.code} />
                  <div className="od-item-info">
                    <b>{p?.description || l.code}</b>
                    <small>{l.code}{p?.category ? ` - ${p.category}` : ""}</small>
                  </div>
                  <div className="od-item-qty"><span>Qty</span><b>{l.qty}</b></div>
                  <div className="od-item-price"><span>Price</span><b>{gbp(l.price)}</b></div>
                  <div className="od-item-total">{gbp(l.qty * l.price)}</div>
                </li>
              );
            })}
          </ul>
          <div className="od-total">
            <span>Order total</span>
            <b>{gbp(total)}</b>
          </div>
        </section>
      </div>
    </div>
  );
}