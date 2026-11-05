import "./MiniTable.css";

/*
 * Compact table used inside dashboard cards.
 *   columns    : [{ label, render(row), className? }]
 *   rows       : array of objects
 *   getKey     : row -> unique key
 *   onRowClick : (row) => void   (optional, makes rows clickable)
 */
export default function MiniTable({ columns, rows, getKey, onRowClick }) {
  return (
    <div className="mini-wrap">
      <table className="mini-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.label} className={c.className}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={getKey(row)}
              style={{ "--i": i }}
              className={onRowClick ? "clickable" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => <td key={c.label} className={c.className}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}