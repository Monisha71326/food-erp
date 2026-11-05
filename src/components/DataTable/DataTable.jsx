import { useMemo, useState } from "react";
import "./DataTable.css";

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
}

export default function DataTable({ columns, rows, searchPlaceholder = "Search...", entity = "records", toolbarExtra = null }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [selected, setSelected] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [spin, setSpin] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).join(" ").toLowerCase().includes(q));
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const get = col?.sortValue || ((r) => r[sort.key]);
    const out = [...filtered].sort((a, b) => compare(get(a), get(b)));
    return sort.dir === "desc" ? out.reverse() : out;
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, pages);
  const startIdx = (safePage - 1) * perPage;
  const pageRows = sorted.slice(startIdx, startIdx + perPage);

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someOnPage = pageRows.some((r) => selected.has(r.id));

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => (allOnPage ? next.delete(r.id) : next.add(r.id)));
      return next;
    });

  const onSort = (col) => {
    if (!col.sortable) return;
    setSort((s) => (s.key === col.key ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" }));
  };

  const refresh = () => {
    setSpin(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setSpin(false), 700);
  };

  return (
    <section className="card dt-card">
      <div className="dt-toolbar">
        <label className="dt-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            type="text"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
          {query && (
            <button type="button" className="dt-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </label>

        {toolbarExtra}

        {selected.size > 0 && (
          <div className="dt-selbar">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />
            <strong>{selected.size}</strong> selected
            <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <button type="button" className="dt-icon-btn" onClick={refresh} title="Refresh" aria-label="Refresh">
          <i className={`fa-solid fa-rotate${spin ? " fa-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <div className="dt-scroll">
        <table className="dt">
          <thead>
            <tr>
              <th className="dt-check">
                <input
                  type="checkbox"
                  checked={allOnPage}
                  ref={(el) => { if (el) el.indeterminate = !allOnPage && someOnPage; }}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              {columns.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    data-col={c.key}
                    className={`${c.align === "right" ? "right " : ""}${c.sortable ? "sortable" : ""}`}
                    onClick={() => onSort(c)}
                  >
                    <span>{c.label}</span>
                    {c.sortable && (
                      <i
                        className={`fa-solid ${active ? (sort.dir === "asc" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"} sort-ic${active ? " on" : ""}`}
                        aria-hidden="true"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr
                key={`${refreshKey}-${r.id}`}
                className={`dt-row${selected.has(r.id) ? " selected" : ""}`}
                style={{ "--i": Math.min(i, 14) }}
              >
                <td className="dt-check">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} aria-label="Select row" />
                </td>
                {columns.map((c) => (
                  <td key={c.key} data-col={c.key} className={c.align === "right" ? "right" : ""}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {pageRows.length === 0 && (
          <div className="dt-empty">
            <i className="fa-regular fa-folder-open" aria-hidden="true" />
            <p>No {entity} found</p>
          </div>
        )}
      </div>

      <div className="dt-foot">
        <span className="muted">Total Count: <b>{sorted.length}</b></span>
        <div className="dt-pager">
          <label className="dt-perpage">
            <i className="fa-solid fa-gear" aria-hidden="true" />
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </label>
          <div className="dt-pages">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
              <i className="fa-solid fa-chevron-left" />
            </button>
            <span>{sorted.length ? startIdx + 1 : 0} - {Math.min(startIdx + perPage, sorted.length)}</span>
            <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}