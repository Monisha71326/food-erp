import { getErpRecords, createErpRecord, updateErpRecord } from "@/data/erpApi.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* local-date "YYYY-MM-DD" */
const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const findInvoice = async (invoiceNumber) => {
  const invoices = await getErpRecords("invoices");
  return invoices.find((i) => i.number === invoiceNumber);
};

/* invoice can take a payment again (used on Reject, and when a Pending payment is deleted) */
export async function releaseInvoice(pay) {
  const inv = await findInvoice(pay.invoice);
  if (inv) await updateErpRecord("invoices", inv.id, { pendingApproval: false, pendingPaymentId: null });
}

/* ERP Admin approves a Pending payment -> invoice balance / status update */
export async function approvePayment(pay, by = "Admin") {
  if (pay.status !== "Pending") throw new Error("Only Pending payments can be approved.");

  const inv = await findInvoice(pay.invoice);
  if (!inv) throw new Error(`Invoice ${pay.invoice} not found.`);

  const amount = round2(pay.amount);
  const balance = round2(inv.balance);
  if (!(amount > 0)) throw new Error("This payment has no amount.");
  if (amount > balance) throw new Error(`Payment (${amount}) is more than the invoice balance (${balance}).`);

  const newBalance = Math.max(0, round2(balance - amount));
  const full = newBalance <= 0;

  // 1) payment -> Approved (with who / when)
  await updateErpRecord("payments", pay.id, { status: "Approved", approvedBy: by, approvedOn: todayISO() });

  // 2) history entry (Invoice page "Payment history" + Customer Payments page)
  await createErpRecord("payments-received", {
    number: pay.number,
    date: pay.date,
    branch: "Head Office",
    type: "Invoice Payment",
    ref: pay.reference || pay.number,
    customer: pay.customer,
    invoice: pay.invoice,
    method: pay.method,
    amount,
  });

  // 3) invoice -> Paid / Partially Paid
  await updateErpRecord("invoices", inv.id, {
    balance: newBalance,
    status: full ? "Paid" : "Partially Paid",
    ...(full ? { paidOn: pay.date } : {}),
    pendingApproval: false,
    pendingPaymentId: null,
  });
}

/* ERP Admin rejects -> invoice can take payment again */
export async function rejectPayment(pay, reason = "", by = "Admin") {
  if (pay.status !== "Pending") throw new Error("Only Pending payments can be rejected.");
  await updateErpRecord("payments", pay.id, { status: "Rejected", rejectReason: reason, rejectedBy: by, rejectedOn: todayISO() });
  await releaseInvoice(pay);
}