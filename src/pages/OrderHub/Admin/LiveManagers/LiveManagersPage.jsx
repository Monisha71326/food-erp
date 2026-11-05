import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import LiveManagersPanel from "@/components/LiveManagersPanel/LiveManagersPanel.jsx";
import ManagerVisitsPanel from "@/components/ManagerVisitsPanel/ManagerVisitsPanel.jsx";
import "./LiveManagersPage.css";

export default function LiveManagersPage() {
  return (
    <div className="page-anim live-managers-page">
      <PageHeader
        eyebrow="FULFILMENT & LOGISTICS"
        title="Managers Live Location"
        subtitle="Area managers who are sharing their location right now, and their store check-ins"
        icon="fa-location-crosshairs"
      />
      <LiveManagersPanel />
      <ManagerVisitsPanel />
    </div>
  );
}