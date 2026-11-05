import CountUp from "@/components/CountUp/CountUp.jsx";
import { CURRENCY } from "@/config/constants.js";
import "./SummaryStrip.css";

/*
 * Row of animated totals shown above a table.
 * items = [{ label, value, dec, money, suffix, icon, tone }]
 *   money : true  -> prefix the currency symbol
 *   tone  : red | blue | orange | purple | green  (icon badge color)
 */
export default function SummaryStrip({ items, columns }) {
  return (
    <div className="sum-strip card" style={columns ? { "--cols": columns } : undefined}>
      {items.map((s, i) => (
        <div className="sum-item" key={s.label} style={{ "--i": i }}>
          <span className={`sum-icon tone-${s.tone}`}><i className={`fa-solid ${s.icon}`} aria-hidden="true" /></span>
          <div>
            <p className="sum-label">{s.label}</p>
            <p className="sum-value">
              <CountUp value={s.value} decimals={s.dec} prefix={s.money ? CURRENCY : ""} suffix={s.suffix || ""} />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
