import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { useHub, client, clientManager, gbp, invoicePayments } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./ManagerReportsPage.css";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const METHOD_ICON = { Online: "fa-globe", Cheque: "fa-money-check", Cash: "fa-money-bill-wave" };
const METHOD_CLASS = { Online: "online", Cheque: "cheque", Cash: "cash" };
const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

const PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

const paidOf = (inv) => (String(inv.status).toLowerCase() === "paid" ? Number(inv.amount) : Number(inv.paid || 0));
const inRange = (d, from, to) => {
  if (!d) return !from && !to;
  const day = String(d).slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
};

function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- targets (saved in this browser, one set per area manager) ---------- */
const targetKey = (managerId) => `mgr-targets-${managerId || "all"}`;
const loadTargets = (managerId) => {
  try {
    const t = JSON.parse(localStorage.getItem(targetKey(managerId)) || "{}");
    return { sales: Number(t.sales) || 0, collection: Number(t.collection) || 0 };
  } catch {
    return { sales: 0, collection: 0 };
  }
};
const saveTargets = (managerId, t) => {
  try { localStorage.setItem(targetKey(managerId), JSON.stringify(t)); } catch { /* ignore */ }
};

/* circular progress ring */
const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;
function Ring({ pct, color }) {
  return (
    <div className="mt-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="mt-ring-bg" cx="50" cy="50" r={RING_R} />
        <circle
          className="mt-ring-fg" cx="50" cy="50" r={RING_R}
          style={{ stroke: color, strokeDasharray: `${(pct / 100) * RING_C} ${RING_C}` }}
        />
      </svg>
      <span className="mt-ring-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

/* one target card: ring, achieved, target, status, remaining */
function TargetCard({ title, icon, tone, target, achieved, onSet }) {
  if (!(target > 0)) {
    return (
      <div className="mt-card mt-empty">
        <span className="mt-empty-ico" style={{ color: tone }}><i className={`fa-solid ${icon}`} /></span>
        <b>{title}</b>
        <small>No target set</small>
        <button type="button" className="mt-btn ghost" onClick={onSet}>
          <i className="fa-solid fa-plus" /> Set target
        </button>
      </div>
    );
  }
  const rawPct = (achieved / target) * 100;
  const pct = Math.min(100, Math.round(rawPct));
  const done = achieved >= target;
  const color = done ? "#16a34a" : tone;
  const remaining = Math.max(0, round2(target - achieved));
  return (
    <div className={`mt-card${done ? " done" : ""}`} style={{ "--mt-tone": color }}>
      <div className="mt-card-head">
        <span className="mt-ico" style={{ background: `${color}1f`, color }}><i className={`fa-solid ${icon}`} /></span>
        <b>{title}</b>
        <span className={`mt-badge ${done ? "ok" : "go"}`}>
          <i className={`fa-solid ${done ? "fa-circle-check" : "fa-bolt"}`} /> {done ? "Target achieved" : "In progress"}
        </span>
      </div>
      <div className="mt-card-body">
        <Ring pct={pct} color={color} />
        <div className="mt-nums">
          <small>Achieved</small>
          <b className="mt-big" style={{ color }}>{gbp(achieved)}</b>
          <span className="mt-of">of {gbp(target)}</span>
        </div>
      </div>
      <div className="mt-bar"><i style={{ width: `${pct}%`, background: color }} /></div>
      <div className="mt-card-foot">
        {done
          ? <span>Exceeded by <b>{gbp(round2(achieved - target))}</b></span>
          : <span>Remaining <b>{gbp(remaining)}</b></span>}
        <span>{Math.round(rawPct)}% of target</span>
      </div>
    </div>
  );
}

export default function ManagerReportsPage() {
  const s = useHub();
  const managerId = s.session?.managerId;
  const managerName = (s.areaManagers || []).find((m) => m.id === managerId)?.name;

  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayStr());

  /* targets */
  const [targets, setTargets] = useState(() => loadTargets(managerId));
  const [salesInput, setSalesInput] = useState(() => String(loadTargets(managerId).sales || ""));
  const [collInput, setCollInput] = useState(() => String(loadTargets(managerId).collection || ""));
  const [editing, setEditing] = useState(() => {
    const t = loadTargets(managerId);
    return !(t.sales > 0 || t.collection > 0);
  });
  const [saved, setSaved] = useState(false);
  const submitTargets = (e) => {
    e.preventDefault();
    const t = { sales: Math.max(0, Number(salesInput) || 0), collection: Math.max(0, Number(collInput) || 0) };
    saveTargets(managerId, t);
    setTargets(t);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const openEdit = () => {
    setSalesInput(String(targets.sales || ""));
    setCollInput(String(targets.collection || ""));
    setEditing(true);
  };

  const pickPreset = (p) => {
    setPreset(p.id);
    setFrom(p.days === null ? "" : isoDaysAgo(p.days));
    setTo(p.days === null ? "" : todayStr());
  };

  const data = useMemo(() => {
    // invoices of clients handled by this area manager
    const mine = (s.invoices || []).filter((inv) => !managerId || clientManager(inv.clientId)?.id === managerId);
    const invoices = mine.filter((inv) => inRange(inv.date, from, to));

    // every payment against those invoices that falls inside the date range
    const payments = mine
      .flatMap((inv) => invoicePayments(inv.id).map((p) => ({ ...p, clientId: inv.clientId, invoiceId: inv.id })))
      .filter((p) => inRange(p.date, from, to))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const invoiced = round2(invoices.reduce((t, i) => t + Number(i.amount || 0), 0));
    const outstanding = round2(invoices.reduce((t, i) => t + Math.max(0, Number(i.amount || 0) - paidOf(i)), 0));
    const collected = round2(payments.reduce((t, p) => t + Number(p.amount || 0), 0));
    const settled = round2(invoiced - outstanding);
    const rate = invoiced ? Math.round((settled / invoiced) * 100) : 0;

    // per client
    const byClient = {};
    invoices.forEach((inv) => {
      const row = (byClient[inv.clientId] ||= { id: inv.clientId, count: 0, invoiced: 0, paid: 0, due: 0 });
      row.count += 1;
      row.invoiced += Number(inv.amount || 0);
      row.paid += paidOf(inv);
      row.due += Math.max(0, Number(inv.amount || 0) - paidOf(inv));
    });
    const clients = Object.values(byClient)
      .map((r) => ({ ...r, name: client(r.id)?.name || r.id, invoiced: round2(r.invoiced), paid: round2(r.paid), due: round2(r.due) }))
      .sort((a, b) => b.due - a.due);

    // per method
    const byMethod = {};
    payments.forEach((p) => { byMethod[p.method] = round2((byMethod[p.method] || 0) + Number(p.amount || 0)); });
    const methods = Object.entries(byMethod).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);

    return { invoices, payments, invoiced, outstanding, collected, rate, clients, methods };
  }, [s, managerId, from, to]);

  const maxMethod = Math.max(1, ...data.methods.map((m) => m.amount));
  const maxDue = Math.max(1, ...data.clients.map((c) => c.due));
  const periodLabel = preset === "custom"
    ? `${from ? fmtDate(from) : "Start"} - ${to ? fmtDate(to) : "Today"}`
    : (PRESETS.find((p) => p.id === preset)?.label || "");

  const exportCsv = () => {
    const rows = [
      ["Target", "Target amount", "Achieved", "Achieved %"],
      ["Sales (Invoiced)", targets.sales, data.invoiced, targets.sales ? Math.round((data.invoiced / targets.sales) * 100) + "%" : "-"],
      ["Collection (Collected)", targets.collection, data.collected, targets.collection ? Math.round((data.collected / targets.collection) * 100) + "%" : "-"],
      [],
      ["Client", "Invoices", "Invoiced", "Paid", "Outstanding"],
      ...data.clients.map((c) => [c.name, c.count, c.invoiced, c.paid, c.due]),
      [],
      ["Date", "Client", "Invoice", "Method", "Amount", "Received by"],
      ...data.payments.map((p) => [p.date, client(p.clientId)?.name || "", p.invoiceId, p.method, p.amount, p.receivedBy || ""]),
    ];
    downloadCsv(`area-manager-report-${todayStr()}.csv`, rows);
  };

  const exportBtn = (
    <button type="button" className="mrep-export" onClick={exportCsv}>
      <i className="fa-solid fa-file-csv" /> Export CSV
    </button>
  );

  return (
    <div className="mgr-report">
      <PageHeader
        eyebrow="AREA MANAGER"
        title="Reports"
        subtitle={`${managerName ? managerName + " - " : ""}Invoices, collections and outstanding balances of your clients`}
        icon="fa-chart-column"
        actions={exportBtn}
        showPrint={false}
      />

      {/* Filters */}
      <section className="mrep-filters">
        <div className="mrep-presets" role="group" aria-label="Period">
          {PRESETS.map((p) => (
            <button
              key={p.id} type="button"
              className={`mrep-preset${preset === p.id ? " on" : ""}`}
              aria-pressed={preset === p.id}
              onClick={() => pickPreset(p)}
            >{p.label}</button>
          ))}
        </div>
        <div className="mrep-dates">
          <label>From <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} /></label>
          <label>To <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} /></label>
        </div>
      </section>

      {/* KPI cards */}
      <section className="mrep-kpis">
        <div className="mrep-kpi k-blue">
          <i className="fa-solid fa-file-invoice-dollar" />
          <small>Invoiced</small><b>{gbp(data.invoiced)}</b>
          <span>{data.invoices.length} invoice{data.invoices.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mrep-kpi k-green">
          <i className="fa-solid fa-sack-dollar" />
          <small>Collected</small><b>{gbp(data.collected)}</b>
          <span>{data.payments.length} payment{data.payments.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mrep-kpi k-red">
          <i className="fa-solid fa-hourglass-half" />
          <small>Outstanding</small><b>{gbp(data.outstanding)}</b>
          <span>{data.clients.filter((c) => c.due > 0).length} client(s) owe</span>
        </div>
        <div className="mrep-kpi k-gold">
          <i className="fa-solid fa-percent" />
          <small>Collection rate</small><b>{data.rate}%</b>
          <div className="mrep-meter"><i style={{ width: `${data.rate}%` }} /></div>
        </div>
      </section>

      {/* Targets */}
      <section className="mrep-card mt-section">
        <div className="mt-head">
          <div>
            <h4><i className="fa-solid fa-bullseye" /> Targets</h4>
            <small className="mt-period"><i className="fa-regular fa-calendar" /> {periodLabel}</small>
          </div>
          <div className="mt-head-act">
            {saved && <span className="mt-saved"><i className="fa-solid fa-circle-check" /> Saved</span>}
            {!editing && (
              <button type="button" className="mt-btn ghost" onClick={openEdit}>
                <i className="fa-solid fa-pen" /> Edit targets
              </button>
            )}
          </div>
        </div>

        {editing && (
          <form className="mt-form" onSubmit={submitTargets}>
            <label>
              <span>Sales target</span>
              <div className="mt-input">
                <em>£</em>
                <input type="number" min="0" step="0.01" value={salesInput} placeholder="10000"
                  onChange={(e) => setSalesInput(e.target.value)} />
              </div>
            </label>
            <label>
              <span>Collection target</span>
              <div className="mt-input">
                <em>£</em>
                <input type="number" min="0" step="0.01" value={collInput} placeholder="8000"
                  onChange={(e) => setCollInput(e.target.value)} />
              </div>
            </label>
            <div className="mt-form-act">
              <button type="submit" className="mt-btn primary">
                <i className="fa-solid fa-floppy-disk" /> Save targets
              </button>
              {(targets.sales > 0 || targets.collection > 0) && (
                <button type="button" className="mt-btn ghost" onClick={() => setEditing(false)}>Cancel</button>
              )}
            </div>
          </form>
        )}

        <div className="mt-grid">
          <TargetCard
            title="Sales target" icon="fa-file-invoice-dollar" tone="#2563eb"
            target={targets.sales} achieved={data.invoiced} onSet={openEdit}
          />
          <TargetCard
            title="Collection target" icon="fa-sack-dollar" tone="#d97706"
            target={targets.collection} achieved={data.collected} onSet={openEdit}
          />
        </div>
        <p className="mt-note">Sales is measured by invoiced amount and collection by payments received in the selected period.</p>
      </section>

      <div className="mrep-grid">
        {/* Per client */}
        <section className="mrep-card">
          <h4><i className="fa-solid fa-users" /> Outstanding by client</h4>
          {data.clients.length === 0 ? (
            <p className="mrep-empty">No invoices in this period.</p>
          ) : (
            <ul className="mrep-clients">
              {data.clients.map((c) => (
                <li key={c.id}>
                  <div className="mrep-client-top">
                    <b>{c.name}</b>
                    <span className={c.due > 0 ? "due" : "ok"}>{c.due > 0 ? gbp(c.due) + " due" : "Settled"}</span>
                  </div>
                  <div className="mrep-bar"><i style={{ width: `${(c.due / maxDue) * 100}%` }} /></div>
                  <small>{c.count} invoice{c.count === 1 ? "" : "s"} - Invoiced {gbp(c.invoiced)} - Paid {gbp(c.paid)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Methods */}
        <section className="mrep-card">
          <h4><i className="fa-solid fa-wallet" /> Collections by method</h4>
          {data.methods.length === 0 ? (
            <p className="mrep-empty">No payments in this period.</p>
          ) : (
            <ul className="mrep-methods">
              {data.methods.map((m) => (
                <li key={m.method}>
                  <span className={`mrep-mico ${METHOD_CLASS[m.method] || ""}`}>
                    <i className={`fa-solid ${METHOD_ICON[m.method] || "fa-coins"}`} />
                  </span>
                  <div>
                    <div className="mrep-client-top"><b>{m.method}</b><span>{gbp(m.amount)}</span></div>
                    <div className="mrep-bar green"><i style={{ width: `${(m.amount / maxMethod) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Payments table */}
      <section className="mrep-card">
        <h4><i className="fa-solid fa-clock-rotate-left" /> Payments received ({data.payments.length})</h4>
        {data.payments.length === 0 ? (
          <p className="mrep-empty">No payments in this period.</p>
        ) : (
          <div className="mrep-table-wrap">
            <table className="mrep-table">
              <thead>
                <tr><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th>Received by</th><th className="r">Amount</th></tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{client(p.clientId)?.name || "-"}</td>
                    <td className="mono">{p.invoiceId}</td>
                    <td><span className={`mrep-tag ${METHOD_CLASS[p.method] || ""}`}>{p.method}</span></td>
                    <td>{p.receivedBy || "-"}</td>
                    <td className="r"><b>{gbp(p.amount)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}