/* VAT helper shared by Invoices and Orders.
   If a record has net / vat fields they are used.
   Otherwise `amount` is treated as VAT-INCLUSIVE and split with VAT_RATE.
   If your amounts are NET (VAT added on top), change the else-branch below. */
export const VAT_RATE = 20; // percent

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const has = (v) => v !== undefined && v !== null && v !== "";

export function vatSplit(row, rate = VAT_RATE) {
  const gross = Number(row?.amount ?? row?.total ?? 0) || 0;
  let net;
  let vat;

  if (has(row?.vat)) {
    vat = Number(row.vat);
    net = has(row?.net) ? Number(row.net) : gross - vat;
  } else if (has(row?.net)) {
    net = Number(row.net);
    vat = gross - net;
  } else {
    net = gross / (1 + rate / 100);
    vat = gross - net;
  }

  net = round2(net);
  vat = round2(vat);
  const pct = net > 0 ? Math.round((vat / net) * 1000) / 10 : rate;
  return { net, vat, gross: round2(gross), rate: pct };
}