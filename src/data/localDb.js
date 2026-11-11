/*
 * Browser database for the Order Hub (replaces the old Node + MySQL backend).
 * Everything is kept in localStorage under "meg-hub-db", so data survives page refreshes.
 *
 *  - 10+ hard-coded rows for every module (see seed()).
 *  - A newly registered client / area manager automatically gets demo rows (seedClientDemo),
 *    so no page is ever empty.
 *  - Old saved databases are topped up once (upgrade()) - nothing the user created is removed.
 *  - Full ADD / EDIT / DELETE for products, clients, orders, invoices, purchase orders,
 *    promotions, backorders, stock, shipments, visits.
 *  - Invoice payments (Online / Cheque / Cash) are saved in `payments`. The amount can be edited:
 *    a part payment lowers the balance, and the invoice becomes Paid once the balance reaches zero.
 *    Every payment stores WHO received it (receivedBy / receiverEmail / managerId).
 *  - Products can carry an `image` (uploaded picture as a data URL, or a link).
 *    The 10 demo products point to /products/<CODE>.png  (files live in public/products/).
 *  - Store visits now have CHECK-IN (registerVisit) and CHECK-OUT (checkOutVisit) times
 *    plus the time spent in the store (durationMin).
 *    Check-in needs only a remark. GPS distance and photo are optional.
 *  - Orders carry an optional `clientRemark` (max 250 chars) typed on the cart page.
 *    (`managerRemark` is still accepted for older callers; `remark` mirrors the client remark.)
 *  - Orders placed by an AREA MANAGER also carry `visitType` ("onsite" | "offsite") and
 *    `visitDistanceKm` (distance from the client store when the order was placed).
 *    Client portal orders and old orders have visitType "".
 *  - Area manager TARGETS (sales / collection) are set by the administrator and saved in `targets`,
 *    one entry per area manager id. The area manager only views them.
 *  - Handlers return { ok, msg, ... } objects the pages already expect.
 */
const KEY = "meg-hub-db";
const DATA_VERSION = 6; // 6 = demo products got their image (/products/<CODE>.png)
const VAT_RATE = 0.2;
const VISIT_RADIUS_KM = 0.3; // visit is marked "verified" only when inside this radius
const MAX_ORDER_REMARK = 250; // REMARK

