import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, HubButton } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, product, orderTotal, sendToEdenFarm, gbp } from "@/data/orderHubStore.js";
import "./OrdersPage.css";

const STEPS = [
  { key: "Placed", label: "Order placed", icon: "fa-inbox" },
  { key: "With Delivery Partner", label: "With Delivery Partner", icon: "fa-truck-fast" },
  { key: "Delivered", label: "Delivered & Invoiced", icon: "fa-circle-check" },
];
const stepIndex = (status) =>
  status === "Placed" ? 0 : status === "With Delivery Partner" ? 1 : 2;

const initials = (t) =>
  String(t || "?").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

/* ---------- gross profit ----------
   Gross profit amount = order total - total cost
   Gross profit %      = gross profit / order total x 100
   Both are shown together in one column, e.g. £120.00 (24.5%)
   Cost per unit is the product's costPrice. If any line has no cost, GP is unknown and shows "--". */
const unitCost = (code) => {
  const c = product(code)?.costPrice;
  return c === undefined || c === null || c === "" || isNaN(Number(c)) ? null : Number(c);
};
const orderProfit = (o) => {
  let cost = 0;
  for (const l of o.lines) {
    const c = unitCost(l.code);
    if (c === null) return null;
    cost += c * l.qty;
  }
  const revenue = orderTotal(o);
  const profit = revenue - cost;
  const pct = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { cost, revenue, profit, pct };
};
const gpColor = (g) => (g && g.profit < 0 ? "#dc2626" : "#16a34a");

/* ---------- remarks ----------
   New orders carry `clientRemark` and `managerRemark`.
   Old orders only have one `remark`: it belongs to whoever placed the order. */
const isManagerOrder = (o) => /area manager/i.test(o.placedBy || "");
const clientRemarkOf = (o) =>
  (o.clientRemark !== undefined ? o.clientRemark : !isManagerOrder(o) ? o.remark : "") || "";
const managerRemarkOf = (o) =>
  (o.managerRemark !== undefined ? o.managerRemark : isManagerOrder(o) ? o.remark : "") || "";

/* small product picture with fallback tile */
function OrderImg({ code }) {
  const p = product(code);
  const src = p?.image || `/products/${code}.png`;
  const [bad, setBad] = useState(false);
  const label = p?.description || code;
  if (bad) return <span className="od-img od-img-fb"><b>{initials(label)}</b></span>;
  return <img className="od-img" src={src} alt={label} onError={() => setBad(true)} />;
}

/* ---------- full order page (opens when an order id is clicked) ---------- */
function OrderDetail({ order, onBack, showManagerRemark = true }) {
  const s = useHub();
  const [busy, setBusy] = useState(false);
  const c = client(order.clientId);
  const invoice = s.invoices.find((i) => i.orderId === order.id);
  const units = order.lines.reduce((t, l) => t + l.qty, 0);
  const total = orderTotal(order);
  const gp = orderProfit(order);
  const active = stepIndex(order.status);
  const partial = order.status === "Partially Delivered";
  const canSend = order.status === "Placed";
  const clientRemark = clientRemarkOf(order);
  const managerRemark = managerRemarkOf(order);

  const send = async () => {
    setBusy(true);
    await sendToEdenFarm(order.id);
    setBusy(false);
  };

  return (
    <div className="page-anim hub-orders-page od-page">
      {/* ----- hero ----- */}
      <header className="od-hero">
        <div className="od-hero-left">
          <button type="button" className="od-back" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> Back to orders
          </button>
          <span className="od-eyebrow"><i className="fa-solid fa-clipboard-list" /> FULFILMENT &amp; LOGISTICS</span>
          <h1>Order {order.id}</h1>
          <p>
            {c ? <b>{c.name}</b> : "Unknown client"} - placed by {order.placedBy} on {order.date}
          </p>
        </div>
        <div className="od-hero-right">
          <HubStatus status={order.status} />
          {canSend && (
            <button type="button" className="od-send" onClick={send} disabled={busy}>
              <i className="fa-solid fa-paper-plane" /> {busy ? "Sending..." : "Send to Eden Farm"}
            </button>
          )}
        </div>
      </header>

      {/* ----- stat cards ----- */}
      <div className="od-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="od-stat t-blue"><i className="fa-solid fa-boxes-stacked" /><span>Products</span><b>{order.lines.length}</b></div>
        <div className="od-stat t-purple"><i className="fa-solid fa-cubes" /><span>Total units</span><b>{units}</b></div>
        <div className="od-stat t-orange"><i className="fa-solid fa-tag" /><span>Promo</span><b>{order.promoCode || "None"}</b></div>
        <div className="od-stat t-green"><i className="fa-solid fa-sterling-sign" /><span>Order total</span><b>{gbp(total)}</b></div>
        <div className="od-stat t-green">
          <i className="fa-solid fa-coins" /><span>Gross profit</span>
          <b style={{ color: gpColor(gp) }}>
            {gp ? <>{gbp(gp.profit)} <small>({gp.pct.toFixed(1)}%)</small></> : "--"}
          </b>
        </div>
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

          {/* client remark */}
          <section className="od-card od-remark-card">
            <h4><i className="fa-solid fa-comment-dots" /> Client remark</h4>
            <blockquote className={clientRemark ? "" : "empty"}>
              {clientRemark || "No remark given by the client."}
            </blockquote>
          </section>

          {/* area manager remark (hidden for the client portal) */}
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
          <div className="od-total">
            <span>Gross profit</span>
            <b style={{ color: gpColor(gp) }}>
              {gp ? <>{gbp(gp.profit)} <small>({gp.pct.toFixed(1)}%)</small></> : "--"}
            </b>
          </div>
        </section>
      </div>

      {/* ----- bottom action bar ----- */}
      {canSend && (
        <div className="od-action">
          <div>
            <b>Ready to fulfil?</b>
            <small>This order is still waiting to be sent to Eden Farm.</small>
          </div>
          <button type="button" className="od-send big" onClick={send} disabled={busy}>
            <i className="fa-solid fa-paper-plane" /> {busy ? "Sending..." : "Send to Eden Farm"}
          </button>
        </div>
      )}
    </div>
  );
}

