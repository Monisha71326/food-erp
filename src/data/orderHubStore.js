/*
 * Order Hub store — backed by the in-browser database (data/localDb.js) through data/api.js.
 *
 *  - `state` is a CACHE of the database. loadHub() fetches GET /state and fills it;
 *    every action below calls the API, and when it is accepted the cache is refreshed,
 *    so every page re-renders automatically (a manual ADD shows up in the list straight away).
 *  - All business rules live in localDb.js. The browser only sends what the user did.
 *  - Actions return Promise<{ ok, msg, ... }>. "Form" actions (add / edit) return the result so the
 *    page can show the message and close the modal; delete actions ask for confirmation first.
 *  - goTo("Sidebar Label") redirects to another page (see App.jsx snippet in the chat).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { money } from "@/utils/format.js";
import { api, BASE } from "@/data/api.js";
import { askConfirm } from "@/data/confirm.js";

/* ---------- helpers ---------- */
export function iso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
export const gbp = (n) => money(n, 2);
export function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - new Date()) / 86400000);
}

/* ---------- redirect helper ---------- */
/* goTo("Client Dashboard") -> App.jsx listens for "meg:navigate" and switches page */
export const goTo = (label) => window.dispatchEvent(new CustomEvent("meg:navigate", { detail: label }));

/* ---------- cached data (filled by loadHub) ---------- */
export const state = {
  session: { clientId: "C1", managerId: "AM1" }, // "viewing as" for the Client / Area Manager menus (browser-only)
  clients: [], areaManagers: [], products: [], promotions: [], orders: [], backorders: [], invoices: [], payments: [], tickets: [],
  purchaseOrders: [], goodsReceipts: [], inventory: [], shipments: [], auditLog: [],
  lastAutoMatch: null,
};

/* ---------- subscribe / hook ---------- */
let version = 0;
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => { version += 1; listeners.forEach((fn) => fn()); };

/* Call at the top of a page: the page re-renders whenever Order Hub data changes */
export function useHub() {
  useSyncExternalStore(subscribe, () => version);
  return state;
}

/* Computed report (forecast | sales | credit-control | stock-expiry). null while loading.
   Re-fetches automatically whenever Order Hub data changes. */
export function useReport(name) {
  const v = useSyncExternalStore(subscribe, () => version);
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    api("GET", `/reports/${name}`).then((d) => { if (live && (Array.isArray(d) || d?.ok !== false)) setData(d); });
    return () => { live = false; };
  }, [name, v]);
  return data;
}

/* ---------- loading ---------- */
export async function loadHub() {
  const data = await api("GET", "/state");
  if (data.ok === false || !data.clients) throw new Error(data.msg || "Could not load Order Hub data.");
  data.areaManagers.forEach((m) => m.visits.forEach((v) => {
    if (v.photoDataUrl?.startsWith("/api/")) v.photoDataUrl = BASE + v.photoDataUrl;
  }));
  Object.assign(state, data);
  emit();
}

/* send an action; refresh the cache when it was accepted */
async function act(method, path, body) {
  const r = await api(method, path, body);
  if (r.ok) await loadHub().catch(() => {});
  return r;
}
const orAlert = async (promise) => {
  const r = await promise;
  if (!r.ok) window.alert(r.msg || "That action was not accepted.");
  return r;
};
/* delete with a confirm box -> Promise<{ ok, msg }> (ok:false + cancelled:true when the user says No) */
const del = (path, what) => {
  if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return Promise.resolve({ ok: false, cancelled: true });
  return orAlert(act("DELETE", path));
};

/* ---------- lookups (read from the cache) ---------- */
export const client = (id) => state.clients.find((c) => c.id === id);
export const product = (code) => state.products.find((p) => p.code === code);
export const manager = (id) => state.areaManagers.find((m) => m.id === id);
/* the area manager who looks after this client (null if none) */
export const clientManager = (clientId) =>
  state.areaManagers.find((m) => (m.clientIds || []).includes(clientId)) || null;
