import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import { amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubButton, HubNotice } from "@/components/HubUI/HubUI.jsx";
import { useReport, sendReminder } from "@/data/orderHubStore.js";
import "./CreditControlPage.css";

export default function CreditControlPage() {
  const [msg, setMsg] = useState(null); // { ok, text }
  const rows = useReport("credit-control") || []; // balance vs limit is calculated by the API
  const remind = async (r) => {
    const res = await sendReminder(r.id);
    setMsg({ ok: res.ok, text: res.ok ? `Reminder logged for ${r.name} (the full build emails the client automatically).` : res.msg });
  };
  const columns = [
    { key: "name", label: "Client", sortable: true },
    amountColumn("balance", "Balance", 2),
    amountColumn("creditLimit", "Credit Limit", 2),
    { key: "over", label: "Status", sortable: true, render: (r) => <StatusPill status={r.over ? "Over limit" : "Within limit"} tone={r.over ? "red" : "green"} /> },
    { key: "act", label: "", render: (r) => r.over && <HubButton size="sm" variant="ghost" icon="fa-envelope" onClick={() => remind(r)}>Send reminder</HubButton> },
  ];
  return (
    <div className="page-anim credit-control-page">
      <PageHeader eyebrow="FINANCE & CREDIT CONTROL" title="Credit Control" subtitle="Outstanding balance against each client's credit limit." icon="fa-scale-balanced" />
      <HubNotice tone={msg?.ok ? "green" : "red"}>{msg?.text}</HubNotice>
      <DataTable columns={columns} rows={rows} entity="clients" searchPlaceholder="Search in Clients" />
    </div>
  );
}
