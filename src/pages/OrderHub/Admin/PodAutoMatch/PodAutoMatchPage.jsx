import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import { HubCard, HubButton } from "@/components/HubUI/HubUI.jsx";
import { useHub, runAutoMatch } from "@/data/orderHubStore.js";
import "./PodAutoMatchPage.css";

const columns = [
  { key: "orderId", label: "Order", sortable: true },
  { key: "client", label: "Client", sortable: true },
  { key: "result", label: "Result" },
];

export default function PodAutoMatchPage() {
  const s = useHub();
  const pending = s.orders.filter((o) => o.status === "With Delivery Partner").length;
  return (
    <div className="page-anim pod-auto-page">
      <PageHeader eyebrow="FULFILMENT & LOGISTICS" title="POD Auto-Match (AI)" subtitle="AI reads each delivery note as it lands in the POD inbox, matches it to the order and invoices or backorders it automatically." icon="fa-robot" />
      <HubCard>
        <div className="hub-row between">
          <div><b>{pending}</b> <span className="muted hub-small">order(s) currently waiting on a POD</span></div>
          <HubButton icon="fa-wand-magic-sparkles" disabled={!pending} onClick={runAutoMatch}>Run auto-match now</HubButton>
        </div>
        <p className="muted hub-small pa-note">Simulates the AI reading real POD emails: it checks the signature, matches quantities line by line, then raises the invoice or logs a backorder - same rules as manual matching, just automatic.</p>
      </HubCard>
      <HubCard title="Last run results">
        {s.lastAutoMatch ? (s.lastAutoMatch.length
          ? <DataTable columns={columns} rows={s.lastAutoMatch} entity="results" searchPlaceholder="Search results" />
          : <p className="muted">Nothing was waiting on a POD.</p>)
          : <p className="muted">Run auto-match to see results here.</p>}
      </HubCard>
    </div>
  );
}