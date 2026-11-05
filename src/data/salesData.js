/* Sample data for Sales module pages (mirrors Zoho Books demo data) */

export const customers = [
  { id: 1, name: "John Smith Customer", company: "suscipit", email: "", phone: "", receivables: 857, credits: 92 },
  { id: 2, name: "Emily Johnson Customer", company: "quos", email: "", phone: "", receivables: 313, credits: 68 },
  { id: 3, name: "David Williams Customer", company: "adipisci", email: "", phone: "", receivables: 458, credits: 99 },
  { id: 4, name: "Sarah Brown Customer", company: "libero", email: "", phone: "", receivables: 175, credits: 54 },
  { id: 5, name: "Michael Davis Customer", company: "magni", email: "", phone: "", receivables: 284, credits: 51 },
  { id: 6, name: "Zoe Turner Customer", company: "deserunt", email: "", phone: "", receivables: 904, credits: 21 },
  { id: 7, name: "Emma Anderson Customer", company: "quidem", email: "", phone: "", receivables: 341, credits: 35 },
];
x
export const quotes = [
  { id: 1, date: "2026-08-10", number: "EST-39408", ref: "48872", customer: "Lauryn", status: "Draft", amount: 352 },
  { id: 2, date: "2026-02-17", number: "EST-16606", ref: "27334", customer: "Eldred", status: "Expired", amount: 633 },
  { id: 3, date: "2026-04-14", number: "EST-90837", ref: "5945", customer: "Hudson", status: "Sent", amount: 140 },
  { id: 4, date: "2026-05-27", number: "EST-35616", ref: "43940", customer: "Bennett", status: "Sent", amount: 527 },
];

export const retainerInvoices = [
  { id: 1, date: "2026-02-23", number: "atque", ref: "", customer: "John Smith Customer", project: "--", status: "Paid" },
  { id: 2, date: "2026-02-23", number: "at", ref: "", customer: "Emily Johnson Customer", project: "--", status: "Paid" },
  { id: 3, date: "2026-02-23", number: "inventore", ref: "", customer: "David Williams Customer", project: "--", status: "Paid" },
  { id: 4, date: "2026-02-23", number: "perspiciatis", ref: "", customer: "Sarah Brown Customer", project: "--", status: "Paid" },
  { id: 5, date: "2026-02-23", number: "dolore", ref: "", customer: "Michael Davis Customer", project: "--", status: "Paid" },
  { id: 6, date: "2026-02-23", number: "sint", ref: "", customer: "Zoe Turner Customer", project: "--", status: "Paid" },
];

export const salesOrders = [
  { id: 0, date: "2026-07-17", number: "SO-00", ref: "70995", customer: "John Smith Customer", status: "Approval Overdue", amount: 75014, invoiced: "no" },
  { id: 1, date: "2026-07-17", number: "SO-01", ref: "86776", customer: "Emily Johnson Customer", status: "Approval Overdue", amount: 1283, invoiced: "no" },
  { id: 2, date: "2026-07-17", number: "SO-02", ref: "53896", customer: "David Williams Customer", status: "Approval Overdue", amount: 31760, invoiced: "no" },
  { id: 3, date: "2026-07-17", number: "SO-03", ref: "11515", customer: "Sarah Brown Customer", status: "Open", amount: 50007, invoiced: "no" },
  { id: 4, date: "2026-07-17", number: "SO-04", ref: "99330", customer: "Michael Davis Customer", status: "Invoiced", amount: 27217, invoiced: "yes" },
  { id: 5, date: "2026-07-17", number: "SO-05", ref: "28568", customer: "Zoe Turner Customer", status: "Partially Invoiced", amount: 97018, invoiced: "partial" },
];

/* [customer, status, amount, balanceDue(optional)] */
const INV = [
  ["John Smith Customer", "Draft", 439187], ["John Smith Customer", "Partially Paid", 32486, 32476],
  ["John Smith Customer", "Open", 335845], ["John Smith Customer", "Approved", 76673],
  ["Edward", "Open", 556706], ["Bessie", "Pending Approval", 557733], ["Lillie", "Draft", 661333],
  ["Santa", "Pending Approval", 415198], ["Tanya", "Overdue", 572800],
  ["Emily Johnson Customer", "Draft", 426478], ["Emily Johnson Customer", "Partially Paid", 32486],
  ["Emily Johnson Customer", "Open", 960484], ["Emily Johnson Customer", "Approved", 657512],
  ["Howard", "Approved", 744494], ["Palma", "Paid", 610329], ["Garfield", "Approved", 666636],
  ["Maybell", "Void", 577353], ["Shanel", "Approved", 104554],
  ["David Williams Customer", "Draft", 374723], ["David Williams Customer", "Partially Paid", 32486],
  ["David Williams Customer", "Pending", 635435], ["David Williams Customer", "Pending Approval", 739777],
  ["Vicky", "Pending Approval", 768043], ["Ronny", "Paid", 963519], ["Marlon", "Void", 198389],
  ["Calista", "Void", 159944], ["Athena", "Partially Paid", 618910],
  ["Sarah Brown Customer", "Draft", 741163], ["Sarah Brown Customer", "Partially Paid", 32486],
  ["Sarah Brown Customer", "Approved", 978660], ["Sarah Brown Customer", "Void", 356287],
  ["Rowland", "Draft", 375717], ["Monty", "Paid", 167491], ["Tyrique", "Draft", 187964],
  ["Ardith", "Draft", 803400], ["Clemens", "Paid", 690600],
  ["Michael Davis Customer", "Draft", 650780], ["Michael Davis Customer", "Partially Paid", 32486],
  ["Michael Davis Customer", "Pending", 811622], ["Michael Davis Customer", "Open", 425941],
  ["Cynthia", "Pending Approval", 393034], ["Gussie", "Open", 5159], ["Gavin", "Overdue", 528769],
  ["Shad", "Partially Paid", 770697], ["Georgianna", "Pending Approval", 874319],
  ["Zoe Turner Customer", "Draft", 156340], ["Zoe Turner Customer", "Partially Paid", 32486],
  ["Zoe Turner Customer", "Pending", 393361], ["Zoe Turner Customer", "Void", 133453],
  ["Verner", "Paid", 90378], ["Clovis", "Open", 876310], ["Charlotte", "Overdue", 149858],
  ["Tod", "Void", 762378], ["Katherine", "Open", 879238],
  ["Emma Anderson Customer", "Draft", 811535], ["Emma Anderson Customer", "Partially Paid", 32486],
  ["Emma Anderson Customer", "Void", 584028], ["Emma Anderson Customer", "Partially Paid", 3332],
  ["Emmanuel", "Draft", 858830], ["Hellen", "Pending", 953409], ["Geo", "Open", 697881],
  ["Retta", "Partially Paid", 139914], ["Giovani", "Draft", 969342],
];

