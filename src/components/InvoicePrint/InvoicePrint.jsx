import { createPortal } from "react-dom";
import { accentCss, resolveTpl } from "@/data/invoiceTemplateStore.js";
import logo from "@/assets/logo.webp"; // real Zulekha logo (same file the sidebar uses)
import tradeLogo from "@/assets/invoice-logo.png"; // logo used by the Trade template
import "./InvoicePrint.css";

/* Shared invoice document: used for printing (Invoices page) AND for the live preview
   in Settings -> Invoice Templates. The look comes from the template settings (tpl).
   Colours are picked from tpl.colors[tpl.templateId] (each template has its own colour).

   data = {
     number, order, customer, date, due, status,      // date / due already formatted as text
     amount, balance, paid?,                          // numbers
     net?, vat?,                                      // numbers (optional)
     lines?: [{ desc, qty, price, total, vat? }],     // optional item lines (vat = VAT amount of that line)
     clientInfo?: { name, contact, email, address },  // optional: client details under "Bill to"
     areaManager?: string,                            // optional: area manager name
     payment?: { receipt, date, method, reference, amount } | null,  // optional: payment details
   }
*/
/* ---------- TRADE layout: same layout as the supplier PDF (From + logo, To box, meta box, Quantity/Details table, bank box, totals, signature) ---------- */
function TradeInvoice({ tpl, data }) {
  const addr = String(tpl.address || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const lines = data.lines?.length
    ? data.lines
    : [{ desc: `Invoice ${data.number}${data.order ? ` (Order ${data.order})` : ""}`, qty: 1, price: data.net ?? data.amount, total: data.net ?? data.amount }];
  const hasVat = lines.some((l) => l.vat != null); // show the VAT column only when lines carry a VAT amount
  const ci = data.clientInfo;
  const custAddr = [...String(ci?.address || "").split(/\n|,\s*/), ci?.pincode].map((s) => String(s || "").trim()).filter(Boolean);

  const amount = Number(data.amount || 0);
  const balance = Number(data.balance || 0);
  const paid = data.paid != null ? Number(data.paid) : Math.max(0, amount - balance);
  const isPaid = String(data.status || "").toLowerCase() === "paid" || balance <= 0;

  const num = (n) => Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bank = [
    ["Bank", tpl.bankName],
    ["Account Name", tpl.accountName],
    ["Account Number", tpl.accountNumber],
    ["Sort Code", tpl.sortCode],
    ["IBAN", tpl.iban],
  ];
  const pay = data.payment;
  const payRows = pay
    ? (pay.method === "Cheque"
        ? [
            ["Payment Method", "Cheque"],
            ["Cheque No.", pay.chequeNo || pay.reference],
            ["Bank", pay.bankName],
            ["Account Holder", pay.accountHolder || pay.payerName],
            ["Payment Date", pay.date],
            ["Receipt No.", pay.receipt],
            ["Amount Paid", num(pay.amount)],
          ]
        : [
            ["Payment Method", pay.method],
            ["Payer Name", pay.payerName],
            ["Transaction Ref.", pay.reference],
            ["Payment Date", pay.date],
            ["Receipt No.", pay.receipt],
            ["Amount Paid", num(pay.amount)],
          ]
      ).filter(([, v]) => v)
    : [];
  const meta = [
    ["Invoice No.", data.number || ""],
    ["Invoice / Tax Date", data.date || ""],
    ["Customer Order No.", data.customerOrderNo || data.order || ""],
    ["Account No.", data.accountNo || ""],
  ];

  return (
    <div className="ipr-doc t-trade">
      <header className="trd-head">
        <div className="trd-from">
          <h1>{tpl.title || "Invoice"}</h1>
          <u>From:</u>
          <b>{tpl.companyName}</b>
          {addr.map((l, i) => <span key={i}>{l}</span>)}
          {tpl.vatNo && <span className="trd-vat">VAT Reg No: {tpl.vatNo}</span>}
        </div>
        <img className="trd-logo" src={tradeLogo} alt={tpl.companyName} />
      </header>

      <section className="trd-parties">
        <div className="trd-to">
          <u>To:</u>
          <b>{data.customer || "-"}</b>
          {ci?.contact && <span>{ci.contact}</span>}
          {custAddr.map((l, i) => <span key={i}>{l}</span>)}
          {ci?.phone && <span>Tel: {ci.phone}</span>}
          {ci?.email && <span>{ci.email}</span>}
        </div>
        <dl className="trd-meta">
          {meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <table className="trd-table">
        <thead>
          <tr>
            <th className="q">Quantity</th>
            <th>Details</th>
            <th className="r">Unit Price</th>
            {hasVat && <th className="r">VAT</th>}
            <th className="r">Net Amt</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="q">{l.qty != null ? Number(l.qty).toFixed(2) : ""}</td>
              <td>{l.desc}</td>
              <td className="r">{l.price != null ? num(l.price) : ""}</td>
              {hasVat && <td className="r">{l.vat != null ? num(l.vat) : ""}</td>}
              <td className="r">{num(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="trd-spacer" />

      {data.cases != null && <div className="trd-cases">Cases Delivered - <span>{num(data.cases)}</span></div>}

      <section className="trd-bottom">
        <div className="trd-left">
          <dl className="trd-bank">
            {bank.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "\u00a0"}</dd></div>)}
          </dl>
          {pay && (
            <dl className="trd-pay">
              <div className="trd-pay-head"><b>Payment Received</b><em>PAID</em></div>
              {payRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}
          {!pay && tpl.showPaidStamp && isPaid && <em className="trd-paid">PAID</em>}
        </div>
        <div className="trd-totals">
          {data.net != null && <div><span>Total Net Amount</span><b>{num(data.net)}</b></div>}
          <div><span>Carriage Net</span><b>{num(data.carriage || 0)}</b></div>
          {data.vat != null && <div><span>Total VAT Amount</span><b>{num(data.vat)}</b></div>}
          <div><span>Invoice Total £</span><b>{num(amount)}</b></div>
          <div><span>Amount Paid £</span><b>{num(paid)}</b></div>
          <div className="trd-balance"><span>Balance Due £</span><b>{num(balance)}</b></div>
        </div>
      </section>

      {tpl.terms && <p className="trd-terms">{tpl.terms}</p>}

      <div className="trd-sign">
        <span>Signature -</span><i />
        <span>Print -</span><i />
      </div>
    </div>
  );
}

export function InvoiceDocument({ tpl: rawTpl, data, money }) {
  const tpl = resolveTpl(rawTpl); // picks the colours of the selected template
  if (tpl.templateId === "trade") return <TradeInvoice tpl={tpl} data={data} />;
  const addr = String(tpl.address || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const lines = data.lines?.length
    ? data.lines
    : [{ desc: `Invoice ${data.number}${data.order ? ` (Order ${data.order})` : ""}`, total: data.amount }];
  const hasQty = lines.some((l) => l.qty != null);
  const hasVat = lines.some((l) => l.vat != null); // show the VAT column only when lines carry a VAT amount

  const amount = Number(data.amount || 0);
  const balance = Number(data.balance || 0);
  const paid = data.paid != null ? Number(data.paid) : Math.max(0, amount - balance);
  const isPaid = String(data.status || "").toLowerCase() === "paid" || balance <= 0;

  const ci = data.clientInfo;
  const pay = data.payment;

  const meta = [
    ["Invoice no.", data.number || "-"],
    ["Order no.", data.order || "-"],
    ["Invoice date", data.date || "-"],
    ["Due date", data.due || "-"],
    ["Status", isPaid ? "Paid" : data.status || "-"],
  ];

  // plain colour OR gradient (chosen in Settings -> Invoice Templates)
  const { solid, image } = accentCss(tpl);

  return (
    <div className={`ipr-doc t-${tpl.templateId}`} style={{ "--acc": solid, "--acc-bg": image }}>
      <header className="ipr-head">
        <div className="ipr-brand">
          <span className="ipr-logo"><img src={logo} alt="Zulekha" /></span>
          <div className="ipr-brandtext">
            <h1>{tpl.companyName}</h1>
            {addr.map((l, i) => <p key={i}>{l}</p>)}
            {tpl.vatNo && <p>VAT No. {tpl.vatNo}</p>}
          </div>
        </div>
        <div className="ipr-titlebox">
          <span className="ipr-title">{tpl.title}</span>
          <span className="ipr-num">{data.number}</span>
        </div>
      </header>

      <section className="ipr-parties">
        <div className="ipr-billto">
          <small>Bill to</small>
          <b>{data.customer || "-"}</b>
          {ci?.contact && <span>{ci.contact}</span>}
          {ci?.email && <span>{ci.email}</span>}
          {ci?.phone && <span>Tel: {ci.phone}</span>}
          {ci?.address && <span>{ci.address}{ci.pincode ? `, ${ci.pincode}` : ""}</span>}
          {data.areaManager && <span className="ipr-am">Area manager: <b>{data.areaManager}</b></span>}
        </div>
        <dl className="ipr-meta">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{k === "Status" ? <em className={`ipr-chip ${isPaid ? "ok" : "due"}`}>{v}</em> : v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <table className="ipr-table">
        <thead>
          <tr>
            <th>Description</th>
            {hasQty && <><th className="r">Qty</th><th className="r">Price</th></>}
            {hasVat && <th className="r">VAT</th>}
            <th className="r">{hasQty ? "Total" : "Amount"}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{l.desc}</td>
              {hasQty && <><td className="r">{l.qty ?? ""}</td><td className="r">{l.price != null ? money(l.price) : ""}</td></>}
              {hasVat && <td className="r">{l.vat != null ? money(l.vat) : ""}</td>}
              <td className="r">{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ipr-summary">
        <div className="ipr-summary-l">
        {(pay || data.payment !== undefined) && (
          <div className="ipr-pay">
            <div className="ipr-pay-head">
              <small>Payment details</small>
              <em className={`ipr-chip ${isPaid ? "ok" : "due"}`}>{isPaid ? "Paid" : "Payment due"}</em>
            </div>
            {pay ? (
              <dl>
                {[
                  ["Receipt no.", pay.receipt],
                  ["Payment date", pay.date],
                  ["Method", pay.method],
                  ["Reference", pay.reference],
                  ["Amount paid", money(pay.amount)],
                ].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            ) : (
              <p>{isPaid ? "Paid - no online payment record (settled outside the portal)." : `No payment received yet. Balance of ${money(balance)} is due by ${data.due || "-"}.`}</p>
            )}
          </div>
        )}
        {tpl.showPaidStamp && isPaid && <div className="ipr-stamp">PAID</div>}
        </div>
        <div className="ipr-totals">
          {data.net != null && <div><span>Net</span><b>{money(data.net)}</b></div>}
          {data.vat != null && <div><span>VAT</span><b>{money(data.vat)}</b></div>}
          <div><span>Invoice total</span><b>{money(amount)}</b></div>
          <div><span>Paid</span><b>{money(paid)}</b></div>
          <div className="ipr-grand"><span>Balance due</span><b>{money(balance)}</b></div>
        </div>
      </div>

      {tpl.terms && (
        <div className="ipr-terms">
          <small>Terms &amp; notes</small>
          <p>{tpl.terms}</p>
        </div>
      )}

      <footer className="ipr-foot">{tpl.footerNote}</footer>
    </div>
  );
}

/* Hidden on screen, shown (alone, centered) when printing. Render it only when there is something to print. */
export function InvoicePrintPortal(props) {
  return createPortal(
    <div className="ipr-print-root"><InvoiceDocument {...props} /></div>,
    document.body
  );
}

/* Print-only rules, injected just for the print job and removed afterwards.
   Everything directly under <body> except the invoice portal is hidden, so only that one invoice prints. */
const PRINT_STYLE_ID = "ipr-print-style";
const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
@media print {
  html body.ipr-printing {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    height: auto !important;
    overflow: visible !important;
  }
  html body.ipr-printing > *:not(.ipr-print-root) {
    display: none !important;
  }
  html body.ipr-printing > .ipr-print-root {
    display: block !important;
    position: static !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  html body.ipr-printing .ipr-print-root,
  html body.ipr-printing .ipr-print-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

/* Call this from a "Print" button after <InvoicePrintPortal /> is on the page. */
export function printInvoiceDocument() {
  let style = document.getElementById(PRINT_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = PRINT_CSS;

  const cleanup = () => {
    document.body.classList.remove("ipr-printing");
    document.getElementById(PRINT_STYLE_ID)?.remove();
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  document.body.classList.add("ipr-printing");
  window.print();
}