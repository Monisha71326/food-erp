import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import ErpFormModal from "@/components/ErpFormModal/ErpFormModal.jsx";
import { createErpRecord, deleteErpRecord, getErpRecords, updateErpRecord, ERP_ALIAS_GROUPS } from "@/data/erpApi.js";
import DataTable from "@/components/DataTable/DataTable.jsx";
import useInvoiceDateFilter from "@/components/InvoiceDateFilter/InvoiceDateFilter.jsx";
import "./ListPage.css";

const CUSTOMER_FIELDS = [
  { key: "name", label: "Customer Name", required: true, placeholder: "Enter full name", section: "Basic details" },
  { key: "company", label: "Company Name", placeholder: "Company / business name", section: "Basic details" },
  { key: "email", label: "Email Address", type: "email", required: true, placeholder: "name@company.com", section: "Contact" },
  { key: "phone", label: "Work Phone", type: "tel", required: true, placeholder: "+91...", section: "Contact" },
  { key: "mobile", label: "Mobile Number", type: "tel", placeholder: "+91...", section: "Contact" },
  { key: "website", label: "Website", type: "url", placeholder: "https://", section: "Contact" },
  { key: "taxNumber", label: "GST / Tax Number", placeholder: "GSTIN / tax reference", section: "Billing & terms" },
  { key: "paymentTerms", label: "Payment Terms", type: "select", options: ["Due on receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"], section: "Billing & terms" },
  { key: "currency", label: "Currency", type: "select", options: ["INR", "GBP", "USD", "EUR"], section: "Billing & terms" },
  { key: "receivables", label: "Opening Receivables", type: "number", min: "0", section: "Billing & terms" },
  { key: "credits", label: "Unused Credits", type: "number", min: "0", section: "Billing & terms" },
  { key: "billingAddress", label: "Billing Address", type: "textarea", wide: true, placeholder: "Street, city, state, postal code, country", section: "Addresses" },
  { key: "shippingAddress", label: "Shipping Address", type: "textarea", wide: true, placeholder: "Shipping address (if different)", section: "Addresses" },
  { key: "notes", label: "Notes", type: "textarea", wide: true, placeholder: "Additional customer notes", section: "Notes" },
];
const FIELD_MAP = {
  estimates: [{ key: "customerName", label: "Customer Name", required: true }, { key: "number", label: "Estimate Number", required: true }, { key: "ref", label: "Reference Number" }, { key: "date", label: "Estimate Date", type: "date" }, { key: "expiryDate", label: "Expiry Date", type: "date" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Accepted", "Declined"] }, { key: "amount", label: "Amount", type: "number", min: "0" }],
  invoices: [{ key: "customerName", label: "Customer Name", required: true }, { key: "invoiceNumber", label: "Invoice Number", required: true }, { key: "date", label: "Invoice Date", type: "date" }, { key: "dueDate", label: "Due Date", type: "date" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Partially Paid", "Paid", "Overdue"] }, { key: "amount", label: "Amount", type: "number", min: "0" }],
  // Keys match the Sales Orders table row keys (number, date, ref, customer, status, amount, analysis1, analysis2)
  "sales-orders": [
    { key: "customer", label: "Customer Name", required: true },
    { key: "number", label: "Sales Order#", required: true },
    { key: "ref", label: "Reference#" },
    { key: "date", label: "Order Date", type: "date" },
    { key: "status", label: "Status", type: "select", options: ["Draft", "Open", "Confirmed", "Shipped", "Invoiced", "Partially Invoiced", "Cancelled"] },
    { key: "amount", label: "Amount", type: "number", min: "0" },
    { key: "analysis1", label: "Analysis 1", placeholder: "e.g. Region / Department" },
    { key: "analysis2", label: "Analysis 2", placeholder: "e.g. Project / Cost centre" },
  ],
  "credit-notes": [{ key: "customerName", label: "Customer Name", required: true }, { key: "creditNoteNumber", label: "Credit Note Number", required: true }, { key: "date", label: "Date", type: "date" }, { key: "amount", label: "Amount", type: "number", min: "0" }, { key: "reason", label: "Reason", type: "textarea", wide: true }],
  payments: [{ key: "customerName", label: "Customer Name", required: true }, { key: "paymentDate", label: "Payment Date", type: "date" }, { key: "method", label: "Payment Method", type: "select", options: ["Bank Transfer", "Cash", "Card", "UPI", "Cheque", "Other"] }, { key: "reference", label: "Reference Number" }, { key: "amount", label: "Amount", type: "number", min: "0" }],
};

/* Auto-suggested document numbers (EST-1013, INV-2011 ...) so the user never has to guess one. */
const NUMBER_PREFIX = { estimates: "EST-", invoices: "INV-", "sales-orders": "SO-", "credit-notes": "CN-" };
const NUMBER_KEYS = ["number", "estimateNumber", "invoiceNumber", "orderNumber", "creditNoteNumber"];
const TODAY_KEYS = ["date", "orderDate", "invoiceDate", "paymentDate"];

const titleCase = (value = "") => value.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const singular = (entity) => (entity === "customers" ? "Customer" : titleCase(entity).replace(/([^s])s$/i, "$1"));
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const aliasSiblings = (key) => ERP_ALIAS_GROUPS.find((group) => group.includes(key)) || [key];

/* "sales orders" / "Sales Orders" / "sales-orders" -> "sales-orders" (only used for FIELD_MAP / NUMBER_PREFIX lookups;
   the original entity string is still sent to the API untouched). */
const normEntity = (e = "") => String(e).trim().toLowerCase().replace(/\s+/g, "-");

const fieldsFor = (entity, columns = []) => {
  const base = entity === "customers" ? CUSTOMER_FIELDS : (FIELD_MAP[normEntity(entity)] || [
    { key: "name", label: "Name", required: true },
    { key: "description", label: "Description", type: "textarea", wide: true },
    { key: "status", label: "Status", type: "select", options: ["Active", "Pending", "Completed", "Draft", "Approved", "Paid"] },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ]);
  // A key counts as "already in the form" if the form has it OR any alias of it (customer <-> customerName ...).
  const known = new Set(base.flatMap((f) => aliasSiblings(f.key)));
  const fromColumns = [];
  columns.forEach((c) => {
    if (!c.key || ["__actions", "att"].includes(c.key) || known.has(c.key)) return;
    if (typeof c.label !== "string" || !c.label.trim()) return;
    // Columns with a custom render() are skipped, unless they show a well-known value the user must be able to type.
    if (typeof c.render === "function" && !ERP_ALIAS_GROUPS.some((group) => group.includes(c.key))) return;
    aliasSiblings(c.key).forEach((k) => known.add(k));
    fromColumns.push({
      key: c.key,
      label: c.label || titleCase(c.key),
      required: ["customer", "customerName", "name", "number", "invoiceNumber", "orderNumber"].includes(c.key),
      type: /amount|total|quantity|qty/i.test(c.key) ? "number" : /date/i.test(c.key) ? "date" : c.key === "status" ? "select" : "text",
      ...(c.key === "status" ? { options: ["Active", "Pending", "Completed", "Draft", "Sent", "Approved", "Paid", "Processing", "Overdue", "Confirmed"] } : {}),
    });
  });
  return [...base, ...fromColumns];
};

const nextNumber = (entity, rows) => {
  const prefix = NUMBER_PREFIX[normEntity(entity)];
  if (!prefix) return "";
  let max = 1000;
  rows.forEach((row) => NUMBER_KEYS.forEach((key) => {
    const match = String(row[key] ?? "").match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }));
  return `${prefix}${max + 1}`;
};

/*
 * Optional extras (off by default, so other list pages are unchanged):
 *   dateFilter  : show the "Filter by date" card above the table (rows need an ISO "date")
 *   excludePaid : (row) => boolean  -> shows the "Exclude paid" pill next to the search box;
 *                 rows where it returns true are hidden while the pill is ticked
 */
export default function ListPage({ className = "", eyebrow, title, icon, entity, searchPlaceholder, columns, rows, dateFilter = false, excludePaid = null, formFields = null, filters = [], children }) {
  const [apiRows, setApiRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [hidePaid, setHidePaid] = useState(false); // "Exclude paid" pill
  const [filterVals, setFilterVals] = useState({});   // { analysis1: "London", ... } for the `filters` prop

  /* opt-in extras: date filter card + "Exclude paid" pill (hook is always called, only used when enabled) */
  const [dateRows, filterBar] = useInvoiceDateFilter(apiRows, "date", String(entity || "records").replace(/-/g, " "));
  const baseRows = dateFilter ? dateRows : apiRows;
  const pendingCount = excludePaid ? baseRows.filter((r) => !excludePaid(r)).length : 0;
  const paidRows = excludePaid && hidePaid ? baseRows.filter((r) => !excludePaid(r)) : baseRows;
  const tableRows = filters.some((f) => filterVals[f.key]) ? paidRows.filter((r) => filters.every((f) => !filterVals[f.key] || r[f.key] === filterVals[f.key])) : paidRows;
  const filterOptions = (key) => [...new Set(apiRows.map((r) => r[key]).filter((v) => v !== undefined && v !== null && String(v).trim() !== ""))].sort();

  const fields = useMemo(() => formFields || fieldsFor(entity, columns), [formFields, entity, columns]);
  const loadRecords = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const data = await getErpRecords(entity);
      setApiRows(Array.isArray(data) ? data : []);
    } catch (error) { setLoadError(error.message || "Unable to load records."); }
    finally { setLoading(false); }
  }, [entity]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const defaultValue = (field) => {
    if (field.key === "currency") return "INR";
    if (field.key === "paymentTerms") return "Due on receipt";
    if (field.key === "receivables" || field.key === "credits") return "0";
    if (field.allowEmpty) return "";                                            // optional select starts blank
    if (field.type === "select") return field.options?.[0] || "";            // status starts as a real option, never blank
    if (field.type === "date" && TODAY_KEYS.includes(field.key)) return new Date().toISOString().slice(0, 10);
    if (NUMBER_KEYS.includes(field.key)) return nextNumber(entity, apiRows);
    return "";
  };

  const openNew = () => {
    setEditing(null);
    setForm(Object.fromEntries(fields.map((f) => [f.key, defaultValue(f)])));
    setFormError(""); setNotice(""); setModalOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    // Read each field from its own key, or from any alias key that holds the value.
    setForm(Object.fromEntries(fields.map((f) => {
      const value = [f.key, ...aliasSiblings(f.key)].map((k) => record[k]).find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      return [f.key, value ?? ""];
    })));
    setFormError(""); setNotice(""); setModalOpen(true);
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setFormError("");
    const data = { ...form };
    for (const f of fields) if (f.type === "number") data[f.key] = Number(data[f.key] || 0);
    /* invoices: the form has no "balance" field, so keep it in step with the amount.
       New invoice  -> nothing paid yet (balance = amount), unless it is created as Paid.
       Edit invoice -> if the amount changed, move the balance by the same difference (never below 0). */
    if (normEntity(entity) === "invoices") {
      const amount = Number(data.amount || 0);
      if (!editing) {
        data.balance = String(data.status || "").toLowerCase() === "paid" ? 0 : amount;
      } else {
        const oldAmount = Number(editing.amount || 0);
        const oldBalance = editing.balance == null || editing.balance === "" ? oldAmount : Number(editing.balance);
        if (amount !== oldAmount) data.balance = Math.max(0, round2(oldBalance + (amount - oldAmount)));
      }
    }
    try {
      if (editing) await updateErpRecord(entity, editing.id, data);
      else await createErpRecord(entity, data);
      setModalOpen(false); setNotice(`${singular(entity)} ${editing ? "updated" : "created"} successfully.`);
      await loadRecords();
    } catch (error) { setFormError(error.message || "Unable to save. Please try again."); }
    finally { setSaving(false); }
  };
  const remove = async (record) => {
    const label = record.name || record.company || record.customerName || record.customer || record.id;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try { await deleteErpRecord(entity, record.id); setNotice("Record deleted successfully."); await loadRecords(); }
    catch (error) { setLoadError(error.message || "Unable to delete record."); }
  };
  const tableColumns = useMemo(() => [
    ...columns,
    { key: "__actions", label: "Actions", render: (record) => (
      <div className="erp-row-actions">
        <button type="button" onClick={() => openEdit(record)} aria-label={`Edit ${record.name || record.id}`} title="Edit"><i className="fa-solid fa-pen" /></button>
        <button type="button" onClick={() => remove(record)} aria-label={`Delete ${record.name || record.id}`} title="Delete"><i className="fa-solid fa-trash" /></button>
      </div>
    ) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [columns, entity, fields]);

  const paidPill = excludePaid ? (
    <label className={`lp-hide-paid${hidePaid ? " on" : ""}`}>
      <input type="checkbox" checked={hidePaid} onChange={(e) => setHidePaid(e.target.checked)} />
      <span className="lp-hide-paid-box"><i className="fa-solid fa-check" aria-hidden="true" /></span>
      <span className="lp-hide-paid-text">Exclude paid</span>
      <b className="lp-hide-paid-count" title="Pending">{pendingCount}</b>
    </label>
  ) : null;

  /* dropdown filters (Analysis 1 / 2 ...): options are built from the values that really exist in the rows */
  const toolbarExtra = (paidPill || filters.length) ? <>
    {filters.map((f) => (
      <select key={f.key} className={`lp-filter${filterVals[f.key] ? " on" : ""}`} aria-label={f.label}
        value={filterVals[f.key] || ""} onChange={(e) => setFilterVals((old) => ({ ...old, [f.key]: e.target.value }))}>
        <option value="">{f.label}: All</option>
        {filterOptions(f.key).map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    ))}
    {paidPill}
  </> : null;

  const actions = <>
    <button type="button" className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus" aria-hidden="true" /> New {singular(entity)}</button>
    <button type="button" className="btn-ghost" onClick={loadRecords} aria-label="Refresh records" title="Refresh"><i className="fa-solid fa-rotate" /></button>
  </>;

  return <div className={`page-anim ${className}`.trim()}>
    <PageHeader eyebrow={eyebrow} title={title} icon={icon} actions={actions} />
    {notice && <div className="erp-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    {children}
    {dateFilter && !loading && filterBar}
    {loadError && <div className="card erp-error" role="alert">{loadError}<button type="button" onClick={loadRecords}>Retry</button></div>}
    {loading ? <div className="card" role="status" style={{ padding: 20 }}>Loading {title.toLowerCase()} …</div> :
      <DataTable columns={tableColumns} rows={tableRows} searchPlaceholder={searchPlaceholder} entity={entity} toolbarExtra={toolbarExtra} />}
    {!loading && !loadError && apiRows.length === 0 && <p className="muted" style={{ padding: "8px 4px" }}>No records yet. Select “New” to add the first record.</p>}

    {modalOpen && <ErpFormModal
      eyebrow={`${eyebrow || "ERP"} / ${title}`}
      title={`${editing ? "Edit" : "New"} ${singular(entity)}`}
      subtitle="Enter the details below. Required fields are marked with *."
      icon={editing ? "fa-pen-to-square" : (entity === "customers" ? "fa-user-plus" : "fa-file-circle-plus")}
      fields={fields} form={form} setForm={setForm}
      saving={saving} error={formError}
      submitLabel={editing ? "Save Changes" : `Create ${singular(entity)}`}
      onSubmit={save} onClose={() => setModalOpen(false)}
    />}
  </div>;
}