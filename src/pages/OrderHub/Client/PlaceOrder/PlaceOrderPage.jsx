import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import OrderForm from "@/components/OrderForm/OrderForm.jsx";
import { ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { useHub, client } from "@/data/orderHubStore.js";
import "./PlaceOrderPage.css";

export default function PlaceOrderPage() {
  const s = useHub();
  const c = client(s.session.clientId);
  return (
    <div className="page-anim place-order-page">
      <PageHeader
        eyebrow="CLIENT PORTAL"
        title="Place an Order"
        subtitle="Prices below already reflect the account's agreed pricing."
        icon="fa-cart-plus"
        actions={<ViewingAs kind="client" />}
        showPrint={false}
      />
      <OrderForm key={c.id} clientId={c.id} placedBy="Client portal" showPromo />
    </div>
  );
}