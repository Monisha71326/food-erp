import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import { HubCard } from "@/components/HubUI/HubUI.jsx";
import { useReport, gbp } from "@/data/orderHubStore.js";
import "./SalesReportingPage.css";

export default function SalesReportingPage() {
  const rep = useReport("sales"); // totals are calculated by the API (SQL)
  const rows = rep?.byClient || [];
  const max = Math.max(1, ...rows.map((r) => r.total));
  const items = [
    { label: "Order Value (All Time)", value: rep?.orderValue || 0, dec: 2, money: true, icon: "fa-chart-line", tone: "blue" },
    { label: "Invoiced Value", value: rep?.invoicedValue || 0, dec: 2, money: true, icon: "fa-file-invoice-dollar", tone: "green" },
    { label: "Orders Placed", value: rep?.ordersPlaced || 0, dec: 0, icon: "fa-bag-shopping", tone: "purple" },
  ];
  return (
    <div className="page-anim sales-reporting-page">
      <PageHeader eyebrow="SALES & MARKETING" title="Sales Reporting" icon="fa-chart-column" />
      <SummaryStrip items={items} columns={3} />
      <HubCard title="Sales by client">
        {rows.length ? rows.map((r) => (
          <div className="sr-bar" key={r.name}>
            <div className="hub-row between hub-small"><span>{r.name}</span><span className="hub-mono">{gbp(r.total)}</span></div>
            <div className="sr-track"><div style={{ width: `${(r.total / max) * 100}%` }} /></div>
          </div>
        )) : <p className="muted">No sales yet.</p>}
      </HubCard>
    </div>
  );
}
