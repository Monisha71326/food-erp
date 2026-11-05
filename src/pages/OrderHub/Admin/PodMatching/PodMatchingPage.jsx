import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { HubCard, HubButton, HubModal, HubNotice } from "@/components/HubUI/HubUI.jsx";
import LineItemsTable from "@/components/LineItemsTable/LineItemsTable.jsx";
import { useHub, client, matchPOD } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./PodMatchingPage.css";

export default function PodMatchingPage() {
  const s = useHub();
  const pending = s.orders.filter((o) => o.status === "With Delivery Partner");
  const [open, setOpen] = useState(null);       // order being matched
  const [delivered, setDelivered] = useState([]);
  const [sig, setSig] = useState(true);
  const [msg, setMsg] = useState(null);

  const start = (o) => { setOpen(o); setDelivered(o.lines.map((l) => l.qty)); setSig(true); };
  const run = async () => {
    const r = await matchPOD(open.id, delivered, sig);
    setMsg({ ok: r.ok, text: r.msg });
    setOpen(null);
  };

  return (
    <div className="page-anim pod-matching-page">
      <PageHeader eyebrow="FULFILMENT & LOGISTICS" title="POD Matching (Manual)" subtitle="Simulates the POD inbox: match signed delivery notes against the original order lines." icon="fa-clipboard-check" />
      <div className="pod-noprint">
        <HubNotice tone={msg?.ok ? "green" : "red"}>{msg?.text}</HubNotice>
      </div>
      {pending.length ? pending.map((o) => (
        <HubCard
          key={o.id}
          title={`${o.id} - ${client(o.clientId).name}`}
          actions={
            <>
              <span className="muted hub-small">{fmtDate(o.date)}</span>
              <span className="pod-noprint">
                <HubButton size="sm" icon="fa-file-signature" onClick={() => start(o)}>Simulate POD received</HubButton>
              </span>
            </>
          }
        >
          <LineItemsTable lines={o.lines} />
        </HubCard>
      )) : <HubCard><p className="muted pod-empty">No orders currently awaiting a proof of delivery.</p></HubCard>}

      <div className="pod-noprint">
        <HubModal open={!!open} title={open ? `POD for ${open.id}` : ""} onClose={() => setOpen(null)}>
          {open && (
            <>
              <p className="muted hub-small">Enter what the delivery partner's delivery note actually shows. A short quantity creates a backorder line instead of blocking the whole invoice.</p>
              <table className="pod-tbl">
                <thead><tr><th>Item</th><th>Ordered</th><th>Delivered</th></tr></thead>
                <tbody>
                  {open.lines.map((l, i) => (
                    <tr key={l.code}>
                      <td className="hub-mono">{l.code}</td><td>{l.qty}</td>
                      <td><input type="number" min="0" className="hub-input qty" value={delivered[i]} onChange={(e) => setDelivered((d) => d.map((x, j) => (j === i ? Math.max(0, parseInt(e.target.value || "0", 10)) : x)))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="hub-check"><input type="checkbox" checked={sig} onChange={(e) => setSig(e.target.checked)} /> Delivery note carries a valid signature</label>
              <div className="hub-row end pod-actions">
                <HubButton size="sm" variant="ghost" onClick={() => setOpen(null)}>Cancel</HubButton>
                <HubButton size="sm" onClick={run}>Run match</HubButton>
              </div>
            </>
          )}
        </HubModal>
      </div>
    </div>
  );
}