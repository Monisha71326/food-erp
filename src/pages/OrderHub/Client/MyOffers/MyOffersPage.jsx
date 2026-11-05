import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { HubCard, HubStatus, ViewingAs } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, product } from "@/data/orderHubStore.js";
import "./MyOffersPage.css";

export default function MyOffersPage() {
  const s = useHub();
  const c = client(s.session.clientId);
  const offers = s.promotions.filter((p) => c.promoIds.includes(p.id));
  return (
    <div className="page-anim my-offers-page">
      <PageHeader eyebrow="CLIENT PORTAL" title="My Offers" subtitle="Promotions assigned to this account only." icon="fa-gift" actions={<ViewingAs kind="client" />} />
      {offers.length ? (
        <div className="hub-grid cols-3">
          {offers.map((p) => (
            <HubCard key={p.id}>
              <div className="hub-row between">
                <b className="hub-mono offer-code">{p.code}</b>
                <HubStatus status={p.active ? "Active" : "Inactive"} />
              </div>
              <p className="offer-pct">{p.discountPct}% off</p>
              <p className="offer-on">{p.productCodes?.length ? `On: ${p.productCodes.map((code) => product(code)?.description || code).join(", ")}` : "On: all products"}</p>
              <p className="muted hub-small">{p.note}</p>
            </HubCard>
          ))}
        </div>
      ) : (
        <HubCard><p className="muted offer-empty">No offers assigned to this account right now.</p></HubCard>
      )}
    </div>
  );
}