import { useState } from "react";
import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { textColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, orderTotal, gbp } from "@/data/orderHubStore.js";
import { money } from "@/utils/format.js";
import "./CustomersPage.css";

/* "John Smith Customer" -> "JS" */
const initials = (name) => String(name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* Customer ID shown in the list and on the view page.
   Uses customerId / code if the record has one, otherwise the record id. */
const customerIdOf = (r) => r?.customerId || r?.code || r?.id || "-";

/* How the customer wants their invoices to be shared */
const SHARE_VIA = ["Email", "WhatsApp", "SMS", "Post"];

/* New / Edit Customer form (defined outside the component so the reference stays stable) */
const CUSTOMER_FIELDS = [
  /* Customer ID: type your own (e.g. CUST-0001). Leave empty -> the record id is shown instead */
  { key: "customerId", label: "Customer ID", placeholder: "e.g. CUST-0001" },
  { key: "name", label: "Contact / Customer Name", required: true },
  { key: "company", label: "Company Name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Work Phone" },
  { key: "address", label: "Address" },
  { key: "pincode", label: "Pincode" },
  /* invoice sharing: how + where to send the invoice */
  { key: "shareVia", label: "Share invoices via", type: "select", options: SHARE_VIA, allowEmpty: true },
  { key: "shareTo", label: "Send invoices to (email / WhatsApp / mobile no.)" },
  { key: "receivables", label: "Receivables", type: "number", min: "0" },
  { key: "credits", label: "Unused Credits", type: "number", min: "0" },
];

/* ---------- helpers for order lines (accepts different field names) ---------- */
const linesOf = (o) => o?.items || o?.lines || o?.products || o?.cart || [];
const lineInfo = (l) => {
  const qty = Number(l.qty ?? l.quantity ?? 0);
  const price = Number(l.price ?? l.unitPrice ?? l.rate ?? 0);
  return {
    name: l.name || l.productName || l.product || l.description || l.productId || l.sku || "-",
    sku: l.sku || l.code || "",
    qty,
    price,
    total: Number(l.total ?? l.amount ?? qty * price),
  };
};

/* the amount of an invoice: its own total, else the total of its order */
const invoiceAmountOf = (i, order) => {
  const direct = i.total ?? i.amount;
  if (direct !== undefined && direct !== null) return Number(direct);
  return order ? orderTotal(order) : null;
};

/* ---------- Order view page ---------- */
function OrderView({ order, customer, invoices, onBack, onOpenInvoice }) {
  const lines = linesOf(order).map(lineInfo);
  const linked = invoices.filter((i) => i.orderId === order.id);

  const info = [
    ["Order no.", order.id],
    ["Order date", order.date],
    ["Placed by", order.placedBy],
    ["Customer", customer.name],
    ["Customer ID", customerIdOf(customer)],
    ["Delivery date", order.deliveryDate || order.deliveryOn],
    ["Delivery address", order.address || order.deliveryAddress || customer.address],
    ["Notes", order.notes || order.note],
  ];

  return (
    <div className="page-anim customers-page cv-page">
      <header className="cv-hero">
        <div className="cv-top">
          <button type="button" className="cv-back" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> Back to {customer.name}
          </button>
          <button type="button" className="cv-back" onClick={() => window.print()}>
            <i className="fa-solid fa-print" /> Print
          </button>
        </div>
        <div className="cv-who">
          <span className="cv-avatar"><i className="fa-solid fa-clipboard-list" /></span>
          <div>
            <span className="cv-eyebrow"><i className="fa-solid fa-clipboard-list" /> SALES &middot; ORDER</span>
            <h1>{order.id}</h1>
            <p>
              <HubStatus status={order.status} /> &middot; {customer.name} &middot; {order.date}
            </p>
          </div>
        </div>
      </header>

      <div className="cv-stats">
        <div className="cv-stat"><span>Items</span><b>{lines.length}</b></div>
        <div className="cv-stat"><span>Invoices</span><b>{linked.length}</b></div>
        <div className="cv-stat"><span>Order total</span><b>{gbp(orderTotal(order))}</b></div>
      </div>

      <section className="cv-card">
        <h4><i className="fa-solid fa-circle-info" /> Order details</h4>
        <dl className="cv-info">
          {info.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v || "-"}</dd></div>
          ))}
        </dl>
      </section>

      <section className="cv-card">
        <h4><i className="fa-solid fa-boxes-stacked" /> Items ({lines.length})</h4>
        {lines.length === 0 ? (
          <p className="cv-empty">No item lines found on this order.</p>
        ) : (
          <div className="cv-scroll">
            <table className="cv-table">
              <thead>
                <tr><th>#</th><th>Product</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Total</th></tr>
              </thead>
              <tbody>
                {lines.map((l, n) => (
                  <tr key={n}>
                    <td>{n + 1}</td>
                    <td>
                      <b>{l.name}</b>
                      {l.sku ? <div className="cv-sub">{l.sku}</div> : null}
                    </td>
                    <td className="r">{l.qty}</td>
                    <td className="r">{gbp(l.price)}</td>
                    <td className="r"><b>{gbp(l.total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="cv-totals">
          <span>Order total</span>
          <b>{gbp(orderTotal(order))}</b>
        </div>
      </section>

      <section className="cv-card">
        <h4><i className="fa-solid fa-file-invoice" /> Invoices for this order ({linked.length})</h4>
        {linked.length === 0 ? (
          <p className="cv-empty">No invoice raised for this order yet.</p>
        ) : (
          <div className="cv-scroll">
            <table className="cv-table">
              <thead>
                <tr><th>Invoice</th><th>Date</th><th>Status</th><th className="r">Amount</th></tr>
              </thead>
              <tbody>
                {linked.map((i) => {
                  const amt = invoiceAmountOf(i, order);
                  return (
                    <tr key={i.id}>
                      <td className="mono"><TableLink onClick={() => onOpenInvoice(i.id)}>{i.id}</TableLink></td>
                      <td>{i.date || i.issueDate || order.date || "-"}</td>
                      <td><HubStatus status={i.status} /></td>
                      <td className="r"><b>{amt === null ? "-" : gbp(amt)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Invoice view page ---------- */
function InvoiceView({ invoice, order, customer, onBack, onOpenOrder }) {
  const amount = invoiceAmountOf(invoice, order);
  const paid = invoice.paid !== undefined && invoice.paid !== null ? Number(invoice.paid) : null;
  const balance = amount !== null && paid !== null ? Math.max(0, amount - paid) : null;
  const lines = linesOf(order).map(lineInfo);

  const info = [
    ["Invoice no.", invoice.id],
    ["Invoice date", invoice.date || invoice.issueDate || order?.date],
    ["Due date", invoice.dueDate],
    ["Order no.", invoice.orderId],
    ["Customer", customer.name],
    ["Customer ID", customerIdOf(customer)],
    ["Invoice via", customer.shareVia],
    ["Sent to", customer.shareTo],
  ];

  return (
    <div className="page-anim customers-page cv-page">
      <header className="cv-hero">
        <div className="cv-top">
          <button type="button" className="cv-back" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> Back to {customer.name}
          </button>
          <button type="button" className="cv-back" onClick={() => window.print()}>
            <i className="fa-solid fa-print" /> Print
          </button>
        </div>
        <div className="cv-who">
          <span className="cv-avatar"><i className="fa-solid fa-file-invoice" /></span>
          <div>
            <span className="cv-eyebrow"><i className="fa-solid fa-file-invoice" /> SALES &middot; INVOICE</span>
            <h1>{invoice.id}</h1>
            <p>
              <HubStatus status={invoice.status} /> &middot; {customer.name}
              {invoice.orderId ? <> &middot; Order {invoice.orderId}</> : null}
            </p>
          </div>
        </div>
      </header>

      <div className="cv-stats">
        <div className="cv-stat"><span>Invoice amount</span><b>{amount === null ? "-" : gbp(amount)}</b></div>
        {paid !== null && <div className="cv-stat"><span>Paid</span><b>{gbp(paid)}</b></div>}
        {balance !== null && <div className="cv-stat"><span>Balance</span><b>{gbp(balance)}</b></div>}
      </div>

      <section className="cv-card">
        <h4><i className="fa-solid fa-circle-info" /> Invoice details</h4>
        <dl className="cv-info">
          {info.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                {k === "Order no." && v && order
                  ? <TableLink onClick={() => onOpenOrder(order.id)}>{v}</TableLink>
                  : (v || "-")}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {order && (
        <section className="cv-card">
          <h4><i className="fa-solid fa-boxes-stacked" /> Items ({lines.length})</h4>
          {lines.length === 0 ? (
            <p className="cv-empty">No item lines found.</p>
          ) : (
            <div className="cv-scroll">
              <table className="cv-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Total</th></tr>
                </thead>
                <tbody>
                  {lines.map((l, n) => (
                    <tr key={n}>
                      <td>{n + 1}</td>
                      <td>
                        <b>{l.name}</b>
                        {l.sku ? <div className="cv-sub">{l.sku}</div> : null}
                      </td>
                      <td className="r">{l.qty}</td>
                      <td className="r">{gbp(l.price)}</td>
                      <td className="r"><b>{gbp(l.total)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="cv-totals">
            <span>Invoice total</span>
            <b>{amount === null ? "-" : gbp(amount)}</b>
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- customer view page (opens when a customer name is clicked) ---------- */
function CustomerView({ customer, onBack }) {
  const s = useHub();
  const [detail, setDetail] = useState(null); // { type: "order" | "invoice", id }

  /* orders that belong to this customer (match by client id, or by name / company) */
  const isMine = (o) => {
    const c = client(o.clientId);
    return (
      o.clientId === customer.id ||
      (customer.customerId && o.clientId === customer.customerId) ||
      (c && (c.name === customer.name || (customer.company && c.name === customer.company)))
    );
  };
  const orders = s.orders.filter(isMine).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const orderIds = new Set(orders.map((o) => o.id));
  const invoices = s.invoices.filter((i) => orderIds.has(i.orderId) || i.clientId === customer.id);
  const orderById = (id) => orders.find((o) => o.id === id);

  const ordersValue = orders.reduce((t, o) => t + orderTotal(o), 0);

  /* ---- order / invoice view pages ---- */
  if (detail?.type === "order") {
    const order = orderById(detail.id);
    if (order) {
      return (
        <OrderView
          order={order}
          customer={customer}
          invoices={invoices}
          onBack={() => setDetail(null)}
          onOpenInvoice={(id) => setDetail({ type: "invoice", id })}
        />
      );
    }
  }
  if (detail?.type === "invoice") {
    const invoice = invoices.find((i) => i.id === detail.id);
    if (invoice) {
      return (
        <InvoiceView
          invoice={invoice}
          order={orderById(invoice.orderId)}
          customer={customer}
          onBack={() => setDetail(null)}
          onOpenOrder={(id) => setDetail({ type: "order", id })}
        />
      );
    }
  }

  const info = [
    ["Customer ID", customerIdOf(customer)],
    ["Company", customer.company],
    ["Email", customer.email],
    ["Phone", customer.phone],
    ["Address", customer.address],
    ["Pincode", customer.pincode],
    ["Invoice via", customer.shareVia],
    ["Send invoices to", customer.shareTo],
  ];

  return (
    <div className="page-anim customers-page cv-page">
      <header className="cv-hero">
        <button type="button" className="cv-back" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back to customers
        </button>
        <div className="cv-who">
          <span className="cv-avatar">{initials(customer.name)}</span>
          <div>
            <span className="cv-eyebrow"><i className="fa-solid fa-users" /> SALES &middot; CUSTOMER</span>
            <h1>{customer.name}</h1>
            <p>
              <span className="cv-id">{customerIdOf(customer)}</span>
              {customer.company ? <> &middot; {customer.company}</> : null}
            </p>
          </div>
        </div>
      </header>

      <div className="cv-stats">
        <div className="cv-stat"><span>Orders</span><b>{orders.length}</b></div>
        <div className="cv-stat"><span>Invoices</span><b>{invoices.length}</b></div>
        <div className="cv-stat"><span>Order value</span><b>{gbp(ordersValue)}</b></div>
        <div className="cv-stat"><span>Receivables</span><b>{money(customer.receivables)}</b></div>
      </div>

      <section className="cv-card">
        <h4><i className="fa-solid fa-address-card" /> Customer details</h4>
        <dl className="cv-info">
          {info.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v || "-"}</dd></div>
          ))}
        </dl>
      </section>

      <section className="cv-card">
        <h4><i className="fa-solid fa-clipboard-list" /> Orders ({orders.length})</h4>
        {orders.length === 0 ? (
          <p className="cv-empty">No orders for this customer yet.</p>
        ) : (
          <div className="cv-scroll">
            <table className="cv-table">
              <thead>
                <tr>
                  <th>Order</th><th>Date</th><th>Placed by</th><th>Status</th>
                  <th className="r">Total</th><th className="r">View</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono"><TableLink onClick={() => setDetail({ type: "order", id: o.id })}>{o.id}</TableLink></td>
                    <td>{o.date}</td>
                    <td>{o.placedBy}</td>
                    <td><HubStatus status={o.status} /></td>
                    <td className="r"><b>{gbp(orderTotal(o))}</b></td>
                    <td className="r">
                      <button type="button" className="cv-view" onClick={() => setDetail({ type: "order", id: o.id })}>
                        <i className="fa-solid fa-eye" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cv-card">
        <h4><i className="fa-solid fa-file-invoice" /> Invoices ({invoices.length})</h4>
        {invoices.length === 0 ? (
          <p className="cv-empty">No invoices for this customer yet.</p>
        ) : (
          <div className="cv-scroll">
            <table className="cv-table">
              <thead>
                <tr>
                  <th>Invoice</th><th>Order</th><th>Date</th><th>Status</th>
                  <th className="r">Amount</th><th className="r">View</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const o = orderById(i.orderId);
                  const amt = invoiceAmountOf(i, o);
                  return (
                    <tr key={i.id}>
                      <td className="mono"><TableLink onClick={() => setDetail({ type: "invoice", id: i.id })}>{i.id}</TableLink></td>
                      <td className="mono">
                        {o ? <TableLink onClick={() => setDetail({ type: "order", id: o.id })}>{i.orderId}</TableLink> : (i.orderId || "-")}
                      </td>
                      <td>{i.date || i.issueDate || o?.date || "-"}</td>
                      <td><HubStatus status={i.status} /></td>
                      <td className="r"><b>{amt === null ? "-" : gbp(amt)}</b></td>
                      <td className="r">
                        <button type="button" className="cv-view" onClick={() => setDetail({ type: "invoice", id: i.id })}>
                          <i className="fa-solid fa-eye" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function CustomersPage() {
  const [selected, setSelected] = useState(null); // the customer row being viewed

  if (selected) return <CustomerView customer={selected} onBack={() => setSelected(null)} />;

  const columns = [
    { key: "customerId", label: "Customer ID", sortable: true, sortValue: customerIdOf, render: (row) => <span className="cust-id">{customerIdOf(row)}</span> },
    {
      key: "name", label: "Name", sortable: true,
      render: (row) => (
        <span className="name-cell">
          <span className="mini-avatar">{initials(row.name)}</span>
          <TableLink onClick={() => setSelected(row)}>{row.name}</TableLink>
        </span>
      ),
    },
    textColumn("company", "Company Name"),
    textColumn("email", "Email"),
    textColumn("phone", "Work Phone"),
    textColumn("pincode", "Pincode"),
    textColumn("shareVia", "Invoice via"),
    { ...amountColumn("receivables", "Receivables"), render: (row) => <b>{money(row.receivables)}</b> },
    amountColumn("credits", "Unused Credits"),
  ];

  return (
    <ListPage
      className="customers-page"
      eyebrow="SALES" title="All Customers" icon="fa-users"
      entity="customers" searchPlaceholder="Search in Customers"
      columns={columns}
      formFields={CUSTOMER_FIELDS}
    />
  );
}