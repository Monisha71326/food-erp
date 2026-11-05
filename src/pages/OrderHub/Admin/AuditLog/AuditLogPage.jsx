import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import { useHub } from "@/data/orderHubStore.js";
import "./AuditLogPage.css";

const columns = [
  { key: "ts", label: "When", sortable: true },
  { key: "user", label: "User", sortable: true },
  { key: "action", label: "Action" },
];

export default function AuditLogPage() {
  const s = useHub();
  return (
    <div className="page-anim audit-log-page">
      <PageHeader eyebrow="SYSTEM & ADMIN" title="Audit Log" subtitle="Every price change, order action and admin decision, timestamped." icon="fa-clock-rotate-left" />
      <DataTable columns={columns} rows={s.auditLog} entity="log entries" searchPlaceholder="Search in Audit Log" />
    </div>
  );
}