/* For showing prices only — the real price is recalculated when the order is saved */
export function priceFor(clientId, code) {
  const c = client(clientId);
  if (c && c.priceOverrides[code] != null) return c.priceOverrides[code];
  const p = product(code);
  return p ? p.standardPrice : 0;
}
export const orderTotal = (order) => order.lines.reduce((s, l) => s + l.qty * l.price, 0);
export const clientBalance = (clientId) =>
  state.invoices.filter((i) => i.clientId === clientId && i.status === "Outstanding").reduce((s, i) => s + (i.amount - (i.paid || 0)), 0);
export const clientOrders = (clientId) =>
  state.orders.filter((o) => o.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));
export const clientInvoices = (clientId) =>
  state.invoices.filter((i) => i.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));
/* payments the client has made (newest first) - use this on the Account Statement page */
export const clientPayments = (clientId) =>
  (state.payments || []).filter((p) => p.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));
/* ALL payments of an invoice (oldest first) - for the part-payment history */
export const invoicePayments = (invoiceId) =>
  (state.payments || [])
    .filter((p) => p.invoiceId === invoiceId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
/* the LATEST payment record (receipt) of an invoice, if it was paid through the portal */
export const invoicePayment = (invoiceId) => {
  const all = invoicePayments(invoiceId);
  return all.length ? all[all.length - 1] : null;
};
/* mistake / return tickets of an invoice (newest first) */
export const invoiceTickets = (invoiceId) =>
  (state.tickets || []).filter((t) => t.invoiceId === invoiceId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
export const managerOrders = (managerId) => {
  const m = manager(managerId);
  if (!m) return [];
  return state.orders.filter((o) => m.clientIds.includes(o.clientId)).sort((a, b) => b.date.localeCompare(a.date));
};

/* ============================================================
   ACTIONS
   ============================================================ */
export function setSession(patch) {
  state.session = { ...state.session, ...patch };
  emit();
}

/* ----- orders ----- */
/* lines = [{code, qty}] -> Promise<{ ok, msg, order? }>   (after ok: goTo("Client Dashboard"))
   REMARKS:  clientRemark  = note from the client (client portal or typed by the area manager for the client)
             managerRemark = area manager's own note (only saved when an area manager places the order)
             remark        = old single field, still accepted so older callers keep working */
export function placeOrder({ clientId, lines, promoCode = "", placedBy, clientRemark = "", managerRemark = "", remark = "" }) {
  return act("POST", "/orders", {
    clientId,
    lines: lines.filter((l) => l.qty > 0).map((l) => ({ code: l.code, qty: l.qty })),
    promoCode,
    placedBy,
    clientRemark,
    managerRemark,
    remark: remark || clientRemark || managerRemark, // fallback so an older localDb.js still saves something
  });
}
export const updateOrder = (orderId, { lines, promoCode = "" }) =>
  act("PUT", `/orders/${orderId}`, { lines: lines.filter((l) => l.qty > 0).map((l) => ({ code: l.code, qty: l.qty })), promoCode });
export const deleteOrder = (orderId) => del(`/orders/${orderId}`, `order ${orderId}`);

/* shows the "Hold to send" popup first -> Promise<{ ok, msg }> (ok:false + cancelled:true when the user cancels) */
export const sendToEdenFarm = async (orderId) => {
  const order = state.orders.find((o) => o.id === orderId);
  const ok = await askConfirm({
    orderId,
    clientName: order ? client(order.clientId)?.name || order.clientId : "",
    lines: order ? order.lines.length : 0,
    units: order ? order.lines.reduce((s, l) => s + l.qty, 0) : 0,
    total: order ? gbp(orderTotal(order)) : "",
  });
  if (!ok) return { ok: false, cancelled: true };
  return orAlert(act("POST", `/orders/${orderId}/send-to-eden-farm`));
};

/* delivered = delivered quantities, same order as order.lines -> Promise<{ ok, msg }> */
export const matchPOD = (orderId, delivered, signatureOk) => act("POST", `/orders/${orderId}/pod`, { delivered, signatureOk });
export const runAutoMatch = () => orAlert(act("POST", "/pod/auto-match"));
export const generateLabel = (orderId) => orAlert(act("POST", `/orders/${orderId}/shipping-label`));
export const deleteShipment = (id) => del(`/shipments/${id}`, `label ${id}`);

/* ----- purchase orders / backorders / stock ----- */
export const createPO = ({ supplier = "Eden Farm", code, qty, logUser = "Admin", note = "", remarks = "" }) =>
  act("POST", "/purchase-orders", { supplier, code, qty, logUser, note, remarks });
export const updatePO = (poId, { supplier, code, qty }) => act("PUT", `/purchase-orders/${poId}`, { supplier, code, qty });
export const deletePO = (poId) => del(`/purchase-orders/${poId}`, `purchase order ${poId}`);
export const receiveGoods = (poId) => orAlert(act("POST", `/purchase-orders/${poId}/receive`));
export const raisePOFromBackorder = (id) => orAlert(act("POST", `/backorders/${id}/purchase-order`));
export const updateBackorder = (id, { qty }) => act("PUT", `/backorders/${id}`, { qty });
export const deleteBackorder = (id) => del(`/backorders/${id}`, `backorder #${id}`);

export const addStock = ({ code, source, qty, batch, expiry }) => act("POST", "/stock", { code, source, qty, batch, expiry });
export const updateStock = (id, patch) => act("PUT", `/stock/${id}`, patch);
export const deleteStock = (id) => del(`/stock/${id}`, "this stock line");

/* ----- products & prices ----- */
/* image: "" | a URL | a data URL (from ProductImageInput). OrderForm shows it automatically. */
export const addProduct = ({ code, description, costPrice, standardPrice, category, image = "" }) =>
  act("POST", "/products", { code, description, costPrice, standardPrice, category, image });
/* patch can hold { description, costPrice, standardPrice, category, image } */
export const updateProduct = (code, patch) => act("PUT", `/products/${code}`, patch);
export const deleteProduct = (code) => del(`/products/${code}`, `item ${code}`);
export const saveStandardPrice = (code, value) => orAlert(act("PUT", `/products/${code}/price`, { price: value }));
export const saveOverride = (clientId, code, price) => orAlert(act("PUT", `/clients/${clientId}/price-overrides/${code}`, { price }));
export const deleteOverride = (clientId, code) => del(`/clients/${clientId}/price-overrides/${code}`, `the override on ${code}`);

/* ----- clients ----- */
/* addClient: { name, contact, email, phone, pincode, creditLimit, address }   updateClient patch can also hold phone / pincode */
export const addClient = ({ name, contact, email, phone, pincode, creditLimit, address }) =>
  act("POST", "/clients", { name, contact, email, phone, pincode, creditLimit, address });
export const updateClient = (id, patch) => act("PUT", `/clients/${id}`, patch);
export const deleteClient = (id) => del(`/clients/${id}`, `client ${client(id)?.name || id} with all its orders and invoices`);
export const sendReminder = (clientId) => act("POST", `/clients/${clientId}/reminder`);

/* ----- promotions ----- */
export const createPromotion = ({ code, pct, clientIds, allClients = false, productCodes = [], note = "" }) =>
  act("POST", "/promotions", { code, pct, clientIds, allClients, productCodes, note });
/* helpers: does a promo reach this client / cover this item? ([] productCodes = every product) */
export const promoForClient = (p, clientId) => !!p.allClients || (p.clientIds || []).includes(clientId);
export const promoCoversItem = (p, code) => !(p.productCodes || []).length || p.productCodes.includes(code);
export const updatePromotion = (id, patch) => act("PUT", `/promotions/${id}`, patch); // { code, pct, active, note, clientIds, allClients, productCodes }
export const deletePromotion = (id) => del(`/promotions/${id}`, "this promotion");

/* ----- invoices ----- */
export const createInvoice = ({ clientId, orderId, amount, status, date }) => act("POST", "/invoices", { clientId, orderId, amount, status, date });
export const updateInvoice = (id, patch) => act("PUT", `/invoices/${id}`, patch); // { amount, status, date }
export const deleteInvoice = (id) => del(`/invoices/${id}`, `invoice ${id}`);
export const markPaid = (invoiceId) => orAlert(act("POST", `/invoices/${invoiceId}/paid`));
/* any role pays an invoice (full or PART payment, as many times as needed) -> Promise<{ ok, msg, payment? }>
   method: "Online" | "Cheque" | "Cash"   amount: the amount being paid (editable on the Pay screen)
   receivedBy + receiverEmail: who received this payment (area manager or "Other person") - mandatory
   managerId: the area manager id when an area manager received it, "" for "Other person" */
export const payInvoice = (invoiceId, {
  method, amount, reference = "", date, payerName = "", chequePhoto = "", chequeNo = "", bankName = "", accountHolder = "",
  receivedBy = "", receiverEmail = "", managerId = "",
} = {}) =>
  act("POST", `/invoices/${invoiceId}/pay`, {
    method, amount, reference, date, payerName, chequePhoto, chequeNo, bankName, accountHolder, receivedBy, receiverEmail, managerId,
  });

/* ----- tickets ----- */
/* type "Mistake": { type, issue, note, code? }   type "Return": { type, issue, note, lines:[{code, qty}] } -> Promise<{ ok, msg, ticket? }> */
/* ----- invoice photos (client + area manager) ----- */
/* role: "client" | "manager"  (managerId is needed for "manager") */
export const invoicePhotos = (invoiceId) => state.invoices.find((i) => i.id === invoiceId)?.photos || [];
export const addInvoicePhotos = (invoiceId, { photos, kind = "Other", note = "", role = "client", managerId } = {}) =>
  act("POST", `/invoices/${invoiceId}/photos`, { photos, kind, note, role, managerId });
export function deleteInvoicePhoto(invoiceId, photoId, { role = "client", managerId } = {}) {
  if (!window.confirm("Delete this photo? This cannot be undone.")) return Promise.resolve({ ok: false, cancelled: true });
  return orAlert(act("DELETE", `/invoices/${invoiceId}/photos/${photoId}`, { role, managerId }));
}
export const createTicket = (invoiceId, payload) => act("POST", `/invoices/${invoiceId}/tickets`, payload);
/* staff: { status, response } */
export const updateTicket = (id, patch) => act("PUT", `/tickets/${id}`, patch);

/* ----- visits (check-in / check-out) ----- */
/* registerVisit = ENTER STORE (check in). Send lat/lng for a real GPS check or distanceKm for the demo buttons -> Promise<{ ok, msg }> */
export const registerVisit = (managerId, { clientId, lat, lng, distanceKm, photoDataUrl, remark }) =>
  act("POST", `/managers/${managerId}/visits`, { clientId, lat, lng, distanceKm, photoDataUrl, remark });
/* LEAVE STORE (check out) -> saves check-out time + minutes spent in the store */
export const checkOutVisit = (managerId, visitId, { remark } = {}) => act("POST", `/managers/${managerId}/visits/${visitId}/check-out`, { remark });
export const updateVisit = (managerId, visitId, { note }) => act("PUT", `/managers/${managerId}/visits/${visitId}`, { note });
export const deleteVisit = (managerId, visitId) => del(`/managers/${managerId}/visits/${visitId}`, "this visit");

/* the visit a manager is inside right now (checked in, not yet checked out) - null if none */
export const openVisitOf = (m) => (m?.visits || []).find((v) => v.checkIn && !v.checkOut) || null;
/* whole minutes since an ISO time */
export const minutesSince = (isoTime) => Math.max(0, Math.floor((Date.now() - new Date(isoTime).getTime()) / 60000));
/* "2:15 pm" */
export const fmtClock = (isoTime) =>
  isoTime ? new Date(isoTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }) : "-";
/* "2 Nov 2026, 2:15 pm" */
export const fmtDateTime = (isoTime) =>
  isoTime
    ? new Date(isoTime).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
    : "-";
/* 42 -> "42 min", 75 -> "1 h 15 min" */
export const fmtDuration = (min) => {
  if (min == null) return "-";
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

/* ---------- distance helper ---------- */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}