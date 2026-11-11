import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import OrderForm from "@/components/OrderForm/OrderForm.jsx";
import { Field, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { useHub, manager, client, clientManager } from "@/data/orderHubStore.js";
import { currentUser } from "@/data/authStore.js";
import "./PlaceOrderForClientPage.css";

export default function PlaceOrderForClientPage() {
  const s = useHub();
  const m = manager(s.session.managerId);
  /* Admin (anyone who is not a Client / Area Manager) can place an order for ANY client.
     A real area manager only sees the clients assigned to them. */
  const isAdmin = !["client", "manager"].includes(currentUser()?.role);
  const ids = isAdmin ? s.clients.map((c) => c.id) : (m?.clientIds || []);
  const [clientId, setClientId] = useState(ids[0]);
  const cid = ids.includes(clientId) ? clientId : ids[0];
  /* the order is placed in the name of the area manager who covers this client (the server only accepts that manager) */
  const owner = isAdmin ? (clientManager(cid) || m) : m;

  return (
    <div className="page-anim place-order-client-page">
      <PageHeader
        eyebrow="AREA MANAGER"
        title="Place Order for Client"
        subtitle="Prices switch to the selected client's agreed rates."
        icon="fa-cart-plus"
        actions={<ViewingAs kind="manager" />}
        showPrint={false}
      />
      {cid ? (
        <OrderForm key={cid} clientId={cid} placedBy={`Area manager: ${owner?.name || "Admin"}`}>
          <Field label="Client" className="poc-client">
            <select value={cid} onChange={(e) => setClientId(e.target.value)}>
              {ids.map((id) => <option key={id} value={id}>{client(id)?.name || id}</option>)}
            </select>
          </Field>
        </OrderForm>
      ) : (
        <p className="muted" style={{ padding: 16 }}>No clients available yet.</p>
      )}
    </div>
  );
}