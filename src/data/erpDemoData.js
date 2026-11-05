/* Demo rows for every ERP module. Each module gets its OWN realistic UK data (different numbers,
   customers, statuses, amounts), shaped to match the columns of that page. */

const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const cycle = (list, i) => list[i % list.length];
const build = (count, fn) => Array.from({ length: count }, (_, i) => fn(i));
const r2 = (n) => Math.round(n * 100) / 100;

const CUSTOMERS = [
  "Spice Market Ltd", "Green Leaf Grocers", "Al-Noor Wholesale", "Riverside Deli", "Apex Foods Ltd",
  "Northstar Retail", "Blue Ocean Supplies", "Everest Wholesale", "Prime Market Group", "Sunrise Stores",
];
const VENDORS = [
  "Eden Farm", "Iceco Foods", "Factory Direct", "Harvest Packaging", "Northern Dairy",
  "Coastal Seafoods", "Brightway Logistics", "Kent Fresh Produce", "Pennine Spices", "Anglia Oils",
];
const domain = (name) => name.toLowerCase().replace(/[^a-z]/g, "");

const DEMO = {
  customers: () => build(10, (i) => ({
    name: CUSTOMERS[i], company: CUSTOMERS[i],
    email: `accounts@${domain(CUSTOMERS[i])}.co.uk`,
    phone: `0121 496 ${String(1000 + i * 137).slice(-4)}`,
    receivables: [857, 313, 1458, 175, 2284, 904, 341, 1120, 0, 642][i],
    credits: [92, 0, 99, 54, 0, 21, 35, 0, 150, 18][i],
  })),

  estimates: () => build(10, (i) => ({
    number: `EST-${3001 + i}`, ref: `REF-${7100 + i * 3}`,
    customer: CUSTOMERS[(i + 2) % 10],
    status: cycle(["Draft", "Sent", "Accepted", "Declined", "Expired"], i),
    amount: [1250, 3480.5, 860, 5200, 2145.75, 7430, 990, 4310, 1675.2, 6120][i],
    date: day(-(i * 2 + 1)), expiryDate: day(14 - i * 2),
  })),

  "sales-orders": () => build(10, (i) => {
    const status = cycle(["Open", "Confirmed", "Invoiced", "Partially Invoiced", "Shipped"], i);
    return {
      number: `SO-${5001 + i}`, ref: `PO-${88100 + i * 7}`,
      customer: CUSTOMERS[(i + 4) % 10], status,
      amount: [2300, 910.4, 5640, 1875, 12400, 735.5, 3290, 8120, 1460, 4980][i],
      invoiced: status === "Invoiced" ? "yes" : status === "Partially Invoiced" ? "partial" : "no",
      date: day(-(i * 3 + 2)),
    };
  }),

  invoices: () => build(10, (i) => {
    const status = cycle(["Paid", "Sent", "Overdue", "Partially Paid", "Draft"], i);
    const amount = [1842, 960.6, 4375, 2210, 685, 7920, 1330.25, 5560, 2745, 3190][i];
    return {
      number: `INV-${6001 + i}`, order: `SO-${5001 + i}`,
      customer: CUSTOMERS[(i + 1) % 10], status, amount,
      balance: status === "Paid" ? 0 : status === "Partially Paid" ? r2(amount * 0.4) : amount,
      date: day(-(i * 3 + 2)), due: day(30 - i * 5),
    };
  }),

  "recurring-invoices": () => build(10, (i) => ({
    customer: CUSTOMERS[(i + 6) % 10],
    profile: `${cycle(["Monthly", "Fortnightly", "Weekly", "Quarterly"], i)} supply - ${CUSTOMERS[(i + 6) % 10]}`,
    frequency: cycle(["Every month", "Every 2 weeks", "Every week", "Every 3 months"], i),
    last: day(-(i + 3)), next: day(7 + i),
    status: cycle(["Active", "Active", "Stopped", "Active", "Expired"], i),
    amount: [480, 1250, 215.5, 3600, 790, 1040, 565, 2210, 330, 905][i],
  })),

  "credit-notes": () => build(10, (i) => ({
    number: `CN-${8001 + i}`, ref: `RET-${2200 + i * 5}`,
    customer: CUSTOMERS[(i + 3) % 10], invoice: `INV-${6001 + i}`,
    status: cycle(["Open", "Closed", "Approved", "Void"], i),
    amount: [120, 45.5, 310, 88, 215.75, 60, 540, 95, 175, 32.4][i],
    date: day(-(i * 4 + 3)),
  })),

  "retainer-invoices": () => build(10, (i) => ({
    number: `RET-${9001 + i}`, ref: `RF-${300 + i}`,
    customer: CUSTOMERS[(i + 5) % 10],
    project: cycle(["Eid festive supply", "Quarterly rice contract", "Frozen range launch", "Catering retainer", "--"], i),
    status: cycle(["Paid", "Draft", "Sent", "Paid"], i),
    date: day(-(i * 5 + 4)),
  })),

  "delivery-challans": () => build(10, (i) => ({
    number: `DC-${1201 + i}`, ref: `DN-${7700 + i * 11}`,
    customer: CUSTOMERS[(i + 7) % 10],
    status: cycle(["Delivered", "Open", "In Transit", "Delivered", "Returned"], i),
    invoiceStatus: cycle(["Invoiced", "Not invoiced", "Partially Paid", "Paid", "Void"], i),
    amount: [0, 640, 1180, 0, 2250, 380, 0, 915, 1760, 0][i],
    date: day(-(i * 2 + 1)),
  })),

  "payments-received": () => build(10, (i) => {
    const retainer = i % 3 === 1;
    return {
      number: `PAY-${4001 + i}`, date: day(-(i * 2 + 1)),
      branch: cycle(["Head Office", "Birmingham Depot", "Leicester Depot"], i),
      type: retainer ? "Retainer Payment" : "Invoice Payment",
      ref: `BACS-${50210 + i * 13}`, customer: CUSTOMERS[(i + 8) % 10],
      invoice: retainer ? "" : `INV-${6001 + i}`,
      method: cycle(["Bank Transfer", "Card", "Cheque", "Bank Transfer"], i),
      amount: [1842, 500, 4375, 2210, 300, 7920, 1330.25, 1000, 2745, 3190][i],
    };
  }),

  /* ----- purchasing / other modules ----- */
  vendors: () => build(10, (i) => ({
    name: VENDORS[i], company: VENDORS[i],
    email: `sales@${domain(VENDORS[i])}.co.uk`, phone: `0161 832 ${String(2000 + i * 211).slice(-4)}`,
    payables: [4200, 0, 1860, 940, 2750, 0, 515, 3300, 120, 1475][i],
  })),

  bills: () => build(10, (i) => ({
    number: `BILL-${1101 + i}`, vendor: VENDORS[i], supplier: VENDORS[i],
    status: cycle(["Open", "Paid", "Overdue", "Draft", "Partially Paid"], i),
    amount: [2400, 760.5, 5180, 1320, 890, 4075, 2260, 615, 3340, 1990][i],
    date: day(-(i * 3 + 1)), dueDate: day(21 - i * 4),
  })),

  "debit-notes": () => build(10, (i) => ({
    number: `DN-${2001 + i}`, vendor: VENDORS[(i + 3) % 10], supplier: VENDORS[(i + 3) % 10],
    bill: `BILL-${1101 + i}`, status: cycle(["Open", "Closed", "Void"], i),
    amount: [85, 240, 60.5, 130, 310, 45, 190, 75.25, 160, 220][i], date: day(-(i * 4 + 2)),
  })),

  receipts: () => build(10, (i) => ({
    number: `RCT-${7001 + i}`, customer: CUSTOMERS[(i + 9) % 10],
    method: cycle(["Bank Transfer", "Card", "Cash", "Cheque"], i),
    reference: `RCPT-${910 + i * 7}`,
    amount: [650, 1220.5, 340, 2875, 95, 4100, 780, 1560, 225.25, 3010][i],
    date: day(-(i * 2 + 1)), status: cycle(["Received", "Received", "Pending"], i),
  })),
};

