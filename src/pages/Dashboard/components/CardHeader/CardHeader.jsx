import { ArrowRight, ChevronDown } from "lucide-react";
import { goTo } from "@/data/orderHubStore.js";
import "./CardHeader.css";

/*
 * Title row of a dashboard card.
 *   viewAll     : show the "View All ->" link on the right
 *   viewAllTo   : sidebar page to open when "View All" is clicked, e.g. "Orders"
 *   onViewAll   : (optional) your own click handler instead of viewAllTo
 *   selectLabel : show a period dropdown button on the right, e.g. "This Month"
 */
export default function CardHeader({ title, viewAll = false, viewAllTo, onViewAll, selectLabel }) {
  const handleViewAll = (e) => {
    e.preventDefault();
    if (onViewAll) onViewAll();
    else if (viewAllTo) goTo(viewAllTo);
  };

  return (
    <div className="card-head">
      <h2>{title}</h2>
      {viewAll && (
        <a href="#" className="view-all" onClick={handleViewAll}>
          View All <ArrowRight size={13} />
        </a>
      )}
      {selectLabel && (
        <button type="button" className="select-btn">
          {selectLabel} <ChevronDown size={14} />
        </button>
      )}
    </div>
  );
}