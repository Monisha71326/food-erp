import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import OrderForm from "@/components/OrderForm/OrderForm.jsx";
import { Field, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { useHub, manager, client } from "@/data/orderHubStore.js";
import "./PlaceOrderForClientPage.css";

export default function PlaceOrderForClientPage() {
  const s = useHub();
  const m = manager(s.session.managerId);
  const [clientId, setClientId] = useState(m.clientIds[0]);
  useEffect(() => { setClientId(m.clientIds[0]); }, [m.id]);
  const cid = m.clientIds.includes(clientId) ? clientId : m.clientIds[0];

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
      <OrderForm key={cid} clientId={cid} placedBy={`Area manager: ${m.name}`}>
        <Field label="Client" className="poc-client">
          <select value={cid} onChange={(e) => setClientId(e.target.value)}>
            {m.clientIds.map((id) => <option key={id} value={id}>{client(id).name}</option>)}
          </select>
        </Field>
      </OrderForm>
    </div>
  );
}