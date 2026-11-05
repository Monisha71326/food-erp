import { useEffect, useState } from "react";
import { InvoicePrintPortal, printInvoiceDocument } from "./InvoicePrint.jsx";
import { useInvoiceTemplate } from "@/data/invoiceTemplateStore.js";

/*
 * const [printInvoice, printPortal] = usePrintInvoice(money);
 *   - printInvoice(data) : prints the invoice (data shape = see InvoicePrint.jsx)
 *   - printPortal        : put {printPortal} once anywhere in the page's JSX
 */
export default function usePrintInvoice(money) {
  const tpl = useInvoiceTemplate(); // template chosen in Settings -> Invoice Templates
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!data) return undefined;
    // wait a moment so the hidden invoice is in the DOM before the print dialog opens
    const t = setTimeout(() => {
      window.addEventListener("afterprint", () => setData(null), { once: true });
      printInvoiceDocument();
    }, 60);
    return () => clearTimeout(t);
  }, [data]);

  const portal = data ? <InvoicePrintPortal tpl={tpl} data={data} money={money} /> : null;
  return [setData, portal];
}