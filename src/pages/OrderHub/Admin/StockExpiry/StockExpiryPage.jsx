import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubButton, HubNotice } from "@/components/HubUI/HubUI.jsx";
import { useHub, product, daysUntil } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./StockExpiryPage.css";

export default function StockExpiryPage() {
  const s = useHub();
  const [msg, setMsg] = useState("");
  const rows = s.inventory.map((r, i) => ({ ...r, id: `${r.batch}-${i}`, days: daysUntil(r.expiry) })).sort((a, b) => a.days - b.days);
  const columns = [
    { key: "code", label: "Item", sortable: true, render: (r) => <span className="hub-mono">{r.code}</span> },
    { key: "desc", label: "Description", render: (r) => product(r.code)?.description },
    { key: "source", label: "Source", sortable: true },
    { key: "batch", label: "Batch", sortable: true, render: (r) => <span className="hub-mono">{r.batch}</span> },
    { key: "qty", label: "Qty", align: "right", sortable: true },
    { key: "days", label: "Expiry", sortable: true, render: (r) => <StatusPill tone={r.days <= 7 ? "red" : r.days <= 30 ? "orange" : "green"} status={`${fmtDate(r.expiry)} (${r.days}d)`} /> },
  ];
  return (
    <div className="page-anim stock-expiry-page">
      <PageHeader eyebrow="INVENTORY & SUPPLY CHAIN" title="Stock & Expiry" subtitle="Merged from Eden Farm, Iceco and factory uploads - twice weekly." icon="fa-cubes"
        actions={<HubButton variant="ghost" icon="fa-file-arrow-up" onClick={() => setMsg("In the full build this uploads the Eden Farm / Iceco / factory stock files and reconciles them against this table automatically.")}>Upload stock file</HubButton>} />
      <HubNotice>{msg}</HubNotice>
      <DataTable columns={columns} rows={rows} entity="stock batches" searchPlaceholder="Search in Stock" />
    </div>
  );
}
