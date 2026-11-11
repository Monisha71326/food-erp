import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import ErpFormModal from "@/components/ErpFormModal/ErpFormModal.jsx";
import usePrintInvoice from "@/components/InvoicePrint/usePrintInvoice.jsx";
import { createErpRecord, deleteErpRecord, getErpRecords, updateErpRecord, recordPayment } from "@/data/erpApi.js";
import { approvePayment, rejectPayment, releaseInvoice } from "@/data/paymentApproval.js";
import { currentUser } from "@/data/authStore.js";
import { useHub, client as hubClient, orderTotal, addClient } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import PaymentsView from "./PaymentsView.jsx";
import "./GenericModulePage.css";

const slugify = (value = "") => value.toLowerCase().trim().replace(/&/g, "and").replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (value = "") => value.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
/* "Customer List" -> "Customer", "Bills" -> "Bill", "Currencies" -> "Currency" */
const singularOf = (value = "") => titleCase(value).replace(/\s+list$/i, "").replace(/ies$/i, "y").replace(/([^s])s$/i, "$1");
const COMMON_STATUS = ["Active", "Pending", "Inactive", "Completed", "Cancelled"];
const PAYMENT_STATUS = ["Pending", "Completed", "Approved"];   // Payments page: only these 3
const TODAY_KEYS = ["date", "joinDate", "startDate"];

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* data shown on the printed receipt (uses the invoice print template, with its own title) */
const buildReceiptDoc = (row) => {
  const number = row.reference || row.code || `#${row.id}`;
  const amount = Number(row.amount || 0);
  return {
    title: "RECEIPT",
    number,
    order: row.reference || "-",
    customer: row.customerName || row.owner || row.email || row.name || "-",
    date: row.date ? fmtDate(row.date) : "-",
    due: "-",
    status: row.status || "-",
    amount,
    paid: amount,
    balance: 0,
    lines: [{ desc: row.description || row.name || `Receipt ${number}`, total: amount }],
  };
};

const ICON_RULES = [
  [/customer|client|contact|lead/i, "fa-user-plus"],
  [/employee|staff|user|team|candidate|recruit/i, "fa-id-badge"],
  [/supplier|vendor|contractor/i, "fa-truck-field"],
  [/invoice|bill|payment|credit|receipt/i, "fa-file-invoice-dollar"],
  [/inventory|stock|product|item|warehouse|asset|equipment|package/i, "fa-box"],
  [/project|task|milestone|work.?order|timesheet/i, "fa-diagram-project"],
  [/bank|account|journal|ledger/i, "fa-landmark"],
];
const iconForTitle = (title) => ICON_RULES.find(([re]) => re.test(title))?.[1] || "fa-file-circle-plus";

/* how a customer wants to receive their invoices */
const SHARE_VIA = ["Email", "WhatsApp", "SMS", "Post"];

