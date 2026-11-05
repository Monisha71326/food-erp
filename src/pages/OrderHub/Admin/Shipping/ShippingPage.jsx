import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import { HubCard, HubButton, HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, generateLabel } from "@/data/orderHubStore.js";
import "./ShippingPage.css";

export default function ShippingPage() {
  const s = useHub();
  const ready = s.orders.filter((o) => o.status === "Delivered & Invoiced" && !s.shipments.find((x) => x.orderId === o.id));
  const readyCols = [
    { key: "id", label: "Order", sortable: true },
    { key: "client", label: "Client", sortable: true, sortValue: (r) => client(r.clientId).name, render: (r) => client(r.clientId).name },
    { key: "act", label: "", render: (r) => <HubButton size="sm" variant="ghost" icon="fa-tag" onClick={() => generateLabel(r.id)}>Generate DPD label</HubButton> },
  ];
  const doneCols = [
    { key: "orderId", label: "Order", sortable: true },
    { key: "trackingRef", label: "Tracking Ref", sortable: true, render: (r) => <span className="hub-mono">{r.trackingRef}</span> },
    { key: "st", label: "Status", render: () => <HubStatus status="Label generated" /> },
  ];
  return (
    <div className="page-anim shipping-page">
      <PageHeader eyebrow="FULFILMENT & LOGISTICS" title="Shipping (DPD)" subtitle="Generate a DPD shipping label once an order is confirmed." icon="fa-truck-fast" />
      <HubCard title="Ready to ship"><DataTable columns={readyCols} rows={ready} entity="orders" searchPlaceholder="Search orders" /></HubCard>
      <HubCard title="Labels generated"><DataTable columns={doneCols} rows={s.shipments} entity="labels" searchPlaceholder="Search labels" /></HubCard>
    </div>
  );
}
