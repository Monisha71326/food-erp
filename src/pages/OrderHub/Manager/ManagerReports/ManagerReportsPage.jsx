import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { useHub, client, clientManager, gbp, invoicePayments, setSession, managerTargets, saveManagerTargets } from "@/data/orderHubStore.js";
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
const pctOf = (a, t) => (t > 0 ? Math.round((a / t) * 100) : null);
const pctText = (a, t) => (pctOf(a, t) === null ? "-" : pctOf(a, t) + "%");

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

/* one target card. onSet is only passed for the administrator */
function TargetCard({ title, icon, tone, target, achieved, onSet }) {
  if (!(target > 0)) {
    return (
      <div className="mt-card mt-empty">
        <span className="mt-empty-ico" style={{ color: tone }}><i className={`fa-solid ${icon}`} /></span>
        <b>{title}</b>
        <small>{onSet ? "No target set" : "No target set by the administrator yet"}</small>
        {onSet && (
          <button type="button" className="mt-btn ghost" onClick={onSet}>
            <i className="fa-solid fa-plus" /> Set target
          </button>
        )}
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

/* Administrator (session not locked) -> can set targets. Area manager (locked) -> view only. */
export default function ManagerReportsPage({ canSetTargets: canSetProp }) {
  const s = useHub();
  const canSetTargets = canSetProp ?? !s.session?.locked;
  const managerId = s.session?.managerId;
  const managerName = (s.areaManagers || []).find((m) => m.id === managerId)?.name;

  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayStr());

  /* targets */
  const targets = managerTargets(managerId);
  const [salesInput, setSalesInput] = useState(String(targets.sales || ""));
  const [collInput, setCollInput] = useState(String(targets.collection || ""));
  const [editing, setEditing] = useState(false);
  const [showColl, setShowColl] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const closeEdit = () => { setEditing(false); setErr(""); };
  const openEdit = () => {
    if (!canSetTargets) return;
    setSalesInput(String(targets.sales || ""));
    setCollInput(String(targets.collection || ""));
    setErr("");
    setEditing(true);
  };

  /* refill form values when manager / saved targets change (never auto-open the popup) */
  useEffect(() => {
    setSalesInput(String(targets.sales || ""));
    setCollInput(String(targets.collection || ""));
    setErr("");
    setEditing(false);
  }, [managerId, canSetTargets, targets.sales, targets.collection]);

  /* Esc to close + background scroll lock (for both popups) */
  useEffect(() => {
    if (!editing && !showColl) return;
    const onKey = (e) => {
      if (e.key === "Escape") { closeEdit(); setShowColl(false); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editing, showColl]);

  const submitTargets = async (e) => {
    e.preventDefault();
    if (!canSetTargets) return;
    const r = await saveManagerTargets(managerId, {
      sales: Math.max(0, Number(salesInput) || 0),
      collection: Math.max(0, Number(collInput) || 0),
    });
    if (r && r.ok === false) { setErr(r.msg || "Could not save the targets."); return; }
    setErr("");
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const pickPreset = (p) => {
    setPreset(p.id);
    setFrom(p.days === null ? "" : isoDaysAgo(p.days));
    setTo(p.days === null ? "" : todayStr());
  };

  const data = useMemo(() => {
    const mine = (s.invoices || []).filter((inv) => !managerId || clientManager(inv.clientId)?.id === managerId);
    const invoices = mine.filter((inv) => inRange(inv.date, from, to));

    const payments = mine
      .flatMap((inv) => invoicePayments(inv.id).map((p) => ({ ...p, clientId: inv.clientId, invoiceId: inv.id })))
      .filter((p) => inRange(p.date, from, to))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const invoiced = round2(invoices.reduce((t, i) => t + Number(i.amount || 0), 0));
    const outstanding = round2(invoices.reduce((t, i) => t + Math.max(0, Number(i.amount || 0) - paidOf(i)), 0));
    const collected = round2(payments.reduce((t, p) => t + Number(p.amount || 0), 0));
    const settled = round2(invoiced - outstanding);
    const rate = invoiced ? Math.round((settled / invoiced) * 100) : 0;

    const cashPays = payments.filter((p) => p.method === "Cash");
    const chequePays = payments.filter((p) => p.method === "Cheque");
    const cash = round2(cashPays.reduce((t, p) => t + Number(p.amount || 0), 0));
    const cheque = round2(chequePays.reduce((t, p) => t + Number(p.amount || 0), 0));

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

    const byMethod = {};
    payments.forEach((p) => { byMethod[p.method] = round2((byMethod[p.method] || 0) + Number(p.amount || 0)); });
    const methods = Object.entries(byMethod).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);

    return {
      invoices, payments, invoiced, outstanding, collected, rate, clients, methods,
      cash, cashCount: cashPays.length, cheque, chequeCount: chequePays.length,
    };
  }, [s, managerId, from, to]);

  /* total of the targets that are set */
  const totalTarget = round2((targets.sales || 0) + (targets.collection || 0));
  const totalAchieved = round2(
    (targets.sales > 0 ? data.invoiced : 0) +
    (targets.collection > 0 ? data.collected : 0)
  );

  /* every area manager's targets vs achieved (administrator view) */
  const teamRows = useMemo(() => {
    if (!canSetTargets) return [];
    return (s.areaManagers || []).map((m) => {
      const t = managerTargets(m.id);
      const mine = (s.invoices || []).filter((inv) => clientManager(inv.clientId)?.id === m.id);
      const invoiced = round2(
        mine.filter((inv) => inRange(inv.date, from, to)).reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
      );
      const collected = round2(
        mine
          .flatMap((inv) => invoicePayments(inv.id))
          .filter((p) => inRange(p.date, from, to))
          .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      );
      return {
        id: m.id, name: m.name,
        salesTarget: Number(t.sales || 0), invoiced,
        collTarget: Number(t.collection || 0), collected,
      };
    });
  }, [s, canSetTargets, from, to]);

  const teamTotals = useMemo(() => ({
    salesTarget: round2(teamRows.reduce((t, r) => t + r.salesTarget, 0)),
    invoiced: round2(teamRows.reduce((t, r) => t + r.invoiced, 0)),
    collTarget: round2(teamRows.reduce((t, r) => t + r.collTarget, 0)),
    collected: round2(teamRows.reduce((t, r) => t + r.collected, 0)),
  }), [teamRows]);

  const maxMethod = Math.max(1, ...data.methods.map((m) => m.amount));
  const maxDue = Math.max(1, ...data.clients.map((c) => c.due));
  const periodLabel = preset === "custom"
    ? `${from ? fmtDate(from) : "Start"} - ${to ? fmtDate(to) : "Today"}`
    : (PRESETS.find((p) => p.id === preset)?.label || "");

  const exportCsv = () => {
    const rows = [
      ["Target", "Target amount", "Achieved", "Achieved %"],
      ["Sales (Invoiced)", targets.sales, data.invoiced, pctText(data.invoiced, targets.sales)],
      ["Collection (Collected)", targets.collection, data.collected, pctText(data.collected, targets.collection)],
      ["Total", totalTarget, totalAchieved, pctText(totalAchieved, totalTarget)],
      [],
      ...(canSetTargets ? [
        ["Area manager", "Sales target", "Sales achieved", "Collection target", "Collected"],
        ...teamRows.map((r) => [r.name, r.salesTarget, r.invoiced, r.collTarget, r.collected]),
        [],
      ] : []),
      ["Cash", data.cash, data.cashCount + " payment(s)"],
      ["Cheque", data.cheque, data.chequeCount + " payment(s)"],
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

  /* ---------- Set target popup (rendered into document.body) ---------- */
  const modal = canSetTargets && editing ? createPortal(
    <div className="mtm-backdrop" onMouseDown={closeEdit}>
      <form
        className="mtm-modal"
        onSubmit={submitTargets}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtm-title"
      >
        <div className="mtm-head">
          <h4 id="mtm-title"><i className="fa-solid fa-bullseye" /> Set targets</h4>
          <button type="button" className="mtm-x" onClick={closeEdit} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {managerName && <p className="mtm-sub">For <b>{managerName}</b></p>}

        <label>
          <span>Sales target</span>
          <div className="mtm-input">
            <em>£</em>
            <input type="number" min="0" step="0.01" value={salesInput} placeholder="10000" autoFocus
              onChange={(e) => setSalesInput(e.target.value)} />
          </div>
        </label>

        <label>
          <span>Collection target</span>
          <div className="mtm-input">
            <em>£</em>
            <input type="number" min="0" step="0.01" value={collInput} placeholder="8000"
              onChange={(e) => setCollInput(e.target.value)} />
          </div>
        </label>

        {err && <small className="mtm-err">{err}</small>}

        <div className="mtm-act">
          <button type="button" className="mt-btn ghost" onClick={closeEdit}>Cancel</button>
          <button type="submit" className="mt-btn primary">
            <i className="fa-solid fa-floppy-disk" /> Save targets
          </button>
        </div>
      </form>
    </div>,
    document.body
  ) : null;

  /* ---------- Collection targets popup (all area managers) ---------- */
  const collModal = canSetTargets && showColl ? createPortal(
    <div className="mtm-backdrop" onMouseDown={() => setShowColl(false)}>
      <div
        className="mtm-modal wide"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtc-title"
      >
        <div className="mtm-head">
          <h4 id="mtc-title"><i className="fa-solid fa-sack-dollar" /> Collection targets by area manager</h4>
          <button type="button" className="mtm-x" onClick={() => setShowColl(false)} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p className="mtm-sub"><i className="fa-regular fa-calendar" /> {periodLabel}</p>

        <div className="mtm-table-wrap">
          <table className="mtm-table">
            <thead>
              <tr>
                <th>Area manager</th>
                <th className="r">Target</th>
                <th className="r">Collected</th>
                <th className="r">Remaining</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((r) => {
                const cp = pctOf(r.collected, r.collTarget);
                const remaining = Math.max(0, round2(r.collTarget - r.collected));
                return (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td className="r">{r.collTarget > 0 ? gbp(r.collTarget) : "-"}</td>
                    <td className="r">{gbp(r.collected)}</td>
                    <td className="r">{r.collTarget > 0 ? gbp(remaining) : "-"}</td>
                    <td>
                      {cp === null ? <span className="mtm-muted">No target</span> : (
                        <div className="mtm-mini">
                          <div className="mtm-bar">
                            <i style={{ width: `${Math.min(100, cp)}%`, background: cp >= 100 ? "#16a34a" : "#d97706" }} />
                          </div>
                          <b>{cp}%</b>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td><b>Total</b></td>
                <td className="r"><b>{gbp(teamTotals.collTarget)}</b></td>
                <td className="r"><b>{gbp(teamTotals.collected)}</b></td>
                <td className="r"><b>{gbp(Math.max(0, round2(teamTotals.collTarget - teamTotals.collected)))}</b></td>
                <td><b>{pctText(teamTotals.collected, teamTotals.collTarget)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mtm-act">
          <button type="button" className="mt-btn ghost" onClick={() => setShowColl(false)}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

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

      {/* Cash and Cheque cards */}
      <section className="mrep-kpis" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="mrep-kpi k-green">
          <i className="fa-solid fa-money-bill-wave" />
          <small>Cash</small><b>{gbp(data.cash)}</b>
          <span>{data.cashCount} payment{data.cashCount === 1 ? "" : "s"}</span>
        </div>
        <div className="mrep-kpi k-gold">
          <i className="fa-solid fa-money-check" />
          <small>Cheque</small><b>{gbp(data.cheque)}</b>
          <span>{data.chequeCount} payment{data.chequeCount === 1 ? "" : "s"}</span>
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
            {canSetTargets && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                Area manager
                <select
                  value={managerId || ""}
                  onChange={(e) => setSession({ managerId: e.target.value })}
                  style={{ height: 36, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border, #e2e8f0)", background: "transparent", color: "inherit", font: "inherit", fontSize: 13 }}
                >
                  {(s.areaManagers || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            )}
            {saved && <span className="mt-saved"><i className="fa-solid fa-circle-check" /> Saved</span>}
            {canSetTargets && (
              <button type="button" className="mt-btn ghost" onClick={() => setShowColl(true)}>
                <i className="fa-solid fa-sack-dollar" /> Collection targets
              </button>
            )}
            {canSetTargets && (
              <button type="button" className="mt-btn primary" onClick={openEdit}>
                <i className="fa-solid fa-bullseye" />
                {targets.sales > 0 || targets.collection > 0 ? "Edit target" : "Set target"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-grid">
          <TargetCard
            title="Sales target" icon="fa-file-invoice-dollar" tone="#2563eb"
            target={targets.sales} achieved={data.invoiced} onSet={canSetTargets ? openEdit : null}
          />
          <TargetCard
            title="Collection target" icon="fa-sack-dollar" tone="#d97706"
            target={targets.collection} achieved={data.collected} onSet={canSetTargets ? openEdit : null}
          />
          <TargetCard
            title="Total target" icon="fa-layer-group" tone="#a1122f"
            target={totalTarget} achieved={totalAchieved} onSet={canSetTargets ? openEdit : null}
          />
        </div>

        {/* Targets by area manager (administrator only) */}
        {canSetTargets && (
          <div className="mt-team">
            <h5 className="mt-team-title"><i className="fa-solid fa-users-gear" /> Targets by area manager</h5>
            <div className="mrep-table-wrap">
              <table className="mrep-table">
                <thead>
                  <tr>
                    <th>Area manager</th>
                    <th className="r">Sales target</th>
                    <th className="r">Sales achieved</th>
                    <th>Sales %</th>
                    <th className="r">Collection target</th>
                    <th className="r">Collected</th>
                    <th>Collection %</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((r) => {
                    const sp = pctOf(r.invoiced, r.salesTarget);
                    const cp = pctOf(r.collected, r.collTarget);
                    return (
                      <tr key={r.id} className={r.id === managerId ? "mt-row-on" : ""}>
                        <td>
                          <button type="button" className="mt-link" onClick={() => setSession({ managerId: r.id })}>
                            {r.name}
                          </button>
                        </td>
                        <td className="r">{r.salesTarget > 0 ? gbp(r.salesTarget) : "-"}</td>
                        <td className="r">{gbp(r.invoiced)}</td>
                        <td>
                          {sp === null ? "-" : (
                            <div className="mt-mini">
                              <div className="mt-bar"><i style={{ width: `${Math.min(100, sp)}%`, background: sp >= 100 ? "#16a34a" : "#2563eb" }} /></div>
                              <b>{sp}%</b>
                            </div>
                          )}
                        </td>
                        <td className="r">{r.collTarget > 0 ? gbp(r.collTarget) : "-"}</td>
                        <td className="r">{gbp(r.collected)}</td>
                        <td>
                          {cp === null ? "-" : (
                            <div className="mt-mini">
                              <div className="mt-bar"><i style={{ width: `${Math.min(100, cp)}%`, background: cp >= 100 ? "#16a34a" : "#d97706" }} /></div>
                              <b>{cp}%</b>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>Total</b></td>
                    <td className="r"><b>{gbp(teamTotals.salesTarget)}</b></td>
                    <td className="r"><b>{gbp(teamTotals.invoiced)}</b></td>
                    <td><b>{pctText(teamTotals.invoiced, teamTotals.salesTarget)}</b></td>
                    <td className="r"><b>{gbp(teamTotals.collTarget)}</b></td>
                    <td className="r"><b>{gbp(teamTotals.collected)}</b></td>
                    <td><b>{pctText(teamTotals.collected, teamTotals.collTarget)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <p className="mt-note">
          Sales is measured by invoiced amount and collection by payments received in the selected period.
          {!canSetTargets && " Targets are set by the administrator."}
        </p>
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

      {modal}
      {collModal}
    </div>
  );
}