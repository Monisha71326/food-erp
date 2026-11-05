import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { HubCard } from "@/components/HubUI/HubUI.jsx";
import "./AiIdeasPage.css";

const IDEAS = [
  ["Read PODs automatically", "Parse incoming Eden Farm emails (OCR + signature detection), match order / line / qty without a human opening each one.", "Fulfilment & Logistics > POD Auto-Match"],
  ["Demand forecasting", "Predict stock needs per item from order history so replenishment happens before Eden Farm / Iceco runs low.", "Inventory & Supply Chain > Demand Forecasting"],
  ["GPS + photo visit verification", "An area manager can only register a visit once their location matches the store, backed by a timestamped photo.", "Area Manager > Register a Visit"],
  ["Auto-draft invoices", "Once a POD fully matches, generate and send the invoice with no manual step.", null],
  ["Backorder triage", "Auto-raise a replenishment PO the moment a shortfall is logged, sized to the shortfall.", null],
  ["Expiry-aware allocation", "Automatically allocate oldest-expiry stock first (FEFO) when fulfilling orders.", null],
  ["Credit-control drafting", "Auto-draft (not auto-send) overdue reminder emails, ranked by how overdue and how large.", null],
  ["Promo targeting suggestions", "Recommend which clients to offer a new promotion to, based on order history and margin.", null],
  ["Anomaly flags", "Flag a price override or order that looks out of line with a client's normal pattern, for a human to check.", null],
];

export default function AiIdeasPage() {
  return (
    <div className="page-anim ai-ideas-page">
      <PageHeader eyebrow="SYSTEM & ADMIN" title="AI Automation Ideas" subtitle="Where AI could take over repetitive steps. Three are already wired up - the rest are for discussion." icon="fa-lightbulb" />
      <ul className="ai-list">
        {IDEAS.map(([title, text, built], i) => (
          <li key={title}>
            <HubCard>
              <div className="ai-item">
                <span className="ai-badge">{i + 1}</span>
                <div>
                  <div className="hub-row"><b>{title}</b>{built && <StatusPill tone="green" status={`Built - ${built}`} />}</div>
                  <p className="muted ai-text">{text}</p>
                </div>
              </div>
            </HubCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
