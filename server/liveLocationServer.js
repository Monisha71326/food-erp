// npm i express cors
// run: node server/liveLocationServer.js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const ONLINE_MS = 2 * 60 * 1000; // 2 min-ku update varala na "offline"
const live = new Map(); // managerId -> { managerId, name, lat, lng, acc, at }

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// Manager browser inge location anuppum
app.post("/api/live-location", (req, res) => {
  const { managerId, name, lat, lng, acc } = req.body || {};
  if (!managerId || !validCoord(lat, lng)) return res.status(400).json({ error: "Invalid payload" });
  live.set(String(managerId), { managerId: String(managerId), name: name || "", lat, lng, acc: acc ?? null, at: Date.now() });
  res.json({ ok: true });
});

// Admin / dashboard ellaa managers-oda latest location-a edukkum
app.get("/api/live-location", (_req, res) => {
  const now = Date.now();
  res.json([...live.values()].map((v) => ({ ...v, online: now - v.at < ONLINE_MS })));
});

// Manager "sharing stop" panna
app.delete("/api/live-location/:managerId", (req, res) => {
  live.delete(String(req.params.managerId));
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Live location API on :${PORT}`));