import { product, gbp } from "@/data/orderHubStore.js";
import "./LineItemsTable.css";

/* Read-only table of an order's lines (item, description, qty, price, line total) */
export default function LineItemsTable({ lines }) {
  return (
    <div className="lit-scroll">
      <table className="lit">
        <thead><tr><th>Item</th><th>Description</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Line total</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.code}>
              <td className="hub-mono">{l.code}</td>
              <td>{product(l.code)?.description}</td>
              <td className="r">{l.qty}</td>
              <td className="r">{gbp(l.price)}</td>
              <td className="r">{gbp(l.qty * l.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