/* ---------- Customer ID + customer view (invoices & orders) ---------- */
/* next free ID: CUS-0001, CUS-0002 ... (based on the highest existing one, so deletes never cause duplicates) */
const nextCustomerId = (rows) => {
  const max = rows.reduce((m, r) => {
    const n = parseInt(String(r.customerId || "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return "CUS-" + String(max + 1).padStart(4, "0");
};
const norm = (v) => String(v ?? "").trim().toLowerCase();
/* "98765 43210, 91234 56789" -> ["98765 43210", "91234 56789"] (trimmed, blanks removed) */
const splitNumbers = (v) => String(v ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
/* does an invoice / order record belong to this customer? matches by Customer ID, record id, or name */
const belongsTo = (customer, rec) => {
  if (customer.customerId && norm(rec.customerId) === norm(customer.customerId)) return true;
  if (rec.customerRecordId != null && String(rec.customerRecordId) === String(customer.id)) return true;
  /* match by the customer's own name only (company is NOT used, or two contacts of one company would share records) */
  const me = norm(customer.name);
  return !!me && [rec.customerName, rec.customer, rec.client, rec.billTo].map(norm).some(n => n === me);
};
const statusClass = (s) => String(s || "Pending").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const todayKey = () => new Date().toISOString().slice(0, 10);
/* same rule the Invoices page uses to show an invoice's status */
const invoiceStatus = (r) => {
  const st = String(r.status || "").toLowerCase();
  if (st === "paid" || Number(r.balance || 0) <= 0) return "Paid";
  if (r.pendingApproval) return "Pending Approval";
  if (st === "draft") return "Draft";
  if (st === "void") return "Void";
  if (r.due && r.due < todayKey()) return "Overdue";
  return st === "partially paid" ? "Partially Paid" : "Sent";
};

/* kind = "invoices" (Invoice#, Order, Date, Due, Status, Amount, Balance) or "orders" (Order, Placed by, Date, Status, Total) */
function DocTable({ rows, kind, empty }) {
  if (!rows.length) return <div className="gm-view-empty"><i className="fa-regular fa-folder-open" /> {empty}</div>;
  const inv = kind === "invoices";
  return <div className="gm-table-wrap"><table className="gm-table gm-view-table"><thead><tr>
    <th>{inv ? "INVOICE#" : "ORDER"}</th>{inv ? <th>ORDER NO.</th> : <th>PLACED BY</th>}<th>DATE</th>{inv && <th>DUE</th>}<th>STATUS</th>
    <th style={{ textAlign: "right" }}>{inv ? "AMOUNT" : "TOTAL"}</th>{inv && <th style={{ textAlign: "right" }}>BALANCE</th>}
  </tr></thead><tbody>
    {rows.map(r => <tr key={r.id}>
      <td><strong>{r.number}</strong></td>
      <td>{r.extra || "—"}</td>
      <td>{r.date ? fmtDate(r.date) : "—"}</td>
      {inv && <td>{r.due ? fmtDate(r.due) : "—"}</td>}
      <td><span className={`gm-status ${statusClass(r.status)}`}>{r.status || "—"}</span></td>
      <td style={{ textAlign: "right" }}>{money(r.amount)}</td>
      {inv && <td style={{ textAlign: "right" }}>{money(r.balance)}</td>}
    </tr>)}
  </tbody></table></div>;
}

/* read-only customer page: profile + that customer's invoices (ERP records) and orders (Order Hub store) */
function CustomerView({ customer, onClose, onEdit }) {
  const hub = useHub();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("invoices");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getErpRecords("invoices")
      .then(r => { if (alive) setInvoices((Array.isArray(r) ? r : []).filter(x => belongsTo(customer, x))
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .map(x => ({ id: x.id, number: x.number || `#${x.id}`, extra: x.order, date: x.date, due: x.due, status: invoiceStatus(x), amount: Number(x.amount || 0), balance: Number(x.balance || 0) }))); })
      .catch(() => { if (alive) setInvoices([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customer]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* orders come from the Order Hub store: order.clientId -> client name -> match this customer's name / company */
  const me = norm(customer.name);
  const orders = (hub?.orders || [])
    .filter(o => !!me && norm(hubClient(o.clientId)?.name) === me)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map(o => ({ id: o.id, number: o.id, extra: o.placedBy, date: o.date, status: o.status, amount: orderTotal(o) }));

  const billed = invoices.reduce((s, r) => s + r.amount, 0);
  const outstanding = invoices.filter(r => !/paid|void|draft/i.test(r.status)).reduce((s, r) => s + r.balance, 0);
  const details = [
    ["Customer ID", customer.customerId], ["Company", customer.company], ["Email", customer.email], ["Phone", customer.phone],
    ["WhatsApp", splitNumbers(customer.whatsapp).join("  ·  ")], ["Website", customer.website], ["Payment terms", customer.paymentTerms], ["Lead source", customer.source],
    ["Invoices via", customer.shareVia ? `${customer.shareVia}${customer.shareTo ? " · " + customer.shareTo : ""}` : ""],
    ["Address", [customer.address, customer.pincode].filter(Boolean).join(", ")],
  ];

  return <div className="gm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="gm-modal gm-view" role="dialog" aria-modal="true" aria-label="Customer details">
      <div className="gm-view-head">
        <div>
          <span className="gm-eyebrow">MEG ERP · CUSTOMER</span>
          <h2>{customer.name || "Customer"} <span className="gm-view-id">{customer.customerId || `#${customer.id}`}</span></h2>
          <span className={`gm-status ${statusClass(customer.status)}`}>{customer.status || "—"}</span>
        </div>
        <div className="gm-view-head-actions">
          <button type="button" className="gm-btn gm-secondary" onClick={() => onEdit(customer)}><i className="fa-solid fa-pen" /> Edit</button>
          <button type="button" className="gm-view-close" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      <div className="gm-stats gm-view-stats">
        <div className="gm-stat"><span>Invoices</span><strong>{loading ? "…" : invoices.length}</strong><small>Total billed {money(billed)}</small></div>
        <div className="gm-stat"><span>Orders</span><strong>{orders.length}</strong><small>Linked to this customer</small></div>
        <div className="gm-stat"><span>Outstanding</span><strong>{loading ? "…" : money(outstanding)}</strong><small>Unpaid invoices</small></div>
      </div>

      <div className="gm-view-details">
        {details.filter(([, v]) => v).map(([k, v]) => <div key={k} className={k === "Address" ? "wide" : ""}><small>{k}</small><span>{v}</span></div>)}
      </div>
      {customer.notes && <p className="gm-view-notes"><small>Notes</small>{customer.notes}</p>}

      <div className="gm-view-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "invoices"} className={tab === "invoices" ? "on" : ""} onClick={() => setTab("invoices")}>Invoices ({invoices.length})</button>
        <button type="button" role="tab" aria-selected={tab === "orders"} className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")}>Orders ({orders.length})</button>
      </div>
      {tab === "invoices" && loading ? <div className="gm-view-empty">Loading…</div>
        : tab === "invoices" ? <DocTable kind="invoices" rows={invoices} empty="No invoices for this customer yet." />
        : <DocTable kind="orders" rows={orders} empty="No orders for this customer yet." />}
    </div>
  </div>;
}

const MODULE_FIELDS = [
  { match: /employee|staff|user|team|candidate|recruit/i, fields: [
    { key: "name", label: "Full Name", required: true, section: "Personal" }, { key: "employeeId", label: "Employee / Reference ID", section: "Personal" },
    { key: "email", label: "Email", type: "email", section: "Contact" }, { key: "phone", label: "Phone", type: "tel", section: "Contact" },
    { key: "department", label: "Department", section: "Job details" }, { key: "role", label: "Role / Designation", section: "Job details" },
    { key: "joinDate", label: "Joining Date", type: "date", section: "Job details" }, { key: "status", label: "Status", type: "select", options: ["Active", "Pending", "Inactive", "On Leave"], section: "Job details" },
    { key: "notes", label: "Notes", type: "textarea", wide: true, section: "Notes" },
  ]},
  { match: /inventory|stock|product|item|warehouse|asset|equipment/i, fields: [
    { key: "name", label: "Item / Product Name", required: true, section: "Item" }, { key: "code", label: "SKU / Item Code", required: true, section: "Item" },
    { key: "category", label: "Category", section: "Item" }, { key: "supplier", label: "Supplier", section: "Item" },
    { key: "quantity", label: "Quantity", type: "number", min: "0", section: "Stock & price" }, { key: "unitPrice", label: "Unit Price", type: "number", min: "0", section: "Stock & price" },
    { key: "location", label: "Storage Location", section: "Stock & price" }, { key: "status", label: "Status", type: "select", options: ["Active", "Low Stock", "Out of Stock", "Inactive"], section: "Stock & price" },
    { key: "notes", label: "Notes", type: "textarea", wide: true, section: "Notes" },
  ]},
  { match: /supplier|vendor|purchase|procurement/i, fields: [
    { key: "name", label: "Supplier / Vendor Name", required: true, section: "Basic details" }, { key: "reference", label: "Supplier Code / PO Number", section: "Basic details" },
    { key: "contactName", label: "Contact Person", section: "Contact" }, { key: "email", label: "Email", type: "email", section: "Contact" }, { key: "phone", label: "Phone", type: "tel", section: "Contact" },
    { key: "date", label: "Date", type: "date", section: "Order" }, { key: "amount", label: "Amount", type: "number", min: "0", section: "Order" },
    { key: "status", label: "Status", type: "select", options: ["Draft", "Pending", "Approved", "Ordered", "Received", "Cancelled"], section: "Order" },
    { key: "address", label: "Address", type: "textarea", wide: true, section: "Address & notes" }, { key: "notes", label: "Notes", type: "textarea", wide: true, section: "Address & notes" },
  ]},
  { match: /invoice|payment|expense|credit|budget|finance|account|payroll/i, fields: [
    { key: "name", label: "Record Title", required: true, section: "Details" }, { key: "reference", label: "Invoice / Transaction Number", required: true, section: "Details" },
    { key: "customerName", label: "Customer / Payee", section: "Details" }, { key: "date", label: "Date", type: "date", section: "Dates" }, { key: "dueDate", label: "Due Date", type: "date", section: "Dates" },
    { key: "amount", label: "Amount", type: "number", min: "0", required: true, section: "Payment" }, { key: "method", label: "Payment Method", type: "select", options: ["Bank Transfer", "Cash", "Card", "UPI", "Cheque", "Other"], section: "Payment" },
    { key: "status", label: "Status", type: "select", options: ["Draft", "Pending", "Paid", "Partially Paid", "Overdue", "Cancelled"], section: "Payment" },
    { key: "notes", label: "Notes", type: "textarea", wide: true, section: "Notes" },
  ]},
  { match: /project|task|milestone|work.?order/i, fields: [
    { key: "name", label: "Name / Project Title", required: true, section: "Basic details" }, { key: "reference", label: "Project / Task ID", section: "Basic details" },
    { key: "owner", label: "Owner / Assignee", section: "Team" }, { key: "department", label: "Department / Team", section: "Team" },
    { key: "startDate", label: "Start Date", type: "date", section: "Schedule" }, { key: "dueDate", label: "Due Date", type: "date", section: "Schedule" },
    { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"], section: "Schedule" },
    { key: "status", label: "Status", type: "select", options: ["Not Started", "Pending", "In Progress", "Completed", "On Hold", "Cancelled"], section: "Schedule" },
    { key: "description", label: "Description", type: "textarea", wide: true, section: "Description" },
  ]},
  { match: /customer|client|contact|lead/i, fields: [
    /* auto-generated (CUS-0001...). readOnly: make sure ErpFormModal passes field.readOnly to the input */
    { key: "customerId", label: "Customer ID", readOnly: true, placeholder: "Auto-generated", section: "Basic details" },
    { key: "name", label: "Contact / Customer Name", required: true, placeholder: "Enter full name", section: "Basic details" }, { key: "company", label: "Company Name", placeholder: "Company / business name", section: "Basic details" },
    { key: "email", label: "Email", type: "email", placeholder: "name@company.com", section: "Contact" }, { key: "phone", label: "Phone", type: "tel", placeholder: "+91...", section: "Contact" },
    /* several numbers: one input per number + "Add number" (type "multi" is handled by ErpFormModal) */
    { key: "whatsapp", label: "WhatsApp Numbers", type: "multi", placeholder: "+91 98765 43210", section: "Contact" },
    { key: "website", label: "Website", type: "url", placeholder: "https://", section: "Contact" },
    { key: "source", label: "Lead Source", placeholder: "Referral, website, event...", section: "Account" },
    { key: "paymentTerms", label: "Payment Terms", type: "select", options: ["Due on receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"], section: "Account" },
    { key: "status", label: "Status", type: "select", options: ["New", "Contacted", "Qualified", "Active", "Inactive", "Lost"], section: "Account" },
    { key: "address", label: "Address", type: "textarea", wide: true, placeholder: "Street, city, state, postal code, country", section: "Address & notes" },
    { key: "pincode", label: "Pincode", placeholder: "e.g. B10 0AA", section: "Address & notes" },
    { key: "notes", label: "Notes", type: "textarea", wide: true, placeholder: "Additional notes", section: "Address & notes" },
    /* invoice sharing: HOW and WHERE this customer wants their invoices */
    { key: "shareVia", label: "Share invoices via", type: "select", options: SHARE_VIA, section: "Invoice sharing" },
    { key: "shareTo", label: "Send invoices to", placeholder: "Email / WhatsApp / mobile number", section: "Invoice sharing" },
  ]},
  { match: /visit|attendance|leave|shift|schedule|booking/i, fields: [
    { key: "name", label: "Title / Person Name", required: true, section: "Details" }, { key: "reference", label: "Reference ID", section: "Details" },
    { key: "date", label: "Date", type: "date", required: true, section: "Schedule" }, { key: "startTime", label: "Start Time", type: "time", section: "Schedule" },
    { key: "endTime", label: "End Time", type: "time", section: "Schedule" }, { key: "assignedTo", label: "Assigned To", section: "Schedule" },
    { key: "status", label: "Status", type: "select", options: ["Scheduled", "Pending", "Approved", "Completed", "Rejected", "Cancelled"], section: "Schedule" },
    { key: "notes", label: "Notes", type: "textarea", wide: true, section: "Notes" },
  ]},
];

function getFields(title) {
  const match = MODULE_FIELDS.find(item => item.match.test(title));
  const base = match?.fields || [
    { key: "name", label: `${singularOf(title)} Name`, required: true },
    { key: "reference", label: "Reference / Record ID" },
    { key: "owner", label: "Owner / Assigned Team" },
    { key: "date", label: "Date", type: "date" },
    { key: "status", label: "Status", type: "select", options: COMMON_STATUS },
    { key: "description", label: "Description", type: "textarea", wide: true },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ];
  /* Payments page: status can only be Pending / Completed / Approved (no Draft, no Active) */
  if (slugify(title) === "payments") {
    return base.map(f => f.key === "status" ? { ...f, options: PAYMENT_STATUS } : f);
  }
  return base;
}

export default function GenericModulePage({ title = "Module" }) {
  const entity = useMemo(() => slugify(title), [title]);
  const fields = useMemo(() => getFields(title), [title]);
  const noun = useMemo(() => singularOf(title), [title]);
  const isReceipts = entity === "receipts";   // per-row Print button shows only on the Receipts page
  const isPayments = entity === "payments";   // Approve / Reject only on Credit & Payments > Payments
  const isCustomers = entity.includes("customer");   // Customer ID + View page (invoices & orders)
  const hub = useHub();
  const [viewing, setViewing] = useState(null);
  /* everyone except Client / Area Manager can approve (tighten this to your ERP Admin role key if needed) */
  const canApprove = !["client", "manager"].includes(currentUser()?.role);
  const [printInvoice, printPortal] = usePrintInvoice(money);
  const printReceipt = (row) => printInvoice(buildReceiptDoc(row));
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await getErpRecords(entity);
      setRows(Array.isArray(result) ? result : []);
    } catch (e) { setError(e.message || `Unable to load ${title}.`); }
    finally { setLoading(false); }
  }, [entity, title]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const filtered = useMemo(() => rows.filter(row =>
    (status === "All" || String(row.status || "") === status) &&
    Object.values(row).some(value => String(value ?? "").toLowerCase().includes(query.toLowerCase()))
  ), [rows, query, status]);

  const defaultValue = (field) => {
    if (field.type === "select") return field.options?.[0] || "";
    if (field.type === "number") return "";   // empty, so the "0.00" placeholder is visible (saved as 0 if left blank)
    if (field.type === "date" && TODAY_KEYS.includes(field.key)) return new Date().toISOString().slice(0, 10);
    return "";
  };
  const openNew = () => {
    setEditing(null);
    const initial = Object.fromEntries(fields.map(field => [field.key, defaultValue(field)]));
    if (isCustomers) initial.customerId = nextCustomerId(rows);
    setForm(initial);
    setError(""); setFormError(""); setNotice(""); setShowForm(true);
  };
  const openEdit = row => {
    setViewing(null);
    setEditing(row);
    const initial = Object.fromEntries(fields.map(field => [field.key, row[field.key] ?? ""]));
    /* older customers saved before IDs existed get one when edited */
    if (isCustomers && !initial.customerId) initial.customerId = nextCustomerId(rows);
    setForm(initial);
    setError(""); setFormError(""); setNotice(""); setShowForm(true);
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setFormError("");
    const data = { ...form };
    if (isCustomers) {
      /* never trust the form value: keep the existing ID, or issue a fresh one */
      data.customerId = editing?.customerId || nextCustomerId(rows);
      /* WhatsApp numbers: trim, remove blank rows and duplicates -> "n1, n2, n3" */
      data.whatsapp = [...new Set(splitNumbers(data.whatsapp))].join(", ");
    }
    fields.filter(field => field.type === "number").forEach(field => { data[field.key] = Number(data[field.key] || 0); });
    try {
      if (editing) await updateErpRecord(entity, editing.id, data);
      else await createErpRecord(entity, data);
      /* make sure this customer also exists as an Order Hub client (so orders can be placed for them) */
      let hubMsg = "";
      if (isCustomers && data.name && !hub.clients.some(c => norm(c.name) === norm(data.name))) {
        try {
          const r = await addClient({
            name: data.name, contact: data.name, email: data.email || "-", phone: data.phone || "",
            pincode: data.pincode || "", creditLimit: 3000, address: data.address || "",
          });
          if (r && r.ok === false) hubMsg = ` (Order Hub client not created: ${r.msg || "rejected"})`;
        } catch (err) { hubMsg = " (Order Hub client could not be created)"; }
      }
      setShowForm(false); setNotice(`${noun} ${editing ? "updated" : "created"} successfully.${hubMsg}`);
      await loadRows();
    } catch (e) { setFormError(e.message || "Save failed. Please try again."); }
    finally { setSaving(false); }
  };
  const remove = async row => {
    const label = row.name || row.reference || row.id;
    if (!window.confirm(`Delete "${label}" from ${title}? This cannot be undone.`)) return;
    setError("");
    try {
      /* a Pending payment is being deleted -> let its invoice take a payment again */
      if (isPayments && row.status === "Pending" && row.invoice) await releaseInvoice(row);
      await deleteErpRecord(entity, row.id); setNotice("Record deleted successfully."); await loadRows();
    }
    catch (e) { setError(e.message || "Delete failed."); }
  };

  /* Payments page: Admin approves / rejects a Pending payment that came from the Invoices page */
  const actor = () => { const u = currentUser(); return u?.name || u?.fullName || u?.username || "Admin"; };

  /* returns null on success, or an error message (the review popup shows it) */
  const decide = async (row, approve, reason = "") => {
    setError("");
    try {
      if (approve) await approvePayment(row, actor()); else await rejectPayment(row, reason, actor());
      setNotice(approve ? `Payment ${row.number} approved. Invoice ${row.invoice} updated.` : `Payment ${row.number} rejected.`);
      await loadRows();
      return null;
    } catch (e) { return e.message || "Action failed."; }
  };

  /* bulk approve (ticked rows on the Payments page) */
  const approveMany = async (list) => {
    setError("");
    let ok = 0, fail = "";
    for (const row of list) {
      try { await approvePayment(row, actor()); ok++; }
      catch (e) { fail = `${row.number || row.id}: ${e.message}`; }
    }
    if (ok) setNotice(`${ok} payment${ok === 1 ? "" : "s"} approved.`);
    if (fail) setError(fail);
    await loadRows();
  };

  /* Payments page > "Add payment": pick customer + invoice, save the payment and reduce that invoice's balance.
     returns null on success, or an error message (the Add payment popup shows it) */
  const createPayment = async (p) => {
    setError("");
    try {
      await recordPayment(p);
      setNotice(`Payment of ${money(p.amount)} recorded. Invoice ${p.invoice} balance updated.`);
      await loadRows();
      return null;
    } catch (e) { return e.message || "Could not save the payment."; }
  };

  const exportCsv = () => {
    const cols = [...new Set(["id", ...fields.map(field => field.key), "updatedAt"])];
    const csv = [cols.join(","), ...filtered.map(row => cols.map(key => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `${entity}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const primaryKey = fields.find(field => ["name", "code", "reference", "employeeId", "customerName"].includes(field.key))?.key || fields[0]?.key;
  const secondaryKey = fields.find(field => ["company", "email", "description", "reference", "department", "owner", "supplier", "customerName"].includes(field.key) && field.key !== primaryKey)?.key;
  const statusOptions = [...new Set(["All", ...rows.map(row => row.status).filter(Boolean)])];

  return <div className="page-anim generic-module">
    <PageHeader
      eyebrow="MEG ERP · WORKSPACE"
      title={title}
      subtitle={`Create, view, update and manage ${title.toLowerCase()} records saved in this browser.`}
      icon={iconForTitle(title)}
      actions={
        <>
          <button type="button" className="gm-btn gm-secondary" onClick={exportCsv} disabled={!filtered.length}>
            <i className="fa-solid fa-download" /> Export CSV
          </button>
          <button type="button" className="gm-btn gm-secondary" onClick={loadRows}>
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
          <button type="button" className="gm-btn gm-primary" onClick={openNew} title={`New ${noun}`}>
            <i className="fa-solid fa-plus" /> New
          </button>
        </>
      }
    />
    {notice && <div className="gm-notice" role="status"><i className="fa-solid fa-circle-check"/> {notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    {error && <div className="gm-error" role="alert"><i className="fa-solid fa-triangle-exclamation"/> {error}<button type="button" onClick={loadRows}>Retry</button></div>}
    {isPayments ? (
      <PaymentsView
        rows={rows} loading={loading} canApprove={canApprove}
        onApprove={(row) => decide(row, true)} onReject={(row, reason) => decide(row, false, reason)}
        onApproveMany={approveMany}
        onEdit={openEdit} onDelete={remove} onNew={openNew}
        onCreate={createPayment}
      />
    ) : <>
    <div className="gm-stats">
      <div className="gm-stat"><span>Total records</span><strong>{rows.length}</strong><small><i className="fa-solid fa-layer-group"/> Saved records</small></div>
      <div className="gm-stat"><span>Active</span><strong>{rows.filter(r => /active|completed|approved|paid|received/i.test(r.status || "")).length}</strong><small>Active / completed</small></div>
      <div className="gm-stat"><span>Pending</span><strong>{rows.filter(r => /pending|draft|progress|scheduled|hold/i.test(r.status || "")).length}</strong><small>Need attention</small></div>
    </div>
    <section className="gm-panel">
      <div className="gm-toolbar"><div><h2>{title} records</h2><p>{loading ? "Loading…" : `${filtered.length} record${filtered.length === 1 ? "" : "s"} shown`}</p></div><div className="gm-filters"><label className="gm-search"><i className="fa-solid fa-magnifying-glass"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`} /></label><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">{statusOptions.map(option => <option key={option}>{option}</option>)}</select></div></div>
      <div className="gm-table-wrap"><table className="gm-table"><thead><tr><th>{title.toUpperCase()} DETAILS</th><th>REFERENCE / DETAILS</th><th>OWNER / CONTACT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
      {!loading && filtered.map(row => <tr key={row.id}><td><strong>{row[primaryKey] || row.name || `${noun} #${row.id}`}</strong><small>{isCustomers ? `Customer ID: ${row.customerId || "—"}` : `Record ID: ${row.id}`}</small></td><td>{row[secondaryKey] || row.reference || row.code || "—"}</td><td>{row.owner || row.assignedTo || row.email || row.supplier || row.department || "—"}</td><td><span className={`gm-status ${String(row.status || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>{row.status || "—"}</span></td><td><div className="gm-row-actions">
        {isCustomers && <button type="button" title="View customer, invoices & orders" onClick={() => setViewing(row)} aria-label="View customer"><i className="fa-solid fa-eye"/></button>}
        {isReceipts && <button type="button" title="Print receipt" onClick={() => printReceipt(row)} aria-label="Print receipt"><i className="fa-solid fa-print"/></button>}
        <button type="button" title="Edit record" onClick={() => openEdit(row)} aria-label="Edit record"><i className="fa-solid fa-pen"/></button>
        <button type="button" title="Delete record" onClick={() => remove(row)} aria-label="Delete record"><i className="fa-solid fa-trash"/></button>
      </div></td></tr>)}
      {!loading && filtered.length === 0 && <tr><td colSpan="5" className="gm-empty"><i className="fa-regular fa-folder-open"/><strong>{rows.length ? "No matching records" : "No records yet"}</strong><span>{rows.length ? "Change your search or status filter." : "Select New to create your first record."}</span></td></tr>}
      {loading && <tr><td colSpan="5" className="gm-empty">Loading records…</td></tr>}
      </tbody></table></div>
    </section>
    </>}
    {showForm && <ErpFormModal
      eyebrow={`MEG ERP · ${title}`}
      title={`${editing ? "Edit" : "New"} ${noun}`}
      subtitle="Fill in the details below. Fields marked * are required."
      icon={editing ? "fa-pen-to-square" : iconForTitle(title)}
      fields={fields} form={form} setForm={setForm}
      saving={saving} error={formError}
      submitLabel={editing ? "Save Changes" : `Create ${noun}`}
      onSubmit={save} onClose={() => setShowForm(false)}
    />}
    {viewing && <CustomerView customer={viewing} onClose={() => setViewing(null)} onEdit={openEdit} />}
    {printPortal}
  </div>;
}