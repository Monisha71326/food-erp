import { haversineKm } from "@/data/orderHubStore.js";

export const AT_STORE_KM = 0.3; // 300 m kulla = onsite

const fmt = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/* Order save panra munnaadi call pannunga.
   Return: { visitType, visitDistanceKm } | null (manager cancel -> order save panna koodaadhu) */
export function confirmVisitType(pos, c) {
  if (!pos || c?.lat == null || c?.lng == null) {
    const ok = window.confirm(
      "⚠ OFFSITE ORDER\n\nYour location / store location kedaikkala.\n\nIdhai OFFSITE order-a place pannalaama?"
    );
    return ok ? { visitType: "offsite", visitDistanceKm: null } : null;
  }

  const km = haversineKm(pos.lat, pos.lng, c.lat, c.lng);
  if (km <= AT_STORE_KM) return { visitType: "onsite", visitDistanceKm: km };

  const ok = window.confirm(
    `⚠ OFFSITE ORDER\n\nNeenga ${c.name} store-la illa (${fmt(km)} dhooram).\n\nIdhai OFFSITE order-a place pannalaama?`
  );
  return ok ? { visitType: "offsite", visitDistanceKm: km } : null;
}