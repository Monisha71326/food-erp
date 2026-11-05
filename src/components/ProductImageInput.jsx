import { useRef, useState } from "react";

/*
 * Product image picker (Add / Edit Product).
 *
 *   <ProductImageInput value={image} onChange={setImage} />
 *   <ProductImageInput value={p.image} onChange={...} compact />   // small version for table rows
 *
 *  - value    : current image (URL or data URL, "" when none)
 *  - onChange : called with the new data URL, or "" when removed
 * The picked photo is resized to max 600px and saved as JPEG so the browser database stays small.
 */
const MAX_SIDE = 600;
const MAX_FILE_MB = 8;

function resizeToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a valid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; // PNG with transparency -> white background
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductImageInput({ value = "", onChange, compact = false }) {
  const fileRef = useRef(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const box = { display: "flex", alignItems: "center", gap: compact ? 8 : 14, flexWrap: "wrap" };
  const preview = {
    width: compact ? 48 : 96, height: compact ? 48 : 72, borderRadius: compact ? 8 : 10, overflow: "hidden",
    border: "1px dashed #cbd5e1", background: "#f1f5f9", display: "grid", placeItems: "center",
    color: "#94a3b8", fontSize: compact ? 9 : 11, flex: "none",
  };
  const btn = {
    padding: compact ? "5px 10px" : "9px 14px", borderRadius: compact ? 8 : 10, border: "1px solid #a1122f",
    background: "transparent", color: "#a1122f", fontWeight: 700, fontSize: compact ? 12 : 13, cursor: "pointer",
  };
  const btnGhost = { ...btn, border: "1px solid #e2e8f0", color: "#475569" };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file (jpg, png, webp).");
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setErr(`Image is too big (max ${MAX_FILE_MB} MB).`);
    setBusy(true);
    try {
      onChange(await resizeToDataUrl(file));
    } catch (ex) {
      setErr(ex.message || "Could not use that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={box}>
        <div style={preview}>
          {value ? <img src={value} alt="Product preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "No image"}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
          <button type="button" style={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Processing..." : value ? "Change" : "Upload image"}
          </button>
          {value && <button type="button" style={btnGhost} onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
      {err && <small style={{ color: "#b91c1c", fontWeight: 600, display: "block", marginTop: 6 }}>{err}</small>}
    </div>
  );
}