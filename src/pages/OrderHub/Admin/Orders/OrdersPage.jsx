import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus, HubButton } from "@/components/HubUI/HubUI.jsx";
import VisitBadge, { fmtKm } from "@/components/VisitBadge/VisitBadge.jsx";
import { useHub, client, product, orderTotal, sendToEdenFarm, updateClient, invoicePayments, gbp } from "@/data/orderHubStore.js";
import "./OrdersPage.css";

const STEPS = [
  { key: "Placed", label: "Order placed", icon: "fa-inbox" },
  { key: "With Delivery Partner", label: "With Delivery Partner", icon: "fa-truck-fast" },
  { key: "Delivered", label: "Delivered & Invoiced", icon: "fa-circle-check" },
];
const stepIndex = (status) =>
  status === "Placed" ? 0 : status === "With Delivery Partner" ? 1 : 2;

const MAX_ADDRESS = 250;

/* VAT: used only when the invoice record has no VAT of its own.
   Assumes invoice.amount already INCLUDES VAT, so VAT = amount - amount / (1 + rate). */
const VAT_RATE = 20;

/* ---------- client address ----------
   The client's address (falls back to an address saved on the order). */
const baseAddressOf = (o, c) =>
  c?.deliveryAddress || c?.address || o.deliveryAddress || o.address || "";

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
   New orders carry `clientRemark`.
   Old orders only have one `remark`: it belongs to the client unless an area manager placed the order. */
const isManagerOrder = (o) => /area manager/i.test(o.placedBy || "");
const clientRemarkOf = (o) =>
  (o.clientRemark !== undefined ? o.clientRemark : !isManagerOrder(o) ? o.remark : "") || "";

/* ---------- visit type (area manager orders only) ---------- */
const visitTypeOf = (o) => String(o.visitType || "").toLowerCase(); // "onsite" | "offsite" | ""

/* small product picture with fallback tile */
function OrderImg({ code }) {
  const p = product(code);
  const src = p?.image || `/products/${code}.png`;
  const [bad, setBad] = useState(false);
  const label = p?.description || code;
  if (bad) return <span className="od-img od-img-fb"><b>{initials(label)}</b></span>;
  return <img className="od-img" src={src} alt={label} onError={() => setBad(true)} />;
}