/* Any module without its own template above: still gets DIFFERENT data per module (not one shared set). */
function genericRows(entity) {
  const h = [...entity].reduce((s, c) => s + c.charCodeAt(0), 0);
  const prefix = entity.split("-").map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "REC";
  const pool = h % 2 ? CUSTOMERS : VENDORS;
  const statuses = ["Active", "Pending", "Completed", "Draft", "Approved"];
  return build(10, (i) => {
    const name = pool[(i + h) % pool.length];
    const amount = r2(300 + (((i + 1) * (h % 7 + 3) * 137.5) % 9000));
    return {
      name, company: name, customer: name, supplier: name,
      number: `${prefix}-${4000 + (h % 50) * 10 + i}`, ref: `${prefix}-REF-${100 + (h % 40) + i * 3}`,
      date: day(-(i * 3 + (h % 5))), dueDate: day(20 - i * 3),
      status: statuses[(i + h) % statuses.length],
      amount, quantity: 5 + ((i * 3 + h) % 40),
      description: `${entity.replace(/-/g, " ")} - ${name}`,
      email: `info@${domain(name)}.co.uk`, phone: `020 7946 ${String(1000 + ((i + h) * 97) % 9000).slice(-4)}`,
    };
  });
}

export const demoRowsFor = (entity) => (DEMO[entity] ? DEMO[entity]() : genericRows(entity));