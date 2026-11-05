import { state, client, product, invoicePayment } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const VAT_RATE = 0.2;

/*
 * Builds the data object for <InvoiceDocument /> (the printed invoice) from an Order Hub invoice.
 * Same logic as InvoiceDetail.jsx, so the list-page print and the detail-page print are identical.
 *   invoice : row from s.invoices / clientInvoices()
 *   order   : the order of that invoice (s.orders.find((o) => o.id === invoice.orderId)), may be undefined
 */
export function buildInvoiceDocData(invoice, order) {
  const c = client(invoice.clientId);
  const isPaid = String(invoice.status).toLowerCase() === "paid";
  const net = round2(invoice.amount - invoice.vat);

  /* part payments: invoice.paid is the running total of what the client has already paid */
  const paidSoFar = isPaid ? round2(invoice.amount) : round2(invoice.paid || 0);
  const balance = isPaid ? 0 : round2(invoice.amount - paidSoFar);

  const lines = (order ? order.lines : []).map((l) => ({
    desc: product(l.code)?.description || l.code,
    qty: l.qty,
    price: l.price,
    total: round2(l.qty * l.price),
    vat: round2(l.qty * l.price * VAT_RATE), // VAT amount of this line
  }));
  const gap = round2(net - lines.reduce((sum, l) => sum + l.total, 0));
  if (lines.length && Math.abs(gap) >= 0.01) {
    // partial delivery: the invoice only bills what was delivered
    lines.push({ desc: "Adjustment for items not delivered", qty: 1, price: gap, total: gap, vat: round2(gap * VAT_RATE) });
  }

  let due = "-";
  if (invoice.date) {
    const d = new Date(invoice.date);
    d.setDate(d.getDate() + 30);
    due = fmtDate(d.toISOString().slice(0, 10));
  }

  /* area manager who covers this client */
  const am = (state.areaManagers || []).find((m) => (m.clientIds || []).includes(invoice.clientId));
  const pay = invoicePayment(invoice.id);

  return {
    number: invoice.id,
    order: invoice.orderId,
    customerOrderNo: order?.customerRef || order?.poNumber || "",
    accountNo: c?.accountNo || c?.id || "",
    cases: lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0),
    carriage: 0,
    customer: c?.name || "-",
    date: invoice.date ? fmtDate(invoice.date) : "-",
    due,
    status: isPaid ? "Paid" : paidSoFar > 0 ? "Part paid" : "Sent",
    lines,
    net,
    vat: invoice.vat,
    amount: invoice.amount,
    paid: paidSoFar,
    balance,

    /* extra details printed on the invoice */
    clientInfo: { name: c?.name || "-", contact: c?.contact || "", email: c?.email || "", phone: c?.phone || "", address: c?.address || "", pincode: c?.pincode || "" },
    areaManager: am?.name || "",
    payment: pay
      ? {
          receipt: pay.id, date: fmtDate(pay.date), method: pay.method, reference: pay.reference || "-", amount: pay.amount,
          payerName: pay.payerName || "", chequeNo: pay.chequeNo || "", bankName: pay.bankName || "", accountHolder: pay.accountHolder || "",
        }
      : null,
  };
}