/* ---------- editable delivery address (inside Order details card) ---------- */
function AddressEditor({ value, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const start = () => { setDraft(value); setError(""); setEditing(true); };
  const cancel = () => { setError(""); setEditing(false); };
  const save = async () => {
    setSaving(true);
    setError("");
    const r = await onSave(draft.trim()); // saves to the client record (updateClient)
    setSaving(false);
    if (r && r.ok === false) setError(r.msg || "Could not save the address.");
    else setEditing(false);
  };

  const btn = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
    fontSize: 12.5, fontWeight: 700, border: "1px solid #a1122f", background: "transparent", color: "#a1122f",
  };
  const btnPrimary = { ...btn, background: "linear-gradient(90deg, #a1122f, #8a0d28)", color: "#fff", border: "1px solid transparent" };

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--border, #e2e8f0)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: "#64748b" }}>
          <i className="fa-solid fa-location-dot" /> Client address
        </span>
        {canEdit && !editing && (
          <button type="button" style={btn} onClick={start}>
            <i className="fa-solid fa-pen" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            rows={3}
            maxLength={MAX_ADDRESS}
            value={draft}
            autoFocus
            placeholder="Enter client address..."
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Client address"
            style={{
              width: "100%", boxSizing: "border-box", resize: "none", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid #a1122f", background: "transparent", color: "inherit", font: "inherit", fontSize: 14, outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
            <small style={{ color: error ? "#dc2626" : "#94a3b8" }}>{error || `${draft.length}/${MAX_ADDRESS}`}</small>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={btn} onClick={cancel} disabled={saving}>Cancel</button>
              <button type="button" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
                <i className="fa-solid fa-check" /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", color: value ? "inherit" : "#94a3b8", fontStyle: value ? "normal" : "italic" }}>
          {value || "No client address added."}
        </p>
      )}

      {!canEdit && (
        <small style={{ display: "block", marginTop: 8, color: "#94a3b8" }}>
          Address can only be edited before the order is sent to Eden Farm.
        </small>
      )}
    </div>
  );
}

/* ---------- full order page (opens when an order id is clicked) ---------- */
function OrderDetail({ order, onBack }) {
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
  const currentAddress = baseAddressOf(order, c); // live from the client record
  const invPayments = invoice ? invoicePayments(invoice.id) : [];
  const invBalance = invoice ? Number(invoice.amount || 0) - Number(invoice.paid || 0) : 0;
  const visit = visitTypeOf(order);
  /* VAT of the invoice: saved value if present, otherwise worked out from the amount */
  const invVatRate = invoice?.vatRate ?? VAT_RATE;
  const storedVat = invoice ? (invoice.vatAmount ?? invoice.vat ?? invoice.tax) : null;
  const invAmount = Number(invoice?.amount || 0);
  const invVat = !invoice ? 0 : storedVat != null && storedVat !== "" ? Number(storedVat) : invAmount - invAmount / (1 + invVatRate / 100);
  const invVatLabel = storedVat != null && storedVat !== "" && invoice?.vatRate == null ? "VAT" : `VAT (${invVatRate}%)`;

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
        <div className={`od-stat ${visit === "offsite" ? "t-orange" : visit === "onsite" ? "t-green" : "t-blue"}`}>
          <i className={`fa-solid ${visit === "offsite" ? "fa-location-pin-lock" : "fa-location-crosshairs"}`} /><span>Visit type</span>
          <b>{visit ? visit.toUpperCase() : "N/A"}</b>
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
        {/* ----- left: details + remark ----- */}
        <div className="od-col">
          <section className="od-card">
            <h4><i className="fa-solid fa-circle-info" /> Order details</h4>
            <dl className="od-meta">
              <div><dt>Order</dt><dd className="mono">{order.id}</dd></div>
              <div><dt>Client</dt><dd>{c?.name || "-"}</dd></div>
              <div><dt>Contact</dt><dd>{c?.contact || "-"}</dd></div>
              <div><dt>Placed by</dt><dd>{order.placedBy}</dd></div>
              <div><dt>Visit type</dt><dd><VisitBadge order={order} /></dd></div>
              {visit === "offsite" && (
                <div>
                  <dt>Distance from store</dt>
                  <dd>{order.visitDistanceKm != null ? fmtKm(order.visitDistanceKm) : "Location not available"}</dd>
                </div>
              )}
              <div><dt>Date</dt><dd>{order.date}</dd></div>
              <div><dt>Invoice</dt><dd>{invoice ? `${invoice.id} (${invoice.status})` : "Not raised yet"}</dd></div>
            </dl>

            {/* delivery address with Edit option */}
            <AddressEditor
              key={order.id}
              value={currentAddress}
              canEdit
              onSave={(v) => updateClient(order.clientId, { address: v })}
            />
          </section>

          {/* invoice for this order */}
          <section className="od-card">
            <h4>
              <i className="fa-solid fa-file-invoice" /> Invoice
              <span style={{
                marginLeft: 10, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                color: invoice ? "#15803d" : "#b45309", background: invoice ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
              }}>
                {invoice ? "Invoice raised" : "Not raised"}
              </span>
            </h4>
            {invoice ? (
              <>
                <dl className="od-meta">
                  <div><dt>Invoice</dt><dd className="mono">{invoice.id}</dd></div>
                  <div><dt>Status</dt><dd><HubStatus status={invoice.status} /></dd></div>
                  <div><dt>Date</dt><dd>{invoice.date || "-"}</dd></div>
                  <div><dt>Order</dt><dd className="mono">{invoice.orderId || order.id}</dd></div>
                  <div><dt>Subtotal (excl. VAT)</dt><dd>{gbp(invAmount - invVat)}</dd></div>
                  <div><dt>{invVatLabel}</dt><dd>{gbp(invVat)}</dd></div>
                  <div><dt>Total (incl. VAT)</dt><dd style={{ fontWeight: 800 }}>{gbp(invAmount)}</dd></div>
                  <div><dt>Paid</dt><dd>{gbp(invoice.paid || 0)}</dd></div>
                  <div><dt>Balance due</dt><dd style={{ fontWeight: 800, color: invBalance > 0 ? "#dc2626" : "#16a34a" }}>{gbp(invBalance)}</dd></div>
                </dl>
                {invPayments.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border, #e2e8f0)" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: "#64748b" }}>
                      Payments ({invPayments.length})
                    </span>
                    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                      {invPayments.map((p) => (
                        <li key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                          <span>{p.date || "-"} - {p.method || "Payment"}</span>
                          <b>{gbp(p.amount)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", fontStyle: "italic" }}>
                No invoice yet. It is raised after the order is delivered.
              </p>
            )}
          </section>

          {/* client remark */}
          <section className="od-card od-remark-card">
            <h4><i className="fa-solid fa-comment-dots" /> Client remark</h4>
            <blockquote className={clientRemark ? "" : "empty"}>
              {clientRemark || "No remark given by the client."}
            </blockquote>
          </section>
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

export default function OrdersPage() {
  const s = useHub();
  const [selectedId, setSelectedId] = useState(null);
  const rows = [...s.orders].sort((a, b) => b.date.localeCompare(a.date));
  const selected = selectedId ? s.orders.find((o) => o.id === selectedId) : null;

  if (selected) return <OrderDetail order={selected} onBack={() => setSelectedId(null)} />;

  const count = (st) => rows.filter((o) => o.status === st).length;
  const items = [
    { label: "Placed (to send)", value: count("Placed"), dec: 0, icon: "fa-inbox", tone: "blue" },
    { label: "With Delivery Partner", value: count("With Delivery Partner"), dec: 0, icon: "fa-truck-fast", tone: "orange" },
    { label: "Partially Delivered", value: count("Partially Delivered"), dec: 0, icon: "fa-box-open", tone: "purple" },
    { label: "Delivered & Invoiced", value: count("Delivered & Invoiced"), dec: 0, icon: "fa-circle-check", tone: "green" },
  ];
  /* the invoice raised for an order (matched by invoice.orderId) */
  const invoiceOf = (o) => s.invoices.find((i) => i.orderId === o.id);
  const columns = [
    { key: "id", label: "Order", sortable: true, render: (r) => <TableLink onClick={() => setSelectedId(r.id)}>{r.id}</TableLink> },
    { key: "client", label: "Client", sortable: true, sortValue: (r) => client(r.clientId)?.name || "", render: (r) => client(r.clientId)?.name || "-" },
    { key: "placedBy", label: "Placed By", sortable: true },
    { key: "visitType", label: "Visit Type", sortable: true, sortValue: visitTypeOf, render: (r) => <VisitBadge order={r} /> },
    dateColumn("date", "Date"),
    {
      key: "clientRemark", label: "Client Remark", sortable: true, sortValue: clientRemarkOf,
      render: (r) => remarkCell(clientRemarkOf(r)),
    },
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
    {
      key: "invoice", label: "Invoice", sortable: true,
      sortValue: (r) => invoiceOf(r)?.id || "",
      render: (r) => {
        const inv = invoiceOf(r);
        return inv ? (
          <span
            title={`${inv.id} - ${inv.status}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 999, whiteSpace: "nowrap",
              fontSize: 11.5, fontWeight: 800, color: "#15803d", background: "rgba(34,197,94,0.15)",
            }}
          >
            <i className="fa-solid fa-file-invoice" /> {inv.id}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>Not raised</span>
        );
      },
    },
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