/* one remark cell in the table */
const remarkCell = (text) =>
  text ? <span className="od-remark-cell" title={text}>{text}</span> : "-";

/* showManagerRemark: true = back office / area manager view (both remarks)
                      false = client portal view (client remark only) */
export default function OrdersPage({ showManagerRemark = true }) {
  const s = useHub();
  const [selectedId, setSelectedId] = useState(null);
  const rows = [...s.orders].sort((a, b) => b.date.localeCompare(a.date));
  const selected = selectedId ? s.orders.find((o) => o.id === selectedId) : null;

  if (selected) return <OrderDetail order={selected} onBack={() => setSelectedId(null)} showManagerRemark={showManagerRemark} />;

  const count = (st) => rows.filter((o) => o.status === st).length;
  const items = [
    { label: "Placed (to send)", value: count("Placed"), dec: 0, icon: "fa-inbox", tone: "blue" },
    { label: "With Delivery Partner", value: count("With Delivery Partner"), dec: 0, icon: "fa-truck-fast", tone: "orange" },
    { label: "Partially Delivered", value: count("Partially Delivered"), dec: 0, icon: "fa-box-open", tone: "purple" },
    { label: "Delivered & Invoiced", value: count("Delivered & Invoiced"), dec: 0, icon: "fa-circle-check", tone: "green" },
  ];
  const columns = [
    { key: "id", label: "Order", sortable: true, render: (r) => <TableLink onClick={() => setSelectedId(r.id)}>{r.id}</TableLink> },
    { key: "client", label: "Client", sortable: true, sortValue: (r) => client(r.clientId)?.name || "", render: (r) => client(r.clientId)?.name || "-" },
    { key: "placedBy", label: "Placed By", sortable: true },
    dateColumn("date", "Date"),
    {
      key: "clientRemark", label: "Client Remark", sortable: true, sortValue: clientRemarkOf,
      render: (r) => remarkCell(clientRemarkOf(r)),
    },
    ...(showManagerRemark
      ? [{
          key: "managerRemark", label: "Area Manager Remark", sortable: true, sortValue: managerRemarkOf,
          render: (r) => remarkCell(managerRemarkOf(r)),
        }]
      : []),
    { key: "total", label: "Total", align: "right", sortable: true, sortValue: orderTotal, render: (r) => gbp(orderTotal(r)) },
    {
      key: "gp", label: "Gross Profit", align: "right", sortable: true,
      sortValue: (r) => orderProfit(r)?.profit ?? -9999999,
      render: (r) => {
        const g = orderProfit(r);
        return g ? (
          <span style={{ color: gpColor(g), whiteSpace: "nowrap" }}>
            <b>{gbp(g.profit)}</b> <small>({g.pct.toFixed(1)}%)</small>
          </span>
        ) : <span className="muted">--</span>;
      },
    },
    { key: "status", label: "Status", sortable: true, render: (r) => <HubStatus status={r.status} /> },
    { key: "act", label: "", render: (r) => r.status === "Placed" && <HubButton size="sm" variant="ghost" icon="fa-paper-plane" onClick={() => sendToEdenFarm(r.id)}>Send to Eden Farm</HubButton> },
  ];
  return (
    <div className="page-anim hub-orders-page">
      <PageHeader eyebrow="FULFILMENT & LOGISTICS" title="Orders" subtitle="Every order across the client portal and area managers." icon="fa-clipboard-list" />
      <SummaryStrip items={items} columns={4} />
      <DataTable columns={columns} rows={rows} entity="orders" searchPlaceholder="Search in Orders" />
    </div>
  );
}