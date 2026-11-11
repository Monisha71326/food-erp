import { gbp } from "@/data/orderHubStore.js";
import "./VisitSplit.css";

/* ONSITE / OFFSITE summary card: donut + split bar + two detail tiles */
export default function VisitSplit({ onsiteCount, offsiteCount, onsiteValue, offsiteValue }) {
  const total = onsiteCount + offsiteCount;
  const totalValue = onsiteValue + offsiteValue;
  const onPct = total > 0 ? (onsiteCount / total) * 100 : 0;
  const offPct = total > 0 ? 100 - onPct : 0;
  const valPct = (v) => (totalValue > 0 ? (v / totalValue) * 100 : 0);

  const donut = total > 0
    ? `conic-gradient(#16a34a 0 ${onPct}%, #d97706 ${onPct}% 100%)`
    : "conic-gradient(rgba(100,116,139,0.25) 0 100%)";

  const tiles = [
    { key: "on", tone: "green", icon: "fa-location-crosshairs", label: "ONSITE", hint: "Placed at the store", count: onsiteCount, value: onsiteValue, pct: onPct },
    { key: "off", tone: "orange", icon: "fa-location-pin-lock", label: "OFFSITE", hint: "Placed away from the store", count: offsiteCount, value: offsiteValue, pct: offPct },
  ];

  return (
    <section className="vs-card">
      <header className="vs-head">
        <div>
          <b>Visit Type</b>
          <small>Onsite vs Offsite orders you placed</small>
        </div>
        <span className="vs-total"><i className="fa-solid fa-bag-shopping" /> {total} orders</span>
      </header>

      {total === 0 ? (
        <div className="vs-empty">
          <i className="fa-solid fa-location-dot" />
          <p>No ONSITE / OFFSITE orders yet. They appear after you place an order for a client.</p>
        </div>
      ) : (
        <div className="vs-body">
          <div className="vs-donut" style={{ background: donut }} role="img" aria-label={`${onPct.toFixed(0)}% onsite, ${offPct.toFixed(0)}% offsite`}>
            <div className="vs-donut-hole">
              <b>{onPct.toFixed(0)}%</b>
              <small>ONSITE</small>
            </div>
          </div>

          <div className="vs-side">
            <div className="vs-bar" aria-hidden="true">
              <i className="g" style={{ width: `${onPct}%` }} />
              <i className="o" style={{ width: `${offPct}%` }} />
            </div>
            <div className="vs-tiles">
              {tiles.map((t) => (
                <div key={t.key} className={`vs-tile ${t.tone}`}>
                  <span className="vs-ico"><i className={`fa-solid ${t.icon}`} /></span>
                  <div className="vs-tile-main">
                    <small>{t.label}</small>
                    <b>{t.count} <em>orders</em></b>
                    <span className="vs-val">{gbp(t.value)} <em>{valPct(t.value).toFixed(0)}% of sale value</em></span>
                  </div>
                  <span className="vs-pct">{t.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <p className="vs-note"><i className="fa-solid fa-circle-info" /> Client portal orders are not counted.</p>
          </div>
        </div>
      )}
    </section>
  );
}