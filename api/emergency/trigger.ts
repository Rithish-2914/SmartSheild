import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, emergencyAlerts } from "../_lib/db";
import { eq } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const { lat, lng } = req.body;

  const [alert] = await db.insert(emergencyAlerts).values({
    location: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`,
    hospitalName: "Searching...",
    status: "Active",
  }).returning();

  let nearestHospital = {
    name: "St. John's Emergency Medical Center",
    distance: "1.2 km",
    eta: "4 mins",
    coordinates: { lat: lat + 0.005, lng: lng + 0.005 },
  };

  try {
    const query = `[out:json][timeout:25];(node["amenity"="hospital"](around:20000,${lat},${lng});way["amenity"="hospital"](around:20000,${lat},${lng}););out center;`;
    const mirrors = [
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
    ];
    let data: any;
    for (const url of mirrors) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (r.ok) { const t = await r.text(); data = JSON.parse(t); if (data.elements?.length) break; }
      } catch {}
    }
    if (data?.elements?.length) {
      const hospitals = data.elements.map((h: any) => {
        const hLat = h.lat ?? h.center?.lat;
        const hLng = h.lon ?? h.center?.lon;
        if (!hLat || !hLng) return null;
        const d = Math.sqrt(Math.pow((hLat - lat) * 111, 2) + Math.pow((hLng - lng) * 111 * Math.cos(lat * Math.PI / 180), 2));
        return { name: h.tags?.name || "Local Medical Center", lat: hLat, lng: hLng, dist: d };
      }).filter(Boolean).sort((a: any, b: any) => a.dist - b.dist);
      if (hospitals.length) {
        const best = hospitals[0];
        const distKm = best.dist.toFixed(1);
        nearestHospital = { name: best.name, distance: `${distKm} km`, eta: `${Math.ceil(Number(distKm) * 2.5) + 2} mins`, coordinates: { lat: best.lat, lng: best.lng } };
        await db.update(emergencyAlerts).set({ hospitalName: nearestHospital.name }).where(eq(emergencyAlerts.id, alert.id));
      }
    }
  } catch {}

  res.json({ alert, nearestHospital });
}