/* emails for the demo area managers (used when an old saved database has none) */
const MANAGER_EMAILS = { AM1: "priya.shah@zulekha.co.uk", AM2: "tom.whitfield@zulekha.co.uk" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class HubError extends Error {}
const fail = (msg) => { throw new HubError(msg); };

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");
export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const daysUntil = (dateStr) => Math.round((new Date(dateStr) - new Date()) / 86400000);
const gbp = (n) => "£" + round2(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function wholeNumber(value, label, { min = 0, max = 1_000_000 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} must be a whole number between ${min} and ${max}.`);
  return n;
}
function money(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) fail(`${label} must be a valid price.`);
  return round2(n);
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const text = (v, label, max = 120) => {
  const s = String(v ?? "").trim().slice(0, max);
  if (!s) fail(`${label} is required.`);
  return s;
};
/* phone / pincode are optional text fields on a client */
const cleanPhone = (v) => String(v ?? "").trim().slice(0, 20);
const cleanPincode = (v) => String(v ?? "").trim().toUpperCase().slice(0, 10);

/* demo product picture: public/products/<CODE>.png  ->  served at /products/<CODE>.png */
const demoImage = (code) => `/products/${code}.png`;

/* invoice built from an order; qtys = delivered quantities (optional, for partial deliveries) */
const mkInv = (id, o, status, date, qtys) => {
  const net = o.lines.reduce((s, l, i) => s + (qtys ? qtys[i] : l.qty) * l.price, 0);
  const vat = round2(net * VAT_RATE);
  return { id, clientId: o.clientId, orderId: o.id, amount: round2(net + vat), vat, status, date };
};

/* ---------------- demo seed data (hard-coded) ---------------- */
function seed() {
  const D = todayISO;
  const L = (code, qty, price) => ({ code, qty, price });
  const pod = (days, matched = true) => ({ matched, checkedOn: D(days) });
  const P = "Client portal", AMP = "Area manager: Priya Shah", AMT = "Area manager: Tom Whitfield";

  /* 10 products (each gets its picture from public/products/<CODE>.png) */
  const products = [
    { code: "RC-001", description: "Basmati Rice 20kg", costPrice: 14.5, standardPrice: 22.0, category: "Grocery" },
    { code: "RC-002", description: "Basmati Rice 5kg", costPrice: 4.2, standardPrice: 6.9, category: "Grocery" },
    { code: "FR-014", description: "Frozen Chicken Samosas (100)", costPrice: 2.4, standardPrice: 3.6, category: "Frozen" },
    { code: "FR-021", description: "Frozen Lamb Kebabs (kg)", costPrice: 5.8, standardPrice: 8.4, category: "Frozen" },
    { code: "SP-007", description: "Garam Masala 1kg", costPrice: 6.1, standardPrice: 9.5, category: "Spices" },
    { code: "SP-011", description: "Turmeric Powder 1kg", costPrice: 3.3, standardPrice: 5.2, category: "Spices" },
    { code: "DR-003", description: "Mango Lassi 1L (12 pack)", costPrice: 9.9, standardPrice: 14.0, category: "Drinks" },
    { code: "DR-005", description: "Rose Milk 1L (12 pack)", costPrice: 8.2, standardPrice: 12.5, category: "Drinks" },
    { code: "GR-010", description: "Toor Dal 5kg", costPrice: 7.4, standardPrice: 10.9, category: "Grocery" },
    { code: "OL-004", description: "Sunflower Oil 5L", costPrice: 6.9, standardPrice: 9.8, category: "Grocery" },
  ].map((p) => ({ ...p, image: demoImage(p.code) }));
  const desc = (code) => products.find((p) => p.code === code)?.description || code;

  /* 4 clients */
  const clients = [
    { id: "C1", name: "Spice Market Ltd", contact: "Amir Hussain", email: "amir@spicemarket.co.uk", phone: "0121 496 0142", pincode: "B10 0AA", creditLimit: 6000, priceOverrides: { "RC-001": 20.5 }, promoIds: [], address: "142 Ladypool Road, Birmingham", lat: 52.4718, lng: -1.888 },
    { id: "C2", name: "Green Leaf Grocers", contact: "Fatima Noor", email: "fatima@greenleaf.co.uk", phone: "0161 496 0009", pincode: "M14 5RQ", creditLimit: 3500, priceOverrides: {}, promoIds: [], address: "9 Wilmslow Road, Manchester", lat: 53.4462, lng: -2.2265 },
    { id: "C3", name: "Al-Noor Wholesale", contact: "Bilal Ahmed", email: "bilal@alnoor.co.uk", phone: "0116 496 0027", pincode: "LE4 6AA", creditLimit: 9000, priceOverrides: { "FR-014": 3.1 }, promoIds: [], address: "27 Belgrave Road, Leicester", lat: 52.6461, lng: -1.1279 },
    { id: "C4", name: "Riverside Deli", contact: "Sana Iqbal", email: "sana@riversidedeli.co.uk", phone: "0117 496 0005", pincode: "BS7 8AA", creditLimit: 2000, priceOverrides: {}, promoIds: [], address: "5 Gloucester Road, Bristol", lat: 51.4779, lng: -2.5942 },
  ];

  /* 10 promotions */
  const promotions = [
    { id: "P1", code: "SPRING10", discountPct: 10, active: true, note: "10% off, spring push", clientIds: ["C1", "C2"] },
    { id: "P2", code: "DELI5", discountPct: 5, active: true, note: "5% loyalty discount", clientIds: ["C4"] },
    { id: "P3", code: "EID15", discountPct: 15, active: true, note: "Eid festive offer", clientIds: ["C1", "C3"] },
    { id: "P4", code: "BULK8", discountPct: 8, active: true, note: "Bulk order discount", clientIds: ["C3"] },
    { id: "P5", code: "FROZEN12", discountPct: 12, active: true, note: "Frozen range promotion", clientIds: ["C2", "C4"] },
    { id: "P6", code: "WELCOME20", discountPct: 20, active: true, note: "Welcome offer for new accounts", clientIds: ["C1", "C2", "C3", "C4"] },
    { id: "P7", code: "SUMMER7", discountPct: 7, active: true, note: "Summer drinks push", clientIds: ["C1", "C2", "C3"] },
    { id: "P8", code: "DIWALI10", discountPct: 10, active: false, note: "Festive season (ended)", clientIds: ["C1", "C4"] },
    { id: "P9", code: "RAMADAN12", discountPct: 12, active: false, note: "Ramadan offer (ended)", clientIds: ["C2", "C3"] },
    { id: "P10", code: "LOYAL3", discountPct: 3, active: true, note: "Loyalty discount", clientIds: ["C1", "C2", "C3", "C4"] },
    /* product-wise promotions: productCodes = only those items get the discount */
    { id: "P11", code: "RICE10", discountPct: 10, active: true, note: "10% off Basmati Rice 20kg (one product, selected clients)", clientIds: ["C1", "C3"], productCodes: ["RC-001"] },
    { id: "P12", code: "SPICE8", discountPct: 8, active: true, note: "8% off spices (multiple products, all clients)", clientIds: [], allClients: true, productCodes: ["SP-007", "SP-011"] },
  ];
  promotions.forEach((p) => { if (!p.productCodes) p.productCodes = []; });
  clients.forEach((c) => { c.promoIds = promotions.filter((p) => promoForClient(p, c.id)).map((p) => p.id); });

  /* 12 orders (2 open + 10 settled) */
  const ord = (id, clientId, placedBy, days, status, promoCode, lines, podObj) => ({ id, clientId, placedBy, date: D(days), status, promoCode, lines, pod: podObj });
  const orders = [
    ord("ORD-1001", "C1", P, -4, "With Delivery Partner", "SPRING10", [L("RC-001", 10, 20.5), L("SP-007", 5, 9.5)], null),
    ord("ORD-1002", "C3", AMT, -1, "Placed", null, [L("FR-014", 20, 3.1), L("DR-003", 8, 14)], null),
    ord("ORD-1003", "C2", P, -10, "Delivered & Invoiced", null, [L("RC-001", 60, 22), L("DR-003", 40, 14)], pod(-8)),
    ord("ORD-1004", "C4", P, -12, "Delivered & Invoiced", null, [L("SP-011", 30, 5.2), L("SP-007", 10, 9.5)], pod(-10)),
    ord("ORD-1005", "C1", AMP, -15, "Delivered & Invoiced", null, [L("RC-002", 40, 6.9), L("FR-021", 12, 8.4)], pod(-13)),
    ord("ORD-1006", "C2", P, -6, "Delivered & Invoiced", null, [L("FR-014", 50, 3.6), L("SP-011", 20, 5.2)], pod(-4)),
    ord("ORD-1007", "C3", AMT, -7, "Partially Delivered", null, [L("RC-001", 30, 22), L("FR-021", 25, 8.4)], pod(-5, false)),
    ord("ORD-1008", "C4", P, -9, "Delivered & Invoiced", null, [L("DR-003", 10, 14), L("RC-002", 20, 6.9)], pod(-7)),
    ord("ORD-1009", "C1", P, -11, "Delivered & Invoiced", null, [L("SP-007", 8, 9.5), L("SP-011", 6, 5.2)], pod(-9)),
    ord("ORD-1010", "C3", P, -20, "Delivered & Invoiced", null, [L("RC-002", 100, 6.9), L("DR-003", 20, 14)], pod(-18)),
    ord("ORD-1011", "C2", AMP, -14, "Delivered & Invoiced", null, [L("FR-021", 15, 8.4), L("FR-014", 30, 3.6)], pod(-12)),
    ord("ORD-1012", "C1", P, -3, "Delivered & Invoiced", null, [L("RC-001", 12, 20.5), L("DR-003", 6, 14)], pod(-1)),
  ];
  const O = (id) => orders.find((o) => o.id === id);

  /* 10 invoices */
  const invoices = [
    mkInv("INV-1004", O("ORD-1003"), "Outstanding", D(-8)),
    mkInv("INV-1005", O("ORD-1004"), "Paid", D(-10)),
    mkInv("INV-1006", O("ORD-1005"), "Paid", D(-13)),
    mkInv("INV-1007", O("ORD-1006"), "Outstanding", D(-4)),
    mkInv("INV-1008", O("ORD-1007"), "Outstanding", D(-5), [30, 19]),
    mkInv("INV-1009", O("ORD-1008"), "Paid", D(-7)),
    mkInv("INV-1010", O("ORD-1009"), "Paid", D(-9)),
    mkInv("INV-1011", O("ORD-1010"), "Paid", D(-18)),
    mkInv("INV-1012", O("ORD-1011"), "Paid", D(-12)),
    mkInv("INV-1013", O("ORD-1012"), "Outstanding", D(-1)),
  ];

  /* 10 backorders */
  const bo = (id, orderId, client, days, code, qty) => ({ id, orderId, client, date: D(days), code, description: desc(code), qty });
  const backorders = [
    bo(1, "ORD-1042", "Al-Noor Wholesale", -3, "FR-021", 6),
    bo(2, "ORD-1007", "Al-Noor Wholesale", -5, "FR-021", 6),
    bo(3, "ORD-1043", "Spice Market Ltd", -5, "RC-001", 15),
    bo(4, "ORD-1044", "Green Leaf Grocers", -4, "SP-011", 10),
    bo(5, "ORD-1045", "Riverside Deli", -6, "DR-003", 12),
    bo(6, "ORD-1046", "Spice Market Ltd", -2, "FR-014", 40),
    bo(7, "ORD-1047", "Al-Noor Wholesale", -8, "SP-007", 20),
    bo(8, "ORD-1048", "Green Leaf Grocers", -1, "RC-002", 25),
    bo(9, "ORD-1049", "Riverside Deli", -9, "FR-021", 8),
    bo(10, "ORD-1050", "Spice Market Ltd", -10, "DR-005", 14),
  ];

  /* 12 purchase orders (10 received + 2 pending) and 10 goods receipts */
  const po = (id, supplier, status, days, code, qty) => ({ id, supplier, status, date: D(days), lines: [{ code, qty }] });
  const purchaseOrders = [
    po("PO-2201", "Eden Farm", "Received", -9, "RC-001", 200),
    po("PO-2202", "Iceco", "Received", -18, "FR-014", 150),
    po("PO-2203", "Factory", "Received", -16, "SP-007", 120),
    po("PO-2204", "Iceco", "Received", -15, "FR-021", 80),
    po("PO-2205", "Eden Farm", "Received", -14, "RC-002", 100),
    po("PO-2206", "Factory", "Received", -13, "SP-011", 110),
    po("PO-2207", "Iceco", "Received", -12, "DR-003", 70),
    po("PO-2208", "Eden Farm", "Received", -11, "OL-004", 60),
    po("PO-2209", "Factory", "Received", -10, "GR-010", 90),
    po("PO-2210", "Iceco", "Received", -8, "DR-005", 55),
    po("PO-2211", "Eden Farm", "Pending", -2, "RC-001", 150),
    po("PO-2212", "Iceco", "Pending", -1, "FR-021", 60),
  ];
  const grDays = [-7, -16, -14, -13, -12, -11, -10, -9, -8, -6];
  const goodsReceipts = purchaseOrders.slice(0, 10).map((p, i) => ({ id: `GR-${3301 + i}`, poId: p.id, date: D(grDays[i]), status: "Booked in" }));

  /* 12 stock lines */
  const st = (n, code, source, qty, batch, days) => ({ id: `S${n}`, code, source, qty, batch, expiry: D(days) });
  const inventory = [
    st(1, "RC-001", "Eden Farm", 180, "EF-0921", 140),
    st(2, "RC-001", "Factory", 40, "FAC-0904", 160),
    st(3, "RC-002", "Iceco", 90, "IC-1187", 150),
    st(4, "FR-014", "Iceco", 60, "IC-1150", 6),
    st(5, "SP-011", "Iceco", 14, "IC-1203", 2),
    st(6, "FR-021", "Eden Farm", 35, "EF-0899", 9),
    st(7, "SP-007", "Factory", 120, "FAC-0850", 300),
    st(8, "SP-011", "Factory", 110, "FAC-0851", 300),
    st(9, "DR-003", "Iceco", 70, "IC-1201", 45),
    st(10, "DR-005", "Iceco", 55, "IC-1210", 60),
    st(11, "GR-010", "Factory", 90, "FAC-0870", 220),
    st(12, "OL-004", "Eden Farm", 60, "EF-0915", 200),
  ];

  /* 6 shipments (for delivered orders) */
  const shipments = [
    ["DPD4831201", "ORD-1003"], ["DPD4831202", "ORD-1004"], ["DPD4831203", "ORD-1005"],
    ["DPD4831204", "ORD-1006"], ["DPD4831205", "ORD-1009"], ["DPD4831206", "ORD-1010"],
  ].map(([id, orderId]) => ({ id, orderId, trackingRef: id }));

  /* 5 visits per manager = 10 (old demo visits have no check-in / check-out time) */
  const vis = (id, client, days, time, note) => ({ id, client, date: D(days), time, note });
  const areaManagers = [
    { id: "AM1", name: "Priya Shah", email: MANAGER_EMAILS.AM1, clientIds: ["C1", "C2"], visits: [
      vis("V1", "Spice Market Ltd", -2, "10:30", "Reviewed shelf stock, took new order"),
      vis("V2", "Green Leaf Grocers", -1, "14:15", "Introduced Spring promo"),
      vis("V3", "Spice Market Ltd", -6, "09:45", "Checked expiry dates on frozen range"),
      vis("V4", "Green Leaf Grocers", -8, "11:20", "Discussed credit limit increase"),
      vis("V5", "Spice Market Ltd", -12, "16:00", "Quarterly account review"),
    ] },
    { id: "AM2", name: "Tom Whitfield", email: MANAGER_EMAILS.AM2, clientIds: ["C3", "C4"], visits: [
      vis("V6", "Al-Noor Wholesale", -3, "10:00", "Discussed bulk rice pricing"),
      vis("V7", "Riverside Deli", -4, "13:30", "Introduced DELI5 loyalty offer"),
      vis("V8", "Al-Noor Wholesale", -7, "09:15", "Backorder follow-up on lamb kebabs"),
      vis("V9", "Riverside Deli", -9, "15:40", "Took repeat order"),
      vis("V10", "Al-Noor Wholesale", -13, "11:50", "New product samples delivered"),
    ] },
  ];

  /* 10 audit log entries, newest first */
  const logs = [
    ["Admin", "Generated DPD label DPD4831206 for ORD-1010"],
    ["Admin", "Marked invoice INV-1011 as paid"],
    ["Priya Shah", "Registered GPS-verified visit to Spice Market Ltd with photo"],
    ["Admin", "Created promotion LOYAL3 (3%) for 4 client(s)"],
    ["Admin", "Received goods for PO-2210, stock updated"],
    ["AI Auto-Match", "Auto-matched POD for ORD-1012, raised invoice INV-1013"],
    ["Admin", "Matched POD for ORD-1007 (partial - backorder logged), raised invoice INV-1008"],
    ["Admin", "Sent order ORD-1001 to Eden Farm for fulfilment"],
    ["Tom Whitfield", "Placed order ORD-1002 on behalf of Al-Noor Wholesale"],
    ["System", "Seeded demo data"],
  ].map(([user, action], i, arr) => ({ id: arr.length - i, ts: new Date().toLocaleString("en-GB"), user, action }));

  return {
    dataVersion: DATA_VERSION, seq: 1100, visitSeq: 0, backorderSeq: 10,
    clients, areaManagers, products, promotions, orders, backorders, invoices, payments: [], tickets: [],
    purchaseOrders, goodsReceipts, inventory, shipments, auditLog: logs, lastAutoMatch: null,
    targets: {}, // area manager targets: { AM1: { sales, collection }, ... }
  };
}

/* Demo rows for a brand-new client (10 orders, 6 invoices, 3 offers) so its pages are never empty */
function seedClientDemo(d, c) {
  const prods = d.products;
  if (!prods.length) return;
  const plan = [ // [status, daysAgo, [[productIndex, qty], ...], invoiceStatus]
    ["Placed", 0, [[0, 5], [4, 3]], null],
    ["Placed", -1, [[2, 20], [6, 4]], null],
    ["With Delivery Partner", -3, [[1, 15], [3, 6]], null],
    ["With Delivery Partner", -4, [[5, 10], [8, 4]], null],
    ["Delivered & Invoiced", -6, [[0, 6], [7, 4]], "Outstanding"],
    ["Delivered & Invoiced", -9, [[2, 25], [4, 5]], "Outstanding"],
    ["Delivered & Invoiced", -12, [[1, 20], [9, 3]], "Outstanding"],
    ["Delivered & Invoiced", -16, [[3, 8], [5, 12]], "Paid"],
    ["Delivered & Invoiced", -21, [[6, 10], [0, 4]], "Paid"],
    ["Delivered & Invoiced", -28, [[8, 10], [7, 6]], "Paid"],
  ];
  plan.forEach(([status, days, picks, invStatus]) => {
    const lines = picks.map(([i, qty]) => {
      const p = prods[i % prods.length];
      return { code: p.code, qty, price: c.priceOverrides?.[p.code] ?? p.standardPrice };
    });
    const o = { id: nextId("ORD"), clientId: c.id, placedBy: "Client portal", date: todayISO(days), status, promoCode: null, lines, pod: invStatus ? { matched: true, checkedOn: todayISO(days + 2) } : null };
    d.orders.push(o);
    if (invStatus) d.invoices.push(mkInv(nextId("INV"), o, invStatus, todayISO(days + 2)));
  });
  d.promotions.forEach((p) => {
    if (["SPRING10", "WELCOME20", "LOYAL3"].includes(p.code)) {
      if (!p.clientIds.includes(c.id)) p.clientIds.push(c.id);
      if (!c.promoIds.includes(p.id)) c.promoIds.push(p.id);
    }
  });
  log("System", `Demo data added for ${c.name}`);
}

/* One-time top-up of an older saved database. Adds missing demo rows; never removes anything. */
function upgrade(d) {
  const s = seed();
  /* rename the old order status so saved databases keep working */
  (d.orders || []).forEach((o) => { if (o.status === "With Eden Farm") o.status = "With Delivery Partner"; });
  ["products", "promotions", "orders", "backorders", "invoices", "payments", "tickets", "purchaseOrders", "goodsReceipts", "inventory", "shipments", "auditLog"]
    .forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  d.inventory.forEach((i) => { if (!i.id) i.id = `S-${Math.random().toString(36).slice(2, 8)}`; });
  const addNew = (key, same) => {
    const added = [];
    s[key].forEach((r) => { if (!d[key].some((x) => same(x, r))) { d[key].push(r); added.push(r); } });
    return added;
  };
  addNew("products", (a, b) => a.code === b.code);
  /* saved demo products without a picture get theirs (pictures a user uploaded are never replaced) */
  s.products.forEach((sp) => {
    const p = d.products.find((x) => x.code === sp.code);
    if (p && !p.image) p.image = sp.image;
  });
  addNew("promotions", (a, b) => a.id === b.id || a.code === b.code);
  const newOrders = new Set(addNew("orders", (a, b) => a.id === b.id).map((o) => o.id));
  addNew("backorders", (a, b) => a.id === b.id);
  s.invoices.filter((r) => newOrders.has(r.orderId) && !d.invoices.some((x) => x.id === r.id)).forEach((r) => d.invoices.push(r));
  s.shipments.filter((r) => newOrders.has(r.orderId) && !d.shipments.some((x) => x.id === r.id)).forEach((r) => d.shipments.push(r));
  addNew("purchaseOrders", (a, b) => a.id === b.id);
  addNew("goodsReceipts", (a, b) => a.id === b.id || a.poId === b.poId);
  addNew("inventory", (a, b) => a.code === b.code && a.batch === b.batch);
  s.areaManagers.forEach((sm) => {
    const m = d.areaManagers.find((x) => x.id === sm.id);
    if (m && m.visits.length < 5) sm.visits.forEach((v) => { if (!m.visits.some((x) => x.client === v.client && x.note === v.note)) m.visits.push(v); });
  });
  /* clients saved before phone / pincode existed: fill the demo clients, leave the rest blank */
  s.clients.forEach((sc) => {
    const c = d.clients.find((x) => x.id === sc.id);
    if (c) { if (c.phone == null) c.phone = sc.phone; if (c.pincode == null) c.pincode = sc.pincode; }
  });
  d.clients.forEach((c) => { if (c.phone == null) c.phone = ""; if (c.pincode == null) c.pincode = ""; });
  syncPromoIds(d);
  d.clients.forEach((c) => { if (!d.orders.some((o) => o.clientId === c.id)) seedClientDemo(d, c); });
  d.seq = Math.max(d.seq || 0, 1100);
  d.backorderSeq = Math.max(d.backorderSeq || 0, 10);
  d.dataVersion = DATA_VERSION;
}
/* A promo reaches a client when it is set to "all clients" or the client is ticked */
const promoForClient = (p, clientId) => !!p.allClients || (p.clientIds || []).includes(clientId);
/* A promo covers an item when it has no product list (= every product) or the item is in the list */
const promoCoversItem = (p, code) => !(p.productCodes || []).length || p.productCodes.includes(code);
function syncPromoIds(d) {
  d.promotions.forEach((p) => { if (!Array.isArray(p.productCodes)) p.productCodes = []; if (!Array.isArray(p.clientIds)) p.clientIds = []; });
  d.clients.forEach((c) => { c.promoIds = d.promotions.filter((p) => promoForClient(p, c.id)).map((p) => p.id); });
}

/* Every client must be covered by an area manager (placeOrder rejects "<manager> does not cover <client>").
   A client nobody covers is given to the manager who looks after the fewest clients. Returns true if anything changed. */
function coverUnassigned(d) {
  const ms = d.areaManagers || [];
  if (!ms.length) return false;
  let changed = false;
  (d.clients || []).forEach((c) => {
    if (ms.some((m) => (m.clientIds || []).includes(c.id))) return;
    const m = ms.reduce((a, b) => ((b.clientIds || []).length < (a.clientIds || []).length ? b : a));
    m.clientIds = [...(m.clientIds || []), c.id];
    changed = true;
  });
  return changed;
}

/* ---------------- storage ---------------- */
let db = null;
function load() {
  if (db) return db;
  try { const raw = localStorage.getItem(KEY); if (raw) db = JSON.parse(raw); } catch { /* ignore */ }
  if (!db || !db.clients) { db = seed(); persist(); }

  let changed = false;

  // ALWAYS rename the old status, even when dataVersion is already 6
  (db.orders || []).forEach((o) => {
    if (o.status === "With Eden Farm") { o.status = "With Delivery Partner"; changed = true; }
  });

  // Older saved databases have no payments / tickets list yet.
  if (!Array.isArray(db.payments)) { db.payments = []; changed = true; }
  if (!Array.isArray(db.tickets)) { db.tickets = []; changed = true; }
  // Older saved databases have no area manager targets yet.
  if (!db.targets || typeof db.targets !== "object" || Array.isArray(db.targets)) { db.targets = {}; changed = true; }

  // Repair area managers saved without clients, visit list or email.
  (db.areaManagers || []).forEach((m) => {
    if (!Array.isArray(m.visits)) { m.visits = []; changed = true; }
    if (!Array.isArray(m.clientIds) || !m.clientIds.length) { m.clientIds = db.clients.map((c) => c.id); changed = true; }
    if (m.email == null) { m.email = MANAGER_EMAILS[m.id] || ""; changed = true; }
  });
  // A client with no credit limit (0) could never place an order: give it the default limit.
  (db.clients || []).forEach((c) => { if (!c.creditLimit) { c.creditLimit = 3000; changed = true; } });
  // Clients nobody covers (e.g. added from the Customer List) are given to an area manager.
  if (coverUnassigned(db)) changed = true;
  if ((db.dataVersion || 0) < DATA_VERSION) { upgrade(db); changed = true; }
  if (changed) persist();
  return db;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { /* storage full/blocked: keep working in memory for this tab */ }
}
/* unique id like ORD-1101 (never clashes with an existing id) */
function nextId(prefix) {
  const d = load();
  const used = new Set();
  [d.orders, d.invoices, d.payments, d.tickets, d.purchaseOrders, d.goodsReceipts, d.promotions, d.inventory, d.shipments].forEach((l) => (l || []).forEach((x) => used.add(x.id)));
  (d.areaManagers || []).forEach((m) => (m.visits || []).forEach((v) => used.add(v.id)));
  let id;
  do { d.seq += 1; id = `${prefix}-${d.seq}`; } while (used.has(id));
  return id;
}
function log(user, action) {
  const d = load();
  const id = (d.auditLog[0]?.id || 0) + 1;
  d.auditLog.unshift({ id, ts: new Date().toLocaleString("en-GB"), user, action: String(action).slice(0, 500) });
  d.auditLog.length = Math.min(d.auditLog.length, 500);
}
const need = (list, test, msg) => list.find(test) || fail(msg);

export function resetHubDb() { db = seed(); persist(); }

/* ---------------- identities created by Register ---------------- */
export function createClientAccount({ company, contact, email, address, phone = "", pincode = "" }) {
  const d = load();
  const nums = d.clients.map((c) => Number(c.id.slice(1))).filter(Number.isFinite);
  const id = `C${Math.max(0, ...nums) + 1}`;
  const c = {
    id, name: company, contact, email,
    phone: cleanPhone(phone), pincode: cleanPincode(pincode),
    creditLimit: 3000, priceOverrides: {}, promoIds: [], address: address || "-", lat: null, lng: null,
  };
  d.clients.push(c);
  log("System", `New client account registered: ${company}`);
  seedClientDemo(d, c); // so Dashboard / Invoices / Statement / Offers are not empty
  persist();
  return id;
}
export function createManagerAccount({ name, email = "", clientIds = [] }) {
  const d = load();
  const nums = d.areaManagers.map((m) => Number(m.id.slice(2))).filter(Number.isFinite);
  const id = `AM${Math.max(0, ...nums) + 1}`;
  const valid = (Array.isArray(clientIds) ? clientIds : []).filter((cid) => d.clients.some((c) => c.id === cid));
  const assigned = valid.length ? valid : d.clients.map((c) => c.id);
  const notes = ["Reviewed shelf stock", "Discussed new offers", "Took repeat order", "Checked expiry dates", "Introduced new products"];
  const visits = notes.map((note, i) => ({
    id: nextId("V"), client: d.clients.find((c) => c.id === assigned[i % assigned.length]).name,
    date: todayISO(-(i + 1)), time: "11:00", note,
  }));
  d.areaManagers.push({ id, name, email: String(email || "").trim().toLowerCase(), clientIds: assigned, visits });
  log("System", `New area manager registered: ${name}`);
  persist();
  return id;
}
export const listClients = () => load().clients.map((c) => ({ id: c.id, name: c.name }));

/* Area manager sign-in location (saved at login, shown to admin in Live Managers) */
export function saveManagerLocation(managerId, { lat, lng, accuracy } = {}) {
  const d = load();
  const m = d.areaManagers.find((x) => x.id === managerId);
  if (!m) return false;
  m.location = {
    lat: Number(lat),
    lng: Number(lng),
    accuracy: accuracy == null ? null : Math.round(accuracy),
    at: new Date().toISOString(),
  };
  log(m.name, "Signed in with location on");
  persist();
  return true;
}

export const listManagerLocations = () =>
  load().areaManagers.map((m) => ({ id: m.id, name: m.name, location: m.location || null }));

/* used by "Forgot password": the email on file for a client / area manager account */
export function getAccountContact(linkedId) {
  const d = load();
  const c = d.clients.find((x) => x.id === linkedId);
  if (c) return { email: c.email || "" };
  const m = d.areaManagers.find((x) => x.id === linkedId);
  if (m) return { email: m.email || "" };
  return null;
}

/* ---------------- read ---------------- */
const getState = () => clone(load());

function forecast() {
  const d = load();
  return d.products.map((p) => {
    const demand = d.orders.reduce((s, o) => s + o.lines.filter((l) => l.code === p.code).reduce((a, l) => a + l.qty, 0), 0);
    const stock = d.inventory.filter((i) => i.code === p.code).reduce((s, i) => s + i.qty, 0);
    const weekly = Math.max(demand, 1);
    const cover = Math.round(stock / (weekly / 7));
    const suggested = Math.max(0, Math.round(weekly * 2 - stock));
    const label = cover <= 10 ? "Reorder now" : cover <= 25 ? "Reorder soon" : "Healthy";
    const tone = cover <= 10 ? "red" : cover <= 25 ? "orange" : "green";
    return { id: p.code, code: p.code, description: p.description, demand, stock, cover, suggested, label, tone };
  }).sort((a, b) => a.cover - b.cover);
}
function salesReport() {
  const d = load();
  const byClient = d.clients.map((c) => ({
    id: c.id, name: c.name,
    total: round2(d.orders.filter((o) => o.clientId === c.id).reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty * l.price, 0), 0)),
  })).filter((r) => d.orders.some((o) => o.clientId === r.id)).sort((a, b) => b.total - a.total);
  return {
    orderValue: round2(byClient.reduce((s, r) => s + r.total, 0)),
    invoicedValue: round2(d.invoices.reduce((s, i) => s + i.amount, 0)),
    ordersPlaced: d.orders.length, byClient,
  };
}
/* money still owed by a client: Outstanding invoices minus any part payments already made */
const balanceOf = (clientId) => load().invoices.filter((i) => i.clientId === clientId && i.status === "Outstanding").reduce((s, i) => s + (i.amount - (i.paid || 0)), 0);
function creditControl() {
  return load().clients.map((c) => { const b = balanceOf(c.id); return { id: c.id, name: c.name, creditLimit: c.creditLimit, balance: round2(b), over: b > c.creditLimit }; });
}
function stockExpiry() {
  const d = load();
  return d.inventory.map((i) => {
    const p = d.products.find((x) => x.code === i.code);
    const days = daysUntil(i.expiry);
    return { id: i.id, code: i.code, description: p?.description || "", source: i.source, batch: i.batch, qty: i.qty, expiry: i.expiry, days, tone: days <= 7 ? "red" : days <= 30 ? "orange" : "green" };
  }).sort((a, b) => a.expiry.localeCompare(b.expiry));
}

/* ---------------- actions: orders ---------------- */
function priceLines(d, c, lines, promoCode) {
  const wanted = (Array.isArray(lines) ? lines : []).map((l) => ({ code: String(l?.code || ""), qty: Number(l?.qty) || 0 })).filter((l) => l.qty > 0);
  if (!wanted.length) fail("Add a quantity to at least one item.");
  wanted.forEach((l) => wholeNumber(l.qty, `Quantity for ${l.code}`, { min: 1, max: 100000 }));
  const priced = wanted.map((l) => {
    const p = d.products.find((x) => x.code === l.code) || fail(`Unknown item ${l.code}.`);
    return { code: l.code, qty: l.qty, price: c.priceOverrides[l.code] != null ? c.priceOverrides[l.code] : p.standardPrice };
  });
  let promoNote = null;
  const code = String(promoCode || "").trim().toUpperCase();
  if (code) {
    const pr = d.promotions.find((p) => p.code === code && p.active && promoForClient(p, c.id));
    if (!pr) fail("That promo code is not valid on this account.");
    const hit = priced.filter((l) => promoCoversItem(pr, l.code));
    if (!hit.length) {
      const names = pr.productCodes.map((pc) => d.products.find((x) => x.code === pc)?.description || pc).join(", ");
      fail(`Promo ${pr.code} only applies to: ${names}. None of those are in this order.`);
    }
    hit.forEach((l) => { l.price = round2(l.price * (1 - pr.discountPct / 100)); });
    promoNote = pr.code;
  }
  return { priced, promoNote };
}

/* REMARK: the client remark is optional, trimmed and limited to 250 characters.
   (`remark` is the old single field; it is treated as the client remark.)
   ONSITE / OFFSITE: only for orders placed by an area manager.
   visitType = "onsite" | "offsite", visitDistanceKm = distance from the client store (or null). */
function placeOrder({ clientId, lines, promoCode = "", placedBy = "Client portal", remark = "", clientRemark = "", managerRemark = "", visitType = "", visitDistanceKm = null }) {
  const d = load();
  const c = need(d.clients, (x) => x.id === clientId, "Unknown client.");
  let logUser = c.name, placedByText = "Client portal";
  const mgrName = typeof placedBy === "string" && placedBy.startsWith("Area manager: ") ? placedBy.slice(14) : null;
  if (mgrName) {
    const m = d.areaManagers.find((x) => x.name === mgrName && x.clientIds.includes(clientId));
    if (!m) fail(`${mgrName} does not cover ${c.name}.`);
    placedByText = `Area manager: ${m.name}`; logUser = m.name;
  }
  const { priced, promoNote } = priceLines(d, c, lines, promoCode);
  const total = priced.reduce((s, l) => s + l.qty * l.price, 0);
  const projected = balanceOf(clientId) + total;
  if (projected > c.creditLimit) fail(`This order would put ${c.name} at ${gbp(projected)}, over the ${gbp(c.creditLimit)} credit limit. Contact the account manager to proceed.`);
  const clientNote = String(clientRemark || remark || "").trim().slice(0, MAX_ORDER_REMARK); // REMARK
  const managerNote = mgrName ? String(managerRemark || "").trim().slice(0, MAX_ORDER_REMARK) : ""; // only when an area manager places it

  /* ONSITE / OFFSITE (area manager orders only) */
  const vType = mgrName && ["onsite", "offsite"].includes(visitType) ? visitType : "";
  const vNum = Number(visitDistanceKm);
  const vDist = vType && visitDistanceKm != null && visitDistanceKm !== "" && Number.isFinite(vNum) && vNum >= 0
    ? Math.round(vNum * 1000) / 1000
    : null;

  const id = nextId("ORD");
  const order = {
    id, clientId, placedBy: placedByText, date: todayISO(0), status: "Placed", promoCode: promoNote, lines: priced, pod: null,
    remark: clientNote, clientRemark: clientNote, managerRemark: managerNote, // REMARK
    visitType: vType, visitDistanceKm: vDist,
  };
  d.orders.push(order);
  log(logUser, mgrName
    ? `Placed ${vType ? vType.toUpperCase() + " " : ""}order ${id} on behalf of ${c.name}`
    : `Placed order ${id}${promoNote ? " using promo " + promoNote : ""}`);
  persist();
  return { ok: true, msg: `Order ${id} placed for ${c.name} - ${gbp(total)}.`, order: clone(order) };
}

/* EDIT an order (only while it is still "Placed") */
function updateOrder(orderId, { lines, promoCode = "" } = {}) {
  const d = load();
  const o = need(d.orders, (x) => x.id === orderId, "Order not found.");
  if (o.status !== "Placed") fail(`Order ${o.id} is "${o.status}" - only Placed orders can be edited.`);
  const c = need(d.clients, (x) => x.id === o.clientId, "Unknown client.");
  const { priced, promoNote } = priceLines(d, c, lines, promoCode);
  const total = priced.reduce((s, l) => s + l.qty * l.price, 0);
  const projected = balanceOf(c.id) + total;
  if (projected > c.creditLimit) fail(`This change would put ${c.name} at ${gbp(projected)}, over the ${gbp(c.creditLimit)} credit limit.`);
  o.lines = priced; o.promoCode = promoNote;
  log("Admin", `Edited order ${o.id}`);
  persist();
  return { ok: true, msg: `Order ${o.id} updated - ${gbp(total)}.` };
}
/* DELETE an order together with everything that hangs off it */
function deleteOrder(orderId) {
  const d = load();
  const o = need(d.orders, (x) => x.id === orderId, "Order not found.");
  d.orders = d.orders.filter((x) => x.id !== o.id);
  d.invoices = d.invoices.filter((i) => i.orderId !== o.id);
  d.payments = d.payments.filter((p) => p.orderId !== o.id);
  d.tickets = (d.tickets || []).filter((t) => t.orderId !== o.id);
  d.backorders = d.backorders.filter((b) => b.orderId !== o.id);
  d.shipments = d.shipments.filter((s) => s.orderId !== o.id);
  log("Admin", `Deleted order ${o.id}`);
  persist();
  return { ok: true, msg: `Order ${o.id} deleted.` };
}

function sendToEdenFarm(orderId) {
  const o = need(load().orders, (x) => x.id === orderId, "Order not found.");
  if (o.status !== "Placed") fail(`Order ${o.id} is already "${o.status}" - only Placed orders can be sent.`);
  o.status = "With Delivery Partner";
  log("Admin", `Sent order ${o.id} to Eden Farm for fulfilment`);
  persist();
  return { ok: true, msg: `Order ${o.id} sent to Eden Farm.` };
}

function settleOrder(o, delivered, by) {
  const d = load();
  const cl = d.clients.find((c) => c.id === o.clientId);
  let allMatched = true;
  const matched = [];
  o.lines.forEach((l, i) => {
    const q = delivered[i];
    if (q < l.qty) {
      allMatched = false;
      const p = d.products.find((x) => x.code === l.code);
      d.backorderSeq += 1;
      d.backorders.push({ id: d.backorderSeq, orderId: o.id, client: cl.name, date: todayISO(0), code: l.code, description: p?.description || l.code, qty: l.qty - q });
    }
    if (q > 0) matched.push({ qty: Math.min(q, l.qty), price: l.price });
  });
  o.status = allMatched ? "Delivered & Invoiced" : "Partially Delivered";
  o.pod = { matched: allMatched, checkedOn: todayISO(0), ...(by ? { by } : {}) };
  let invoice = null;
  const amt = matched.reduce((s, l) => s + l.qty * l.price, 0);
  if (amt > 0) {
    const vat = round2(amt * VAT_RATE);
    invoice = { id: nextId("INV"), clientId: o.clientId, orderId: o.id, amount: round2(amt + vat), vat, status: "Outstanding", date: todayISO(0) };
    d.invoices.push(invoice);
  }
  return { allMatched, invoice, clientName: cl.name };
}

function matchPOD(orderId, delivered, signatureOk) {
  if (!signatureOk) fail("No valid signature - POD rejected. Order stays with the Delivery Partner.");
  const o = need(load().orders, (x) => x.id === orderId, "Order not found.");
  if (o.status !== "With Delivery Partner") fail(`Order ${o.id} is not waiting for a proof of delivery.`);
  if (!Array.isArray(delivered) || delivered.length !== o.lines.length) fail("Send one delivered quantity for every order line.");
  const qtys = delivered.map((x, i) => wholeNumber(x, `Delivered quantity for line ${i + 1}`));
  const r = settleOrder(o, qtys, null);
  log("Admin", `Matched POD for ${o.id}${r.allMatched ? "" : " (partial - backorder logged)"}${r.invoice ? ", raised invoice " + r.invoice.id : ""}`);
  persist();
  return { ok: true, msg: `POD matched for ${o.id}.${r.invoice ? " Invoice " + r.invoice.id + " raised." : " Nothing delivered, so no invoice raised."}` };
}

function runAutoMatch() {
  const d = load();
  const rows = [];
  for (const o of d.orders.filter((x) => x.status === "With Delivery Partner")) {
    const qtys = o.lines.map((l) => (Math.random() < 0.15 ? Math.max(0, l.qty - Math.ceil(l.qty * 0.2)) : l.qty));
    const r = settleOrder(o, qtys, "AI auto-match");
    const inv = r.invoice ? r.invoice.id : null;
    rows.push({ id: o.id, orderId: o.id, client: r.clientName, result: r.allMatched ? `Fully matched - invoice ${inv} raised` : `Partial - ${inv ? "invoice " + inv + " raised, " : ""}shortfall backordered` });
    log("AI Auto-Match", `Auto-matched POD for ${o.id}${r.allMatched ? "" : " (partial - backorder logged)"}${inv ? ", raised invoice " + inv : ""}`);
  }
  d.lastAutoMatch = rows;
  persist();
  return { ok: true, msg: rows.length ? `Auto-matched ${rows.length} order(s).` : "Nothing was waiting on a POD.", rows };
}

/* ---------------- actions: purchase orders / goods ---------------- */
function createPO({ supplier = "Eden Farm", code, qty, logUser = "Admin", note = "", remarks = "" }) {
  const d = load();
  const sup = String(supplier || "").trim().slice(0, 120) || "Eden Farm";
  const n = wholeNumber(qty, "Quantity", { min: 1 });
  need(d.products, (p) => p.code === code, `Unknown item ${code}.`);
  const user = ["Admin", "AI Forecast"].includes(logUser) ? logUser : "Admin";
  const id = nextId("PO");
  const po = {
    id, supplier: sup, status: "Pending", date: todayISO(0),
    lines: [{ code, qty: n }],
    remarks: String(remarks || "").trim().slice(0, 400),
  };
  d.purchaseOrders.push(po);
  log(user, String(note || "").slice(0, 400) || `Raised ${id} to ${sup} for ${n} x ${code}`);
  persist();
  return { ok: true, msg: `${id} raised.`, po: clone(po) };
}
function updatePO(poId, { supplier, code, qty } = {}) {
  const d = load();
  const po = need(d.purchaseOrders, (x) => x.id === poId, "Purchase order not found.");
  if (po.status !== "Pending") fail(`${po.id} is already received - it can no longer be edited.`);
  if (supplier != null) po.supplier = text(supplier, "Supplier");
  if (code != null) { need(d.products, (p) => p.code === code, `Unknown item ${code}.`); po.lines[0].code = code; }
  if (qty != null) po.lines[0].qty = wholeNumber(qty, "Quantity", { min: 1 });
  log("Admin", `Edited ${po.id}`);
  persist();
  return { ok: true, msg: `${po.id} updated.` };
}
function deletePO(poId) {
  const d = load();
  const po = need(d.purchaseOrders, (x) => x.id === poId, "Purchase order not found.");
  d.purchaseOrders = d.purchaseOrders.filter((x) => x.id !== po.id);
  d.goodsReceipts = d.goodsReceipts.filter((g) => g.poId !== po.id);
  d.inventory = d.inventory.filter((i) => i.batch !== po.id); // stock booked in from this PO
  log("Admin", `Deleted ${po.id}`);
  persist();
  return { ok: true, msg: `${po.id} deleted.` };
}
function raisePOFromBackorder(id) {
  const b = need(load().backorders, (x) => x.id === Number(id), "Backorder not found.");
  return createPO({ supplier: "Eden Farm", code: b.code, qty: b.qty, note: `Raised replenishment PO to cover ${b.qty} x ${b.code} for backorder on ${b.orderId}` });
}
function updateBackorder(id, { qty } = {}) {
  const b = need(load().backorders, (x) => x.id === Number(id), "Backorder not found.");
  b.qty = wholeNumber(qty, "Quantity", { min: 1 });
  log("Admin", `Edited backorder #${b.id} (${b.code}) to ${b.qty}`);
  persist();
  return { ok: true, msg: "Backorder updated." };
}
function deleteBackorder(id) {
  const d = load();
  const b = need(d.backorders, (x) => x.id === Number(id), "Backorder not found.");
  d.backorders = d.backorders.filter((x) => x.id !== b.id);
  log("Admin", `Deleted backorder #${b.id}`);
  persist();
  return { ok: true, msg: "Backorder deleted." };
}
function receiveGoods(poId) {
  const d = load();
  const po = need(d.purchaseOrders, (x) => x.id === poId, "Purchase order not found.");
  if (po.status !== "Pending") fail(`${po.id} has already been received.`);
  po.status = "Received";
  po.lines.forEach((l) => d.inventory.push({ id: nextId("S"), code: l.code, source: po.supplier, qty: l.qty, batch: po.id, expiry: todayISO(120) }));
  const gr = nextId("GR");
  d.goodsReceipts.push({ id: gr, poId: po.id, date: todayISO(0), status: "Booked in" });
  log("Admin", `Received goods for ${po.id}, stock updated`);
  persist();
  return { ok: true, msg: `Goods received for ${po.id} (${gr}).` };
}

/* ---------------- actions: stock ---------------- */
function addStock({ code, source, qty, batch, expiry }) {
  const d = load();
  need(d.products, (p) => p.code === code, `Unknown item ${code}.`);
  if (!isDate(expiry)) fail("Enter a valid expiry date.");
  const row = { id: nextId("S"), code, source: text(source, "Source", 60), qty: wholeNumber(qty, "Quantity", { min: 1 }), batch: text(batch, "Batch", 40), expiry };
  d.inventory.push(row);
  log("Admin", `Added stock ${row.qty} x ${code} (batch ${row.batch})`);
  persist();
  return { ok: true, msg: "Stock line added." };
}
function updateStock(id, b = {}) {
  const d = load();
  const s = need(d.inventory, (x) => x.id === id, "Stock line not found.");
  if (b.code != null) { need(d.products, (p) => p.code === b.code, `Unknown item ${b.code}.`); s.code = b.code; }
  if (b.source != null) s.source = text(b.source, "Source", 60);
  if (b.qty != null) s.qty = wholeNumber(b.qty, "Quantity");
  if (b.batch != null) s.batch = text(b.batch, "Batch", 40);
  if (b.expiry != null) { if (!isDate(b.expiry)) fail("Enter a valid expiry date."); s.expiry = b.expiry; }
  log("Admin", `Edited stock line ${s.code} (batch ${s.batch})`);
  persist();
  return { ok: true, msg: "Stock line updated." };
}
function deleteStock(id) {
  const d = load();
  const s = need(d.inventory, (x) => x.id === id, "Stock line not found.");
  d.inventory = d.inventory.filter((x) => x.id !== s.id);
  log("Admin", `Deleted stock line ${s.code} (batch ${s.batch})`);
  persist();
  return { ok: true, msg: "Stock line deleted." };
}

/* ---------------- actions: products / prices ---------------- */
const codeOk = (c) => /^[A-Z0-9_-]{2,20}$/.test(c);

/* product image: "" (none) | uploaded picture (data URL) | a link */
const MAX_IMAGE_CHARS = 400000;
function cleanImage(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^data:image\/(jpeg|png|webp);base64,/.test(s)) {
    if (s.length > MAX_IMAGE_CHARS) fail("Product image is too large. Choose a smaller picture.");
    return s;
  }
  if (/^(https?:\/\/|\/)/.test(s) && s.length <= 500) return s;
  fail("Product image must be an uploaded picture or a valid link.");
}
function addProduct({ code, description, costPrice, standardPrice, category, image = "" }) {
  const d = load();
  const c = String(code || "").trim().toUpperCase();
  if (!codeOk(c)) fail("Item code must be 2-20 letters / numbers (e.g. RC-003).");
  if (d.products.some((p) => p.code === c)) fail(`Item ${c} already exists.`);
  d.products.push({
    code: c,
    description: text(description, "Description"),
    costPrice: money(costPrice, "Cost price"),
    standardPrice: money(standardPrice, "Standard price"),
    category: String(category || "General").trim().slice(0, 40) || "General",
    image: cleanImage(image),
  });
  log("Admin", `Added item ${c}`);
  if (!persistChecked()) {
    d.products.pop(); d.auditLog.shift();
    fail("Browser storage is full, so the item was not saved. Use a smaller image.");
  }
  return { ok: true, msg: `Item ${c} added.` };
}
function updateProduct(code, b = {}) {
  const d = load();
  const p = need(d.products, (x) => x.code === code, `Unknown item ${code}.`);
  const prevImage = p.image || "";
  if (b.description != null) p.description = text(b.description, "Description");
  if (b.costPrice != null) p.costPrice = money(b.costPrice, "Cost price");
  if (b.standardPrice != null) p.standardPrice = money(b.standardPrice, "Standard price");
  if (b.category != null) p.category = String(b.category).trim().slice(0, 40) || "General";
  if (b.image != null) p.image = cleanImage(b.image);
  log("Admin", `Edited item ${code}`);
  if (!persistChecked()) {
    p.image = prevImage; d.auditLog.shift();
    fail("Browser storage is full, so the change was not saved. Use a smaller image.");
  }
  return { ok: true, msg: `Item ${code} updated.` };
}
function deleteProduct(code) {
  const d = load();
  const p = need(d.products, (x) => x.code === code, `Unknown item ${code}.`);
  if (d.orders.some((o) => o.lines.some((l) => l.code === code))) fail(`${code} is used on existing orders - delete those orders first.`);
  if (d.purchaseOrders.some((o) => o.lines.some((l) => l.code === code))) fail(`${code} is used on purchase orders - delete those first.`);
  d.products = d.products.filter((x) => x.code !== p.code);
  d.inventory = d.inventory.filter((i) => i.code !== code);
  d.backorders = d.backorders.filter((b) => b.code !== code);
  d.clients.forEach((c) => { delete c.priceOverrides[code]; });
  log("Admin", `Deleted item ${code}`);
  persist();
  return { ok: true, msg: `Item ${code} deleted.` };
}
function saveStandardPrice(code, value) {
  const d = load();
  const price = money(value, "Standard price");
  const p = need(d.products, (x) => x.code === code, `Unknown item ${code}.`);
  p.standardPrice = price;
  log("Admin", `Updated standard price of ${code} to ${gbp(price)}`);
  persist();
  return { ok: true, msg: `Standard price of ${code} is now ${gbp(price)}.` };
}
function saveOverride(clientId, code, value) {
  const d = load();
  const price = money(value, "Override price");
  const c = need(d.clients, (x) => x.id === clientId, "Unknown client.");
  need(d.products, (x) => x.code === code, `Unknown item ${code}.`);
  c.priceOverrides[code] = price;
  log("Admin", `Set override price for ${c.name} on ${code}: ${gbp(price)}`);
  persist();
  return { ok: true, msg: `Override saved for ${c.name} on ${code}.` };
}
function deleteOverride(clientId, code) {
  const c = need(load().clients, (x) => x.id === clientId, "Unknown client.");
  if (c.priceOverrides[code] == null) fail("No override exists for that item.");
  delete c.priceOverrides[code];
  log("Admin", `Removed override price for ${c.name} on ${code}`);
  persist();
  return { ok: true, msg: `Override removed for ${c.name} on ${code}.` };
}

/* ---------------- actions: clients ---------------- */
function addClient({ name, contact, email, phone = "", pincode = "", creditLimit = 3000, address = "" }) {
  const d = load();
  const nums = d.clients.map((c) => Number(c.id.slice(1))).filter(Number.isFinite);
  const id = `C${Math.max(0, ...nums) + 1}`;
  d.clients.push({
    id, name: text(name, "Company name"), contact: text(contact, "Contact"), email: text(email, "Email"),
    phone: cleanPhone(phone), pincode: cleanPincode(pincode),
    creditLimit: money(creditLimit, "Credit limit"), priceOverrides: {}, promoIds: [],
    address: String(address || "-").slice(0, 200), lat: null, lng: null,
  });
  coverUnassigned(d); // the new client goes to an area manager straight away
  log("Admin", `Added client ${name}`);
  persist();
  return { ok: true, msg: `Client ${name} added.`, id };
}
function updateClient(id, b = {}) {
  const c = need(load().clients, (x) => x.id === id, "Unknown client.");
  if (b.name != null) c.name = text(b.name, "Company name");
  if (b.contact != null) c.contact = text(b.contact, "Contact");
  if (b.email != null) c.email = text(b.email, "Email");
  if (b.phone != null) c.phone = cleanPhone(b.phone);
  if (b.address != null) c.address = String(b.address).slice(0, 200);
  if (b.pincode != null) c.pincode = cleanPincode(b.pincode);
  if (b.creditLimit != null) c.creditLimit = money(b.creditLimit, "Credit limit");
  log("Admin", `Edited client ${c.name}`);
  persist();
  return { ok: true, msg: `Client ${c.name} updated.` };
}
function deleteClient(id) {
  const d = load();
  const c = need(d.clients, (x) => x.id === id, "Unknown client.");
  const orderIds = new Set(d.orders.filter((o) => o.clientId === id).map((o) => o.id));
  d.orders = d.orders.filter((o) => o.clientId !== id);
  d.invoices = d.invoices.filter((i) => i.clientId !== id);
  d.payments = d.payments.filter((p) => p.clientId !== id);
  d.tickets = (d.tickets || []).filter((t) => t.clientId !== id);
  d.shipments = d.shipments.filter((s) => !orderIds.has(s.orderId));
  d.backorders = d.backorders.filter((b) => b.client !== c.name);
  d.promotions.forEach((p) => { p.clientIds = p.clientIds.filter((x) => x !== id); });
  d.areaManagers.forEach((m) => { m.clientIds = m.clientIds.filter((x) => x !== id); });
  d.clients = d.clients.filter((x) => x.id !== id);
  log("Admin", `Deleted client ${c.name} and its orders / invoices`);
  persist();
  return { ok: true, msg: `Client ${c.name} deleted.` };
}

/* ---------------- actions: promotions ---------------- */
function cleanProductCodes(d, list) {
  const codes = [...new Set(Array.isArray(list) ? list : [])];
  if (codes.some((pc) => !d.products.find((x) => x.code === pc))) fail("One or more products do not exist.");
  return codes; // [] = every product
}
function createPromotion({ code, pct, clientIds, allClients = false, productCodes = [], note } = {}) {
  const d = load();
  const promoCode = String(code || "").trim().toUpperCase();
  const discount = Number(pct);
  const everyone = !!allClients;
  const ids = everyone ? [] : [...new Set(Array.isArray(clientIds) ? clientIds : [])];
  if (!/^[A-Z0-9_-]{2,40}$/.test(promoCode) || !(discount > 0 && discount <= 100)) fail("Fill in a code (letters / numbers) and a discount % (1-100).");
  if (!everyone && !ids.length) fail("Pick at least one client, or choose All clients.");
  if (ids.some((id) => !d.clients.find((c) => c.id === id))) fail("One or more clients do not exist.");
  const products = cleanProductCodes(d, productCodes);
  if (d.promotions.some((p) => p.code === promoCode)) fail(`Promo code ${promoCode} already exists.`);
  const id = nextId("P");
  d.promotions.push({ id, code: promoCode, discountPct: discount, active: true, note: String(note || "").trim().slice(0, 200) || "Created from admin console", clientIds: ids, allClients: everyone, productCodes: products });
  syncPromoIds(d);
  const who = everyone ? "all clients" : `${ids.length} client(s)`;
  const what = products.length ? `${products.length} product(s)` : "all products";
  log("Admin", `Created promotion ${promoCode} (${discount}%) for ${who}, ${what}`);
  persist();
  return { ok: true, msg: `Promotion ${promoCode} created.` };
}
function updatePromotion(id, b = {}) {
  const d = load();
  const p = need(d.promotions, (x) => x.id === id, "Promotion not found.");
  if (b.code != null) {
    const code = String(b.code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) fail("Promo code must be 2-40 letters / numbers.");
    if (d.promotions.some((x) => x.code === code && x.id !== id)) fail(`Promo code ${code} already exists.`);
    p.code = code;
  }
  if (b.pct != null) { const n = Number(b.pct); if (!(n > 0 && n <= 100)) fail("Discount must be between 1 and 100."); p.discountPct = n; }
  if (b.active != null) p.active = !!b.active;
  if (b.note != null) p.note = String(b.note).slice(0, 200);
  if (b.allClients != null) p.allClients = !!b.allClients;
  if (b.clientIds != null) {
    const ids = [...new Set(b.clientIds)].filter((cid) => d.clients.some((c) => c.id === cid));
    if (!ids.length && !p.allClients) fail("Pick at least one client, or choose All clients.");
    p.clientIds = ids;
  }
  if (b.productCodes != null) p.productCodes = cleanProductCodes(d, b.productCodes);
  syncPromoIds(d);
  log("Admin", `Edited promotion ${p.code}`);
  persist();
  return { ok: true, msg: `Promotion ${p.code} updated.` };
}
function deletePromotion(id) {
  const d = load();
  const p = need(d.promotions, (x) => x.id === id, "Promotion not found.");
  d.promotions = d.promotions.filter((x) => x.id !== id);
  syncPromoIds(d);
  log("Admin", `Deleted promotion ${p.code}`);
  persist();
  return { ok: true, msg: `Promotion ${p.code} deleted.` };
}

/* ---------------- actions: invoices / credit / shipping ---------------- */
function sendReminder(clientId) {
  const c = need(load().clients, (x) => x.id === clientId, "Unknown client.");
  if (balanceOf(clientId) <= c.creditLimit) fail(`${c.name} is within their credit limit - no reminder needed.`);
  log("Admin", `Sent credit-control reminder to ${c.name}`);
  persist();
  return { ok: true, msg: `Reminder logged for ${c.name}.` };
}
function markPaid(invoiceId) {
  const i = need(load().invoices, (x) => x.id === invoiceId, "Invoice not found.");
  if (i.status !== "Outstanding") fail(`Invoice ${i.id} is already ${i.status}.`);
  i.status = "Paid";
  i.paid = i.amount;
  log("Admin", `Marked invoice ${i.id} as paid`);
  persist();
  return { ok: true, msg: `Invoice ${i.id} marked as paid.` };
}
/* Any role pays an invoice: saves a payment record. The amount is editable (part payments allowed):
   invoice.paid keeps the running total, and the invoice becomes Paid when nothing is left to pay.
   Methods: "Online" (card / UPI / net banking), "Cheque" (needs a cheque photo) and "Cash".
   "Card" and "Bank Transfer" are still accepted so older records / pages keep working.
   receivedBy + receiverEmail (mandatory) say WHO received the payment: an area manager or any other person.
   managerId is the area manager's id (empty when "Other person"). */
const PAY_METHODS = ["Online", "Cheque", "Cash", "Card", "Bank Transfer"];
const MAX_CHEQUE_CHARS = 900000;
function payInvoice(invoiceId, { method = "Online", amount, reference = "", date, payerName = "", chequePhoto = "", chequeNo = "", bankName = "", accountHolder = "", receivedBy = "", receiverEmail = "", managerId = "" } = {}) {
  const d = load();
  if (!Array.isArray(d.payments)) d.payments = [];
  const i = need(d.invoices, (x) => x.id === invoiceId, "Invoice not found.");
  if (i.status !== "Outstanding") fail(`Invoice ${i.id} is already ${i.status}.`);
  if (!PAY_METHODS.includes(method)) fail("Choose a valid payment method.");

  /* amount: editable, part payments allowed (default = the full balance) */
  const paidBefore = round2(i.paid || 0);
  const balance = round2(i.amount - paidBefore);
  const pay = amount == null || amount === "" ? balance : round2(Number(amount));
  if (!Number.isFinite(pay) || pay <= 0) fail("Enter an amount greater than zero.");
  if (pay > balance) fail(`Amount cannot be more than the balance ${gbp(balance)}.`);

  /* who received this payment (mandatory) */
  const recvName = String(receivedBy || "").trim().slice(0, 80);
  const recvEmail = String(receiverEmail || "").trim().toLowerCase().slice(0, 120);
  if (!recvName) fail("Enter who received the payment.");
  if (!EMAIL_RE.test(recvEmail)) fail("Enter a valid email for the person who received the payment.");
  const recvManagerId = managerId && d.areaManagers.some((m) => m.id === managerId) ? managerId : "";

  const payer = String(payerName || "").trim().slice(0, 80);
  const ref = String(reference || "").trim().slice(0, 60);
  const modern = method === "Online" || method === "Cheque" || method === "Cash";
  if (modern && !payer) fail(method === "Cash" ? "Enter who paid the cash." : "Enter the payer name.");
  if ((method === "Online" || method === "Cheque") && !ref) fail(method === "Cheque" ? "Enter the cheque number." : "Enter the transaction / reference ID.");
  if (method === "Cheque") {
    const photo = String(chequePhoto || "");
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(photo)) fail("Please upload a photo of the cheque.");
    if (photo.length > MAX_CHEQUE_CHARS) fail("Cheque photo is too large. Try a smaller picture.");
  }

  const id = nextId("PAY");
  const c = d.clients.find((x) => x.id === i.clientId);
  const payment = {
    id,
    invoiceId: i.id,
    clientId: i.clientId,
    orderId: i.orderId,
    amount: pay,
    method,
    payerName: payer,
    chequeNo: method === "Cheque" ? String(chequeNo || "").trim().slice(0, 12) : "",
    bankName: method === "Cheque" ? String(bankName || "").trim().slice(0, 60) : "",
    accountHolder: method === "Cheque" ? String(accountHolder || "").trim().slice(0, 60) : "",
    reference: ref || id,
    chequePhoto: method === "Cheque" ? String(chequePhoto) : "",
    receivedBy: recvName,
    receiverEmail: recvEmail,
    managerId: recvManagerId,
    date: isDate(date) ? date : todayISO(0),
  };
  d.payments.unshift(payment);
  i.paid = round2(paidBefore + pay);
  const settled = i.paid >= round2(i.amount) - 0.005;
  if (settled) i.status = "Paid";
  log(payer || c?.name || "Client", `${settled ? "Paid" : "Part-paid"} invoice ${i.id} (${gbp(pay)}) by ${method}${method === "Cheque" ? " no. " : ", ref "}${payment.reference}, received by ${recvName}`);
  if (!persistChecked()) {
    // storage full (the cheque photo is the big part): undo so nothing is half-paid
    d.payments.shift(); i.paid = paidBefore; i.status = "Outstanding"; d.auditLog.shift();
    fail("Browser storage is full, so the payment was not saved. Use a smaller cheque photo or delete old photos.");
  }
  const { chequePhoto: _omit, ...lean } = payment; // keep the response small
  const left = round2(i.amount - i.paid);
  return {
    ok: true,
    msg: settled ? `Payment of ${gbp(pay)} received. Invoice ${i.id} is paid in full.` : `Part payment of ${gbp(pay)} received for ${i.id}. Balance ${gbp(left)}.`,
    payment: clone(lean),
  };
}
/* ---------------- actions: invoice photos (client + area manager) ---------------- */
const PHOTO_KINDS = ["Delivery proof", "Damaged goods", "Wrong item", "Missing items", "Payment proof", "Other"];
const MAX_INVOICE_PHOTOS = 8;
const MAX_PHOTO_CHARS = 900000; // ~650 KB of image data per photo (the page compresses first)
/* like persist(), but tells us when the browser storage is full so a photo is never lost silently */
function persistChecked() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch { return false; }
}
/* who is acting: role "client" -> the invoice's client, role "manager" -> an area manager who covers that client */
function photoActor(d, inv, { role, managerId } = {}) {
  if (role === "manager") {
    const m = need(d.areaManagers, (x) => x.id === managerId, "Area manager not found.");
    if (!m.clientIds.includes(inv.clientId)) fail(`${m.name} does not cover this client.`);
    return { role: "Area manager", by: m.name };
  }
  const c = need(d.clients, (x) => x.id === inv.clientId, "Unknown client.");
  return { role: "Client", by: c.name };
}
function addInvoicePhotos(invoiceId, { photos, kind = "Other", note = "", role, managerId } = {}) {
  const d = load();
  const inv = need(d.invoices, (x) => x.id === invoiceId, "Invoice not found.");
  const who = photoActor(d, inv, { role, managerId });
  const list = Array.isArray(photos) ? photos : [];
  if (!list.length) fail("Choose at least one photo.");
  if (!PHOTO_KINDS.includes(kind)) fail("Choose a valid photo type.");
  if (!Array.isArray(inv.photos)) inv.photos = [];
  if (inv.photos.length + list.length > MAX_INVOICE_PHOTOS) fail(`An invoice can hold ${MAX_INVOICE_PHOTOS} photos. ${MAX_INVOICE_PHOTOS - inv.photos.length} slot(s) left.`);
  /* validate everything first so a bad photo never leaves a half-saved batch behind */
  const fresh = list.map((p, i) => {
    const url = String(p?.dataUrl || "");
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(url)) fail(`Photo ${i + 1} must be a JPG, PNG or WEBP image.`);
    if (url.length > MAX_PHOTO_CHARS) fail(`Photo ${i + 1} is too large. Try a smaller picture.`);
    return {
      id: nextId("PH"), kind, note: String(note || "").trim().slice(0, 300),
      name: String(p?.name || "photo.jpg").slice(0, 80), dataUrl: url,
      role: who.role, by: who.by, date: todayISO(0), time: new Date().toTimeString().slice(0, 5),
    };
  });
  const before = inv.photos.length;
  inv.photos.push(...fresh);
  log(who.by, `Uploaded ${list.length} photo(s) to invoice ${inv.id} (${kind})`);
  if (!persistChecked()) {
    inv.photos.splice(before); d.auditLog.shift(); // roll back: nothing half-saved
    fail("Browser storage is full, so the photo was not saved. Delete an old photo or use a smaller picture.");
  }
  return { ok: true, msg: `${list.length} photo${list.length > 1 ? "s" : ""} added to ${inv.id}.` };
}
function deleteInvoicePhoto(invoiceId, photoId, { role, managerId } = {}) {
  const d = load();
  const inv = need(d.invoices, (x) => x.id === invoiceId, "Invoice not found.");
  const who = photoActor(d, inv, { role, managerId });
  const ph = need(inv.photos || [], (x) => x.id === photoId, "Photo not found.");
  if (ph.role !== who.role) fail(`Only the ${ph.role.toLowerCase()} who uploaded this photo can delete it.`);
  inv.photos = inv.photos.filter((x) => x.id !== photoId);
  log(who.by, `Deleted a photo from invoice ${inv.id}`);
  persist();
  return { ok: true, msg: "Photo deleted." };
}

