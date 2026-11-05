import { useRef, useState } from "react";
import "./ChequePhotoUpload.css";

/*
 * Cheque photo field for the "Cheque" payment option (sits below the date field).
 *   value    : "" or a compressed JPEG data URL
 *   onChange : (dataUrl | "") => void
 * The photo is shrunk in the browser (max ~1280px JPEG) so browser storage never fills up.
 */
const MAX_CHARS = 600000;
const MAX_FILE_MB = 25;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
  img.src = url;
});

async function compress(file) {
  const img = await loadImage(file);
  const steps = [[1280, 0.8], [1024, 0.68], [800, 0.58], [640, 0.5]];
  for (const [side, quality] of steps) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cnv = document.createElement("canvas");
    cnv.width = w; cnv.height = h;
    const ctx = cnv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = cnv.toDataURL("image/jpeg", quality);
    if (out.length <= MAX_CHARS) return out;
  }
  throw new Error("toolarge");
}

export default function ChequePhotoUpload({ value, onChange, disabled = false }) {
  const camRef = useRef(null);
  const pickRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  const handle = async (fileList) => {
    const f = Array.from(fileList || [])[0];
    if (!f) return;
    setError("");
    if (!f.type.startsWith("image/")) { setError("Please choose an image (JPG, PNG or WEBP)."); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`That file is over ${MAX_FILE_MB} MB.`); return; }
    setBusy(true);
    try { onChange(await compress(f)); }
    catch { setError("Could not read that photo. Try a JPG or PNG."); }
    setBusy(false);
  };
  const pick = (e) => { handle(e.target.files); e.target.value = ""; };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (!disabled) handle(e.dataTransfer?.files); };

  return (
    <div className="cpu">
      <p className="cpu-label">Cheque photo <span>*</span></p>

      {value ? (
        <div className="cpu-preview">
          <img src={value} alt="Cheque" />
          <div className="cpu-preview-side">
            <b><i className="fa-solid fa-circle-check" /> Photo added</b>
            <small>{Math.round((value.length * 0.75) / 1024)} KB</small>
            <div className="cpu-row">
              <button type="button" className="cpu-btn" disabled={disabled || busy} onClick={() => pickRef.current?.click()}><i className="fa-solid fa-rotate" /> Replace</button>
              <button type="button" className="cpu-btn danger" disabled={disabled || busy} onClick={() => { onChange(""); setError(""); }}><i className="fa-regular fa-trash-can" /> Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`cpu-drop${drag ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-camera"} cpu-ic`} />
          <span>{busy ? "Preparing photo..." : "Upload a clear photo of the cheque"}</span>
          <div className="cpu-row">
            <button type="button" className="cpu-btn" disabled={disabled || busy} onClick={() => camRef.current?.click()}><i className="fa-solid fa-camera" /> Take photo</button>
            <button type="button" className="cpu-btn" disabled={disabled || busy} onClick={() => pickRef.current?.click()}><i className="fa-regular fa-image" /> Choose file</button>
          </div>
        </div>
      )}

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={pickRef} type="file" accept="image/*" hidden onChange={pick} />
      {error && <p className="cpu-error"><i className="fa-solid fa-circle-exclamation" /> {error}</p>}
    </div>
  );
}