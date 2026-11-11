import { haversineKm } from "@/data/orderHubStore.js";
import { confirmOffsite } from "@/components/OffsiteConfirm/OffsiteConfirm.jsx";

export const AT_STORE_KM = 0.3; // within 300 m = onsite

/* Call BEFORE saving the order. It is ASYNC now, so always use  await confirmVisitType(...)
   Returns { visitType, visitDistanceKm } or null (manager cancelled -> do NOT save the order). */
export async function confirmVisitType(pos, c, totalText = "") {
  if (!pos || c?.lat == null || c?.lng == null) {
    const ok = await confirmOffsite({ clientName: c?.name, distanceKm: null, totalText });
    return ok ? { visitType: "offsite", visitDistanceKm: null } : null;
  }

  const km = haversineKm(pos.lat, pos.lng, c.lat, c.lng);
  if (km <= AT_STORE_KM) return { visitType: "onsite", visitDistanceKm: km };

  const ok = await confirmOffsite({ clientName: c.name, distanceKm: km, totalText });
  return ok ? { visitType: "offsite", visitDistanceKm: km } : null;
}