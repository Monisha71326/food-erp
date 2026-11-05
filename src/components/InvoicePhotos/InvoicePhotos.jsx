import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addInvoicePhotos, deleteInvoicePhoto, invoicePhotos } from "@/data/orderHubStore.js";
import { fmtDate } from "@/utils/format.js";
import "./InvoicePhotos.css";

/*
 * "Upload Photo" tab of an invoice - used by the CLIENT portal and the AREA MANAGER portal.
 *   invoice   : the invoice object
 *   role      : "client" | "manager"
 *   managerId : required when role === "manager"
 * Photos are compressed in the browser (max ~1280px JPEG) so browser storage never fills up.
 */

const KINDS = [
  { id: "Delivery proof", icon: "fa-truck-ramp-box" },
  { id: "Damaged goods", icon: "fa-heart-crack" },
  { id: "Wrong item", icon: "fa-shuffle" },
  { id: "Missing items", icon: "fa-box-open" },
  { id: "Payment proof", icon: "fa-receipt" },
  { id: "Other", icon: "fa-image" },
];
const MAX_PHOTOS = 8;
const MAX_CHARS = 600000; // target size of one compressed photo (data URL length)
const MAX_FILE_MB = 25;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
  img.src = url;
});

/* shrink + re-encode as JPEG, trying smaller sizes until it is small enough */
async function compress(file) {
  const img = await loadImage(file);
  const steps = [[1280, 0.78], [1024, 0.66], [800, 0.55], [640, 0.5]];
  let out = "";
  for (const [side, quality] of steps) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cnv = document.createElement("canvas");
    cnv.width = w; cnv.height = h;
    const ctx = cnv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // white behind transparent PNGs
    ctx.drawImage(img, 0, 0, w, h);
    out = cnv.toDataURL("image/jpeg", quality);
    if (out.length <= MAX_CHARS) return out;
  }
  throw new Error("toolarge");
}
const kb = (dataUrl) => Math.round((dataUrl.length * 0.75) / 1024);

/* ---------- full-screen viewer ---------- */
function Lightbox({ list, index, onIndex, canDelete, onDelete, onClose }) {
  const ph = list[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < list.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, list.length, onClose, onIndex]);
  if (!ph) return null;
  return createPortal(
    <div className="ivp-lb" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <div className="ivp-lb-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ivp-lb-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        <div className="ivp-lb-stage">
          <button type="button" className="ivp-lb-nav" disabled={index <= 0} onClick={() => onIndex(index - 1)} aria-label="Previous photo"><i className="fa-solid fa-chevron-left" /></button>
          <img src={ph.dataUrl} alt={`${ph.kind} uploaded by ${ph.by}`} />
          <button type="button" className="ivp-lb-nav" disabled={index >= list.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next photo"><i className="fa-solid fa-chevron-right" /></button>
        </div>
        <div className="ivp-lb-info">
          <div>
            <span className={`ivp-role ${ph.role === "Client" ? "client" : "mgr"}`}>{ph.role}</span>
            <b>{ph.kind}</b>
            <small>{ph.by} · {fmtDate(ph.date)} {ph.time}</small>
            {ph.note && <p>{ph.note}</p>}
          </div>
          <div className="ivp-lb-actions">
            <a className="ivp-btn ghost" href={ph.dataUrl} download={`${ph.id}-${ph.kind.replace(/\s+/g, "-").toLowerCase()}.jpg`}><i className="fa-solid fa-download" /> Download</a>
            {canDelete(ph) && <button type="button" className="ivp-btn danger" onClick={() => onDelete(ph)}><i className="fa-regular fa-trash-can" /> Delete</button>}
          </div>
        </div>
        <p className="ivp-lb-count">{index + 1} / {list.length}</p>
      </div>
    </div>,
    document.body
  );
}

