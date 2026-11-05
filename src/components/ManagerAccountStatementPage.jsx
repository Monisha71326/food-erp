import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { useHub, manager, client } from "@/data/orderHubStore.js";
import { currentUser } from "@/data/authStore.js";
import AccountStatementPage from "@/pages/OrderHub/Client/AccountStatement/AccountStatementPage.jsx";
import "@/pages/OrderHub/Client/AccountStatement/AccountStatementPage.css";

/* Area Manager "Client Account Statement":
   credit notes are hidden only when an Area Manager is logged in; Admin / ERP Administrator still see them */
export default function ManagerAccountStatementPage() {
  const s = useHub();
  const m = manager(s.session.managerId);
  const covered = m.clientIds.map((id) => client(id)).filter(Boolean);

  const isManager = currentUser()?.role === "manager";

  const [selected, setSelected] = useState(covered[0]?.id || "");

  return (
    <div className="page-anim account-statement-page">
      <PageHeader
        eyebrow="AREA MANAGER"
        title="Client Account Statement"
        subtitle={`All ${covered.length} client${covered.length === 1 ? "" : "s"} in one view`}
        icon="fa-file-lines"
        actions={<ViewingAs kind="manager" />}
        showPrint={false}
      />

      <div className="statement-head" id="mgr-client-statement">
        <h3 className="statement-title"><i className="fa-solid fa-user" aria-hidden="true" /> Client Statement</h3>
        <select
          className="as-client-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Select client"
        >
          <option value="">Select a client...</option>
          {covered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selected
        ? <AccountStatementPage key={selected} clientId={selected} embedded hideCredits={isManager} />
        : <div className="statement-note"><i className="fa-solid fa-circle-info" aria-hidden="true" /> Select a client from the dropdown to see the full account statement.</div>}
    </div>
  );
}