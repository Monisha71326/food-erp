/* ERP records (customers, invoices, any module...) stored in the browser's localStorage. No server needed. */
import { demoRowsFor } from "@/data/erpDemoData.js";

const KEY = "meg-erp-records";
const SEED_VERSION = 2; // bump this to re-generate the demo rows (user-created rows are never removed)

const slug = (raw = "") => String(raw).toLowerCase().trim().replace(/&/g, "and").replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { next: 1, data: {} }; } catch { return { next: 1, data: {} }; } };
const write = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { throw new Error("Browser storage is full or blocked."); } };
const entityOf = (raw) => { const e = slug(raw); if (!e || e.length > 64) throw new Error("Invalid module name."); return e; };
const isObj = (d) => d && typeof d === "object" && !Array.isArray(d);
const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

/*
 * Different pages / forms use different key names for the SAME thing
 * (e.g. the form saves "customerName" but a table column reads "customer").
 * Keys in one group are kept in sync, so what the user types always shows in the table.
 */
export const ERP_ALIAS_GROUPS = [
  ["customer", "customerName"],
  ["number", "estimateNumber", "invoiceNumber", "orderNumber", "creditNoteNumber"],
  ["ref", "reference", "referenceNumber"],
  ["date", "orderDate", "invoiceDate", "paymentDate"],
  ["amount", "total"],
  ["due", "dueDate"], // invoice form saves "dueDate", the table reads "due"
];

/*
 * submitted = the data the user just saved  -> its values OVERWRITE every alias key.
 * submitted = null (repair mode)            -> only BLANK alias keys are filled from a filled sibling.
 */
function applyAliases(record, submitted) {
  for (const group of ERP_ALIAS_GROUPS) {
    const sourceKey = submitted ? group.find((k) => !isBlank(submitted[k])) : undefined;
    const value = sourceKey !== undefined ? submitted[sourceKey] : group.map((k) => record[k]).find((v) => !isBlank(v));
    if (value === undefined) continue;
    const overwrite = sourceKey !== undefined;
    group.forEach((k) => { if (overwrite || isBlank(record[k])) record[k] = value; });
  }
  return record;
}

/*
 * Each module gets its OWN demo rows (see erpDemoData.js).
 * - Existing rows: repair duplicate/missing IDs, fill only BLANK fields from this module's demo row.
 * - Fewer than 10 rows: top up with this module's demo rows (ids start with "DEMO-").
 */
function seedRows(entity, existing = []) {
  const demo = demoRowsFor(entity);
  const template = (i) => applyAliases({ ...demo[i % demo.length] }, null);
  const rows = [];
  const usedIds = new Set();

  existing.forEach((record, index) => {
    const row = { ...record };
    let id = row.id;
    if (id === undefined || id === null || isBlank(id) || usedIds.has(String(id))) {
      let suffix = index + 1;
      id = `FIX-${entity}-${suffix}`;
      while (usedIds.has(String(id))) id = `FIX-${entity}-${++suffix}`;
      row.id = id;
    }
    usedIds.add(String(id));

    applyAliases(row, null); // copy what the user typed into every alias key first
    const tpl = template(index);
    Object.keys(tpl).forEach((k) => { if (isBlank(row[k])) row[k] = tpl[k]; });
    row._updated = row._updated || Date.now() - (index + 1) * 1000;
    rows.push(row);
  });

  let n = 0;
  while (rows.length < 10) {
    const id = `DEMO-${entity}-${n + 1}`;
    if (usedIds.has(id)) { n += 1; continue; }
    rows.push({ ...template(n), id, _updated: Date.now() - (rows.length + 1) * 1000 });
    usedIds.add(id);
    n += 1;
  }
  return rows;
}

export const getErpRecords = async (entity) => {
  const db = read(), key = entityOf(entity);
  db.data ||= {};

  // One-time: throw away the OLD generic demo rows so every module can get its own data.
  if ((db.seedVersion || 0) < SEED_VERSION) {
    Object.keys(db.data).forEach((k) => {
      db.data[k] = (db.data[k] || []).filter((r) => !String(r.id).startsWith("DEMO-"));
    });
    db.seedVersion = SEED_VERSION;
    write(db);
  }

  const rows = Array.isArray(db.data[key]) ? db.data[key] : [];
  const repaired = seedRows(key, rows);
  if (JSON.stringify(rows) !== JSON.stringify(repaired)) {
    db.data[key] = repaired;
    write(db);
  }
  return [...(db.data[key] || [])].sort((a, b) => (b._updated || 0) - (a._updated || 0)).map(({ _updated, ...r }) => r);
};
export const createErpRecord = async (entity, data) => {
  if (!isObj(data)) throw new Error("Invalid record.");
  const db = read(), e = entityOf(entity);
  db.data ||= {};
  const rec = applyAliases({ ...data, id: db.next, _updated: Date.now() }, data);
  // A new invoice starts with its full amount still to be paid (the form has no Balance field).
  if (e === "invoices" && isBlank(rec.balance)) {
    rec.balance = String(rec.status || "").toLowerCase() === "paid" ? 0 : Number(rec.amount) || 0;
  }
  db.next += 1;
  (db.data[e] ||= []).push(rec);
  write(db);
  return { ok: true, data: rec };
};
export const updateErpRecord = async (entity, id, data) => {
  if (!isObj(data)) throw new Error("Invalid record.");
  const db = read(), list = (db.data ||= {})[entityOf(entity)] || [];
  const i = list.findIndex((r) => String(r.id) === String(id));
  if (i < 0) throw new Error("Record not found.");
  list[i] = applyAliases({ ...list[i], ...data, id: list[i].id, _updated: Date.now() }, data);
  write(db);
  return { ok: true, data: list[i] };
};
export const deleteErpRecord = async (entity, id) => {
  const db = read(), e = entityOf(entity), list = (db.data ||= {})[e] || [];
  const next = list.filter((r) => String(r.id) !== String(id));
  if (next.length === list.length) throw new Error("Record not found.");
  db.data[e] = next;
  write(db);
  return { ok: true };
};
/* Raise a credit note. It is saved in "credit-notes", so Sales > Credit Notes shows it straight away.
   If an invoice number is given, that invoice's balance is reduced by the credit amount. */
export const raiseCreditNote = async ({ customer, invoice = "", amount, ref = "", date = "", status = "Open", reason = "" }) => {
  const amt = Number(amount);
  if (isBlank(customer)) throw new Error("Choose a customer.");
  if (!(amt > 0)) throw new Error("Enter a credit amount greater than zero.");

  // next number: CN-0001, CN-0002 ...
  const existing = await getErpRecords("credit-notes");
  const last = existing.reduce((max, r) => {
    const m = /^CN-(\d+)$/.exec(String(r.number || ""));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const number = `CN-${String(last + 1).padStart(4, "0")}`;

  const created = await createErpRecord("credit-notes", {
    number, customer, invoice, ref, status, reason,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
  });

  // reduce the balance of the invoice it was raised against
  if (!isBlank(invoice)) {
    const invoices = await getErpRecords("invoices");
    const inv = invoices.find((r) => String(r.number || r.invoiceNumber) === String(invoice));
    if (inv) {
      const current = isBlank(inv.balance) ? Number(inv.amount) || 0 : Number(inv.balance);
      await updateErpRecord("invoices", inv.id, { balance: Math.max(0, current - amt) });
    }
  }
  return created; // { ok: true, data: { number, ... } }
};