export default function InvoicePhotos({ invoice, role = "client", managerId }) {
  const photos = invoicePhotos(invoice.id);
  const mine = role === "manager" ? "Area manager" : "Client";
  const [staged, setStaged] = useState([]); // [{ key, name, dataUrl }]
  const [kind, setKind] = useState(KINDS[0].id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState(null); // index in `list`
  const camRef = useRef(null);
  const pickRef = useRef(null);

  const list = [...photos].reverse(); // newest first
  const slots = MAX_PHOTOS - photos.length - staged.length;

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setMsg(null);
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) { setMsg({ ok: false, text: "Please choose image files (JPG, PNG or WEBP)." }); return; }
    if (slots <= 0) { setMsg({ ok: false, text: `This invoice already has the maximum of ${MAX_PHOTOS} photos.` }); return; }
    const take = images.slice(0, slots);
    const notes = [];
    if (images.length > take.length) notes.push(`Only ${take.length} more photo(s) fit on this invoice.`);
    if (images.length < files.length) notes.push("Some files were skipped because they are not images.");
    setWorking(true);
    const added = [];
    for (const f of take) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) { notes.push(`${f.name} is over ${MAX_FILE_MB} MB.`); continue; }
      try {
        added.push({ key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, name: f.name, dataUrl: await compress(f) });
      } catch {
        notes.push(`${f.name} could not be read. Try a JPG or PNG.`);
      }
    }
    setStaged((cur) => [...cur, ...added]);
    setWorking(false);
    if (notes.length) setMsg({ ok: false, text: notes.join(" ") });
  };
  const pick = (e) => { addFiles(e.target.files); e.target.value = ""; }; // reset so the same file can be picked again
  const onDrop = (e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer?.files); };

  const upload = async () => {
    if (!staged.length) return;
    setBusy(true); setMsg(null);
    const r = await addInvoicePhotos(invoice.id, {
      photos: staged.map(({ name, dataUrl }) => ({ name, dataUrl })), kind, note, role, managerId,
    });
    setBusy(false);
    if (r.ok) { setStaged([]); setNote(""); }
    setMsg({ ok: r.ok, text: r.msg });
  };

  const canDelete = (ph) => ph.role === mine;
  const remove = async (ph) => {
    const r = await deleteInvoicePhoto(invoice.id, ph.id, { role, managerId });
    if (r.cancelled) return;
    setView(null);
    setMsg({ ok: r.ok, text: r.msg });
  };

  return (
    <div className="ivp">
      <div className="invd-card ivp-up">
        <h4 className="invd-card-title"><i className="fa-solid fa-camera" /> Upload photo</h4>
        <p className="invd-hint">
          Add photos to invoice {invoice.id}: delivery proof, damaged or wrong goods, payment slips.
          {role === "manager" ? " The client can see photos you add." : " Your area manager can see photos you add."}
        </p>

        <div
          className={`ivp-drop${drag ? " over" : ""}${slots <= 0 ? " full" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <span className="ivp-drop-ic"><i className={`fa-solid ${working ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} /></span>
          <b>{working ? "Preparing photos..." : slots <= 0 ? "Photo limit reached" : "Drag photos here"}</b>
          <small>{slots > 0 ? `JPG, PNG or WEBP - ${slots} more allowed on this invoice` : "Delete an old photo to add a new one"}</small>
          <div className="ivp-drop-btns">
            <button type="button" className="ivp-btn" disabled={slots <= 0 || working} onClick={() => camRef.current?.click()}><i className="fa-solid fa-camera" /> Take photo</button>
            <button type="button" className="ivp-btn ghost" disabled={slots <= 0 || working} onClick={() => pickRef.current?.click()}><i className="fa-regular fa-image" /> Choose from gallery</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
          <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={pick} />
        </div>

        {staged.length > 0 && (
          <>
            <p className="invd-label">Ready to upload ({staged.length})</p>
            <ul className="ivp-staged">
              {staged.map((p) => (
                <li key={p.key}>
                  <img src={p.dataUrl} alt={p.name} />
                  <span className="ivp-size">{kb(p.dataUrl)} KB</span>
                  <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setStaged((cur) => cur.filter((x) => x.key !== p.key))}><i className="fa-solid fa-xmark" /></button>
                </li>
              ))}
            </ul>

            <p className="invd-label">What is this photo of?</p>
            <div className="invd-chips">
              {KINDS.map((k) => (
                <button key={k.id} type="button" aria-pressed={kind === k.id} className={`invd-chip${kind === k.id ? " sel" : ""}`} onClick={() => setKind(k.id)}>
                  <i className={`fa-solid ${k.icon}`} /> {k.id}
                </button>
              ))}
            </div>

            <label className="invd-label" htmlFor="ivp-note">Note (optional)</label>
            <textarea id="ivp-note" className="invd-input" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: 3 cartons were wet on arrival." />
            <small className="invd-count">{note.length}/300</small>

            <div className="ivp-submit">
              <button type="button" className="invd-btn" onClick={upload} disabled={busy || working}>
                <i className="fa-solid fa-upload" /> {busy ? "Uploading..." : `Upload ${staged.length} photo${staged.length > 1 ? "s" : ""}`}
              </button>
              <button type="button" className="invd-btn ghost" onClick={() => setStaged([])} disabled={busy}>Clear</button>
            </div>
          </>
        )}
        {msg && <p className={`ivp-msg ${msg.ok ? "ok" : "bad"}`} role="status"><i className={`fa-solid ${msg.ok ? "fa-circle-check" : "fa-circle-exclamation"}`} /> {msg.text}</p>}
      </div>

      <div className="invd-card ivp-gal">
        <h4 className="invd-card-title"><i className="fa-solid fa-images" /> Photos on this invoice <span className="invd-badge">{photos.length}/{MAX_PHOTOS}</span></h4>
        {list.length === 0 ? (
          <div className="invd-empty"><i className="fa-solid fa-camera-retro" /><p>No photos yet. Take or upload one above.</p></div>
        ) : (
          <div className="ivp-grid">
            {list.map((ph, i) => (
              <button type="button" className="ivp-item" key={ph.id} onClick={() => setView(i)} aria-label={`Open ${ph.kind} photo`}>
                <img src={ph.dataUrl} alt={ph.kind} loading="lazy" />
                <span className={`ivp-role ${ph.role === "Client" ? "client" : "mgr"}`}>{ph.role}</span>
                <span className="ivp-cap"><b>{ph.kind}</b><small>{ph.by} · {fmtDate(ph.date)}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view !== null && <Lightbox list={list} index={Math.min(view, list.length - 1)} onIndex={setView} canDelete={canDelete} onDelete={remove} onClose={() => setView(null)} />}
    </div>
  );
}