export const invoices = INV.map(([customer, status, amount, balance], i) => ({
  id: i + 1,
  date: "2026-02-13",
  number: `Invoice${i + 1}`,
  order: "",
  customer,
  status,
  due: "2027-09-07",
  amount,
  balance: balance ?? amount,
}));

export const invoiceSummary = { outstanding: 672.19, dueToday: 0, dueIn30: 0, overdue: 672.19, avgDays: 0 };

export const recurringInvoices = [
  { id: 1, customer: "John Smith Customer", profile: "Recurring Invoice 1", frequency: "Net 45", last: "2026-09-04", next: "2026-10-16", status: "Active", amount: 503 },
  { id: 2, customer: "Emily Johnson Customer", profile: "Recurring Invoice 2", frequency: "Net 45", last: "2026-09-04", next: "", status: "Stopped", amount: 633 },
  { id: 3, customer: "David Williams Customer", profile: "Recurring Invoice 3", frequency: "Due end of next month", last: "2026-09-04", next: "", status: "Expired", amount: 444 },
  { id: 4, customer: "Sarah Brown Customer", profile: "Recurring Invoice 4", frequency: "Net 60", last: "2026-09-04", next: "2026-10-16", status: "Active", amount: 915 },
];

export const deliveryChallans = [
  { id: 0, number: "DC-000", ref: "70948", customer: "John Smith Customer", status: "Void", invoiceStatus: "Void", amount: 0 },
  { id: 1, number: "DC-001", ref: "39150", customer: "Emily Johnson Customer", status: "Partially Paid", invoiceStatus: "Partially Paid", amount: 0 },
  { id: 2, number: "DC-002", ref: "41705", customer: "David Williams Customer", status: "Paid", invoiceStatus: "Paid", amount: 0 },
  { id: 3, number: "DC-003", ref: "10100", customer: "Sarah Brown Customer", status: "Partially Paid", invoiceStatus: "Partially Paid", amount: 0 },
];

export const paymentsReceived = [
  { id: 1, date: "2026-10-12", branch: "Head Office", number: "payment1", type: "Invoice Payment", ref: "123456789", customer: "John Smith Customer", invoice: "Invoice2" },
  { id: 2, date: "2026-10-12", branch: "Head Office", number: "payment2", type: "Retainer Payment", ref: "123456789", customer: "John Smith Customer", invoice: "" },
  { id: 3, date: "2026-10-12", branch: "Head Office", number: "payment3", type: "Invoice Payment", ref: "123456789", customer: "Emily Johnson Customer", invoice: "Invoice11" },
  { id: 4, date: "2026-10-12", branch: "Head Office", number: "payment4", type: "Retainer Payment", ref: "123456789", customer: "Emily Johnson Customer", invoice: "" },
  { id: 5, date: "2026-10-12", branch: "Head Office", number: "payment5", type: "Invoice Payment", ref: "", customer: "David Williams Customer", invoice: "Invoice20" },
  { id: 6, date: "2026-10-12", branch: "Head Office", number: "payment6", type: "Retainer Payment", ref: "123456789", customer: "David Williams Customer", invoice: "" },
];

export const creditNotes = [
  { id: 1, date: "2026-05-20", number: "CN-60791", ref: "40746", customer: "Jeromy", invoice: "INV-48036", status: "Approval Overdue", amount: 589 },
  { id: 2, date: "2025-12-28", number: "CN-49377", ref: "82430", customer: "Mallory", invoice: "INV-86498", status: "Void", amount: 887 },
  { id: 3, date: "2025-11-15", number: "CN-92464", ref: "73076", customer: "Arnulfo", invoice: "INV-52530", status: "Approved", amount: 893 },
  { id: 4, date: "2025-12-23", number: "CN-74546", ref: "12504", customer: "Daphne", invoice: "INV-19983", status: "Void", amount: 724 },
  { id: 5, date: "2026-10-06", number: "CN-67896", ref: "29352", customer: "Irving", invoice: "INV-67084", status: "Approved", amount: 659 },
];
