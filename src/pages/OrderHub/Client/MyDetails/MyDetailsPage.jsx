import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { HubCard, Field, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { useHub, client } from "@/data/orderHubStore.js";
import "./MyDetailsPage.css";

export default function MyDetailsPage() {
  const s = useHub();
  const c = client(s.session.clientId);
  return (
    <div className="page-anim my-details-page">
      <PageHeader eyebrow="CLIENT PORTAL" title="My Details" icon="fa-id-card" actions={<ViewingAs kind="client" />} />
      <HubCard className="details-card">
        <div className="hub-stack" key={c.id}>
          <Field label="Business name"><input type="text" value={c.name} disabled readOnly /></Field>
          <Field label="Contact"><input type="text" value={c.contact} disabled readOnly /></Field>
          <Field label="Email"><input type="text" value={c.email || "-"} disabled readOnly /></Field>
          <Field label="Phone"><input type="text" value={c.phone || "-"} disabled readOnly /></Field>
          <Field label="Address"><input type="text" value={c.address || "-"} disabled readOnly /></Field>
          <Field label="Pincode"><input type="text" value={c.pincode || "-"} disabled readOnly /></Field>
          <Field label="Account ID"><input type="text" value={c.id} disabled readOnly /></Field>
        </div>
        <p className="muted hub-small details-note">Contact your account manager to update these details.</p>
      </HubCard>
    </div>
  );
}