/* ---------------- actions: tickets (mistake report / return order) ---------------- */
const TICKET_STATUSES = ["Open", "In Review", "Approved", "Rejected", "Resolved"];
/* A client raises a ticket on an invoice.
   type "Mistake": issue + note (+ optional item code).  type "Return": issue + lines [{code, qty}] */
function createTicket(invoiceId, { type, issue, note = "", lines = [], code = "" } = {}) {
  const d = load();
  if (!Array.isArray(d.tickets)) d.tickets = [];
  const inv = need(d.invoices, (x) => x.id === invoiceId, "Invoice not found.");
  if (!["Mistake", "Return"].includes(type)) fail("Choose a ticket type.");
  const order = d.orders.find((o) => o.id === inv.orderId);
  const c = d.clients.find((x) => x.id === inv.clientId);
  const reason = text(issue, "Reason", 80);
  const details = String(note || "").trim().slice(0, 500);
  let ticketLines = [];
  let credit = 0;

  if (type === "Mistake") {
    if (details.length < 5) fail("Please describe the mistake (at least 5 characters).");
    if (code) {
      const l = order?.lines.find((x) => x.code === code) || fail("That item is not on this invoice's order.");
      ticketLines = [{ code: l.code, qty: l.qty, price: l.price }];
    }
  } else {
    if (!order) fail("This invoice has no order items, so a return cannot be raised.");
    const wanted = (Array.isArray(lines) ? lines : []).filter((l) => Number(l?.qty) > 0);
    if (!wanted.length) fail("Select at least one item to return.");
    const already = {};
    d.tickets
      .filter((t) => t.invoiceId === inv.id && t.type === "Return" && t.status !== "Rejected")
      .forEach((t) => t.lines.forEach((l) => { already[l.code] = (already[l.code] || 0) + l.qty; }));
    const seen = new Set();
    ticketLines = wanted.filter((w) => !seen.has(w.code) && seen.add(w.code)).map((w) => {
      const l = order.lines.find((x) => x.code === w.code) || fail(`Item ${w.code} is not on this order.`);
      const left = l.qty - (already[l.code] || 0);
      if (left <= 0) fail(`${l.code} has already been returned.`);
      const qty = wholeNumber(w.qty, `Return quantity for ${l.code}`, { min: 1, max: left });
      return { code: l.code, qty, price: l.price };
    });
    credit = round2(ticketLines.reduce((s, l) => s + l.qty * l.price, 0) * (1 + VAT_RATE));
  }

  const id = nextId("TKT");
  const ticket = {
    id, type, invoiceId: inv.id, orderId: inv.orderId, clientId: inv.clientId,
    issue: reason, note: details, lines: ticketLines, credit,
    status: "Open", date: todayISO(0), response: "",
  };
  d.tickets.unshift(ticket);
  log(c?.name || "Client", `Raised ${type === "Return" ? "return" : "mistake"} ticket ${id} on invoice ${inv.id}`);
  persist();
  return { ok: true, msg: `Ticket ${id} raised. Our team will review it.`, ticket: clone(ticket) };
}
/* staff: change status / reply */
function updateTicket(id, b = {}) {
  const d = load();
  const t = need(d.tickets || [], (x) => x.id === id, "Ticket not found.");
  if (b.status != null) { if (!TICKET_STATUSES.includes(b.status)) fail("Invalid ticket status."); t.status = b.status; }
  if (b.response != null) t.response = String(b.response).trim().slice(0, 500);
  log("Admin", `Updated ticket ${t.id} to ${t.status}`);
  persist();
  return { ok: true, msg: `Ticket ${t.id} updated.` };
}
/* manual invoice: amount is the gross (VAT included) total */
function createInvoice({ clientId, orderId = "", amount, status = "Outstanding", date }) {
  const d = load();
  need(d.clients, (x) => x.id === clientId, "Pick a client.");
  const gross = money(amount, "Amount");
  if (!gross) fail("Amount must be greater than zero.");
  if (!["Outstanding", "Paid"].includes(status)) fail("Status must be Outstanding or Paid.");
  if (orderId && !d.orders.some((o) => o.id === orderId && o.clientId === clientId)) fail("That order does not belong to this client.");
  const id = nextId("INV");
  d.invoices.push({ id, clientId, orderId: orderId || "-", amount: gross, vat: round2(gross - gross / (1 + VAT_RATE)), status, date: isDate(date) ? date : todayISO(0) });
  log("Admin", `Created invoice ${id} for ${gbp(gross)}`);
  persist();
  return { ok: true, msg: `Invoice ${id} created.` };
}
function updateInvoice(id, b = {}) {
  const i = need(load().invoices, (x) => x.id === id, "Invoice not found.");
  if (b.amount != null) { const g = money(b.amount, "Amount"); i.amount = g; i.vat = round2(g - g / (1 + VAT_RATE)); }
  if (b.status != null) { if (!["Outstanding", "Paid"].includes(b.status)) fail("Status must be Outstanding or Paid."); i.status = b.status; }
  if (b.date != null) { if (!isDate(b.date)) fail("Enter a valid date."); i.date = b.date; }
  log("Admin", `Edited invoice ${i.id}`);
  persist();
  return { ok: true, msg: `Invoice ${i.id} updated.` };
}
function deleteInvoice(id) {
  const d = load();
  const i = need(d.invoices, (x) => x.id === id, "Invoice not found.");
  d.invoices = d.invoices.filter((x) => x.id !== id);
  d.payments = d.payments.filter((p) => p.invoiceId !== id);
  d.tickets = (d.tickets || []).filter((t) => t.invoiceId !== id);
  log("Admin", `Deleted invoice ${i.id}`);
  persist();
  return { ok: true, msg: `Invoice ${i.id} deleted.` };
}
function generateLabel(orderId) {
  const d = load();
  const o = need(d.orders, (x) => x.id === orderId, "Order not found.");
  if (o.status !== "Delivered & Invoiced") fail(`Order ${o.id} is not ready to ship.`);
  if (d.shipments.some((s) => s.orderId === o.id)) fail(`A label has already been generated for ${o.id}.`);
  let ref;
  do { ref = "DPD" + Math.floor(1000000 + Math.random() * 8999999); } while (d.shipments.some((s) => s.id === ref));
  d.shipments.push({ id: ref, orderId: o.id, trackingRef: ref });
  log("Admin", `Generated DPD label ${ref} for ${o.id}`);
  persist();
  return { ok: true, msg: `DPD label ${ref} generated for ${o.id}.`, trackingRef: ref };
}
function deleteShipment(id) {
  const d = load();
  const s = need(d.shipments, (x) => x.id === id, "Shipment not found.");
  d.shipments = d.shipments.filter((x) => x.id !== id);
  log("Admin", `Deleted shipping label ${s.id}`);
  persist();
  return { ok: true, msg: `Label ${s.id} deleted.` };
}

