import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubButton } from "@/components/HubUI/HubUI.jsx";
import { useHub, useReport, createPO } from "@/data/orderHubStore.js";
import "./DemandForecastingPage.css";

export default function DemandForecastingPage() {
  useHub(); // refresh the report after a PO is raised
  const rows = useReport("forecast") || []; // days-of-cover + suggested reorder are calculated by the API
  const raise = async (r) => {
    const res = await createPO({ code: r.code, qty: r.suggested, logUser: "AI Forecast", note: `Raised PO for ${r.suggested} x ${r.code} based on forecasted demand` });
    if (!res.ok) window.alert(res.msg);
  };

  const columns = [
    { key: "code", label: "Item", sortable: true, render: (r) => <span className="hub-mono">{r.code}</span> },
    { key: "description", label: "Description", sortable: true },
    { key: "demand", label: "Recent Demand", align: "right", sortable: true },
    { key: "stock", label: "Current Stock", align: "right", sortable: true },
    { key: "cover", label: "Days of Cover", align: "right", sortable: true },
    { key: "label", label: "Status", sortable: true, render: (r) => <StatusPill status={r.label} tone={r.tone} /> },
    { key: "suggested", label: "Suggested Reorder", align: "right", sortable: true },
    { key: "act", label: "", render: (r) => r.suggested > 0 && <HubButton size="sm" variant="ghost" icon="fa-cart-plus" onClick={() => raise(r)}>Create PO</HubButton> },
  ];
  return (
    <div className="page-anim demand-forecasting-page">
      <PageHeader eyebrow="INVENTORY & SUPPLY CHAIN" title="Demand Forecasting (AI)" subtitle="Estimated days-of-cover per item from recent order activity and current stock, with a suggested reorder quantity." icon="fa-chart-line" />
      <DataTable columns={columns} rows={rows} entity="items" searchPlaceholder="Search in Forecast" />
      <p className="muted df-note">Demo heuristic only - a real build would use actual sales history and supplier lead times.</p>
    </div>
  );
}