/* ---------------- actions: area manager targets ---------------- */
/* The ADMINISTRATOR sets the sales / collection target of an area manager (0 = no target).
   The area manager only views it on his Reports page. */
const targetAmount = (v, label) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n < 0 || n > 100000000) fail(`${label} must be a valid amount.`);
  return round2(n);
};
function saveManagerTargets(managerId, { sales, collection } = {}) {
  const d = load();
  const m = need(d.areaManagers, (x) => x.id === managerId, "Unknown area manager.");
  if (!d.targets || typeof d.targets !== "object") d.targets = {};
  d.targets[managerId] = {
    sales: targetAmount(sales, "Sales target"),
    collection: targetAmount(collection, "Collection target"),
  };
  log("Admin", `Set targets for ${m.name}: sales ${gbp(d.targets[managerId].sales)}, collection ${gbp(d.targets[managerId].collection)}`);
  persist();
  return { ok: true, msg: `Targets saved for ${m.name}.` };
}

/* ---------------- actions: visits (check-in / check-out) ---------------- */
/* ENTER STORE = check in. Only a remark is needed.
   GPS distance and photo are optional: if the distance is known it is saved,
   and the visit is marked "verified" only when it is inside the store radius. */
function registerVisit(managerId, { clientId, lat, lng, distanceKm, photoDataUrl, remark }) {
  const d = load();
  const m = need(d.areaManagers, (x) => x.id === managerId, "Unknown area manager.");
  if (!m.clientIds.includes(clientId)) fail(`${m.name} does not cover this client.`);
  const open = m.visits.find((v) => v.checkIn && !v.checkOut);
  if (open) fail(`You are already checked in at ${open.client}. Tap "Leave store" first.`);
  const c = need(d.clients, (x) => x.id === clientId, "Unknown client.");

  /* distance is optional (null when GPS or the store location is missing) */
  let dist = distanceKm == null || distanceKm === "" ? null : Number(distanceKm);
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && c.lat != null) {
    dist = haversineKm(Number(lat), Number(lng), c.lat, c.lng);
  }
  if (dist != null && (!Number.isFinite(dist) || dist < 0)) dist = null;

  /* photo is optional: saved only when it is a valid image */
  const photo = typeof photoDataUrl === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(photoDataUrl) ? photoDataUrl : null;

  const checkInRemark = String(remark ?? "").trim().slice(0, 300);
  if (checkInRemark.length < 3) fail("Please enter a remark (at least 3 characters) to check in.");

  const now = new Date();
  m.visits.unshift({
    id: nextId("V"), client: c.name, clientId: c.id,
    date: todayISO(0), time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    note: checkInRemark,
    verified: dist != null && dist <= VISIT_RADIUS_KM,
    distanceKm: dist != null ? Math.round(dist * 1000) / 1000 : null,
    photoDataUrl: photo,
    checkIn: now.toISOString(), checkOut: null, durationMin: null,
  });
  const when = now.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  log(m.name, `Checked in at ${c.name} (${when})`);
  persist();
  return { ok: true, msg: `Checked in at ${c.name} at ${when}.` };
}
/* LEAVE STORE = check out. Saves checkOut time and how many minutes the manager stayed. */
function checkOutVisit(managerId, visitId, { remark } = {}) {
  const d = load();
  const m = need(d.areaManagers, (x) => x.id === managerId, "Unknown area manager.");
  const v = need(m.visits, (x) => x.id === visitId, "Visit not found.");
  if (!v.checkIn) fail("This visit has no check-in time.");
  if (v.checkOut) fail("You have already left this store.");
  const outRemark = String(remark ?? "").trim().slice(0, 300);
  if (outRemark.length < 3) fail("Please enter a remark (at least 3 characters) to check out.");
  const now = new Date();
  v.checkOutRemark = outRemark;
  v.checkOut = now.toISOString();
  v.durationMin = Math.max(1, Math.round((now - new Date(v.checkIn)) / 60000));
  log(m.name, `Left ${v.client} after ${v.durationMin} min`);
  persist();
  return { ok: true, msg: `You left ${v.client}. Time in store: ${v.durationMin} min.` };
}
function updateVisit(managerId, visitId, { note } = {}) {
  const m = need(load().areaManagers, (x) => x.id === managerId, "Unknown area manager.");
  const v = need(m.visits, (x) => x.id === visitId, "Visit not found.");
  v.note = text(note, "Note", 300);
  log(m.name, `Edited visit note for ${v.client}`);
  persist();
  return { ok: true, msg: "Visit updated." };
}
function deleteVisit(managerId, visitId) {
  const m = need(load().areaManagers, (x) => x.id === managerId, "Unknown area manager.");
  const v = need(m.visits, (x) => x.id === visitId, "Visit not found.");
  m.visits = m.visits.filter((x) => x.id !== visitId);
  log(m.name, `Deleted visit to ${v.client}`);
  persist();
  return { ok: true, msg: "Visit deleted." };
}

/* ---------------- router (same URLs style the old Express API used) ---------------- */
const routes = [
  ["GET", /^\/state$/, () => getState()],
  ["GET", /^\/reports\/forecast$/, () => forecast()],
  ["GET", /^\/reports\/sales$/, () => salesReport()],
  ["GET", /^\/reports\/credit-control$/, () => creditControl()],
  ["GET", /^\/reports\/stock-expiry$/, () => stockExpiry()],

  // orders
  ["POST", /^\/orders$/, (_m, b) => placeOrder(b || {})],
  ["PUT", /^\/orders\/([^/]+)$/, (m, b) => updateOrder(m[1], b || {})],
  ["DELETE", /^\/orders\/([^/]+)$/, (m) => deleteOrder(m[1])],
  ["POST", /^\/orders\/([^/]+)\/send-to-eden-farm$/, (m) => sendToEdenFarm(m[1])],
  ["POST", /^\/orders\/([^/]+)\/pod$/, (m, b) => matchPOD(m[1], b?.delivered, b?.signatureOk === true)],
  ["POST", /^\/orders\/([^/]+)\/shipping-label$/, (m) => generateLabel(m[1])],
  ["POST", /^\/pod\/auto-match$/, () => runAutoMatch()],
  ["DELETE", /^\/shipments\/([^/]+)$/, (m) => deleteShipment(m[1])],

  // purchase orders / backorders / stock
  ["POST", /^\/purchase-orders$/, (_m, b) => createPO(b || {})],
  ["PUT", /^\/purchase-orders\/([^/]+)$/, (m, b) => updatePO(m[1], b || {})],
  ["DELETE", /^\/purchase-orders\/([^/]+)$/, (m) => deletePO(m[1])],
  ["POST", /^\/purchase-orders\/([^/]+)\/receive$/, (m) => receiveGoods(m[1])],
  ["POST", /^\/backorders\/([^/]+)\/purchase-order$/, (m) => raisePOFromBackorder(m[1])],
  ["PUT", /^\/backorders\/([^/]+)$/, (m, b) => updateBackorder(m[1], b || {})],
  ["DELETE", /^\/backorders\/([^/]+)$/, (m) => deleteBackorder(m[1])],
  ["POST", /^\/stock$/, (_m, b) => addStock(b || {})],
  ["PUT", /^\/stock\/([^/]+)$/, (m, b) => updateStock(m[1], b || {})],
  ["DELETE", /^\/stock\/([^/]+)$/, (m) => deleteStock(m[1])],

  // products & prices
  ["POST", /^\/products$/, (_m, b) => addProduct(b || {})],
  ["PUT", /^\/products\/([^/]+)$/, (m, b) => updateProduct(m[1], b || {})],
  ["DELETE", /^\/products\/([^/]+)$/, (m) => deleteProduct(m[1])],
  ["PUT", /^\/products\/([^/]+)\/price$/, (m, b) => saveStandardPrice(m[1], b?.price)],
  ["PUT", /^\/clients\/([^/]+)\/price-overrides\/([^/]+)$/, (m, b) => saveOverride(m[1], m[2], b?.price)],
  ["DELETE", /^\/clients\/([^/]+)\/price-overrides\/([^/]+)$/, (m) => deleteOverride(m[1], m[2])],

  // clients
  ["POST", /^\/clients$/, (_m, b) => addClient(b || {})],
  ["PUT", /^\/clients\/([^/]+)$/, (m, b) => updateClient(m[1], b || {})],
  ["DELETE", /^\/clients\/([^/]+)$/, (m) => deleteClient(m[1])],
  ["POST", /^\/clients\/([^/]+)\/reminder$/, (m) => sendReminder(m[1])],

  // promotions
  ["POST", /^\/promotions$/, (_m, b) => createPromotion(b || {})],
  ["PUT", /^\/promotions\/([^/]+)$/, (m, b) => updatePromotion(m[1], b || {})],
  ["DELETE", /^\/promotions\/([^/]+)$/, (m) => deletePromotion(m[1])],

  // invoices
  ["POST", /^\/invoices$/, (_m, b) => createInvoice(b || {})],
  ["PUT", /^\/invoices\/([^/]+)$/, (m, b) => updateInvoice(m[1], b || {})],
  ["DELETE", /^\/invoices\/([^/]+)$/, (m) => deleteInvoice(m[1])],
  ["POST", /^\/invoices\/([^/]+)\/paid$/, (m) => markPaid(m[1])],
  ["POST", /^\/invoices\/([^/]+)\/pay$/, (m, b) => payInvoice(m[1], b || {})],
  ["POST", /^\/invoices\/([^/]+)\/tickets$/, (m, b) => createTicket(m[1], b || {})],
  ["POST", /^\/invoices\/([^/]+)\/photos$/, (m, b) => addInvoicePhotos(m[1], b || {})],
  ["DELETE", /^\/invoices\/([^/]+)\/photos\/([^/]+)$/, (m, b) => deleteInvoicePhoto(m[1], m[2], b || {})],
  ["PUT", /^\/tickets\/([^/]+)$/, (m, b) => updateTicket(m[1], b || {})],

  // area manager targets (set by the administrator)
  ["PUT", /^\/managers\/([^/]+)\/targets$/, (m, b) => saveManagerTargets(m[1], b || {})],

  // visits (check-in / check-out)
  ["POST", /^\/managers\/([^/]+)\/visits$/, (m, b) => registerVisit(m[1], b || {})],
  ["POST", /^\/managers\/([^/]+)\/visits\/([^/]+)\/check-out$/, (m, b) => checkOutVisit(m[1], m[2], b || {})],
  ["PUT", /^\/managers\/([^/]+)\/visits\/([^/]+)$/, (m, b) => updateVisit(m[1], m[2], b || {})],
  ["DELETE", /^\/managers\/([^/]+)\/visits\/([^/]+)$/, (m) => deleteVisit(m[1], m[2])],
];

export async function hubRequest(method, path, body) {
  const route = routes.find(([mt, re]) => mt === method && re.test(path));
  if (!route) return { ok: false, msg: "Unknown action." };
  try {
    return route[2](route[1].exec(path), body);
  } catch (e) {
    if (e instanceof HubError) return { ok: false, msg: e.message };
    console.error(e);
    return { ok: false, msg: "Something went wrong. Please try again." };
  }
}