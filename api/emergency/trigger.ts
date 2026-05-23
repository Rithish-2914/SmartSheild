import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, emergencyAlerts } from "../_lib/db";
import { eq } from "drizzle-orm";

async function fetchOverpass(query: string, timeoutMs: number) {
  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  for (const base of mirrors) {
    try {
      const r = await fetch(`${base}?data=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "SafePath-Emergency/1.0" },
      });
      if (!r.ok) continue;
      const text = await r.text();
      const data = JSON.parse(text);
      if (data?.elements?.length) return data;
    } catch {}
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "Invalid coordinates" });
    return;
  }

  const [alert] = await db.insert(emergencyAlerts).values({
    location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    hospitalName: "Searching...",
    status: "Active",
  }).returning();

  let nearestHospital = {
    name: "Nearest Medical Center",
    distance: "Unknown",
    eta: "Unknown",
    coordinates: { lat: lat + 0.008, lng: lng + 0.008 },
    found: false,
  };

  try {
    // Search for hospitals, clinics, and healthcare facilities within 25 km
    const query = `[out:json][timeout:20];
(
  node["amenity"="hospital"](around:25000,${lat},${lng});
  way["amenity"="hospital"](around:25000,${lat},${lng});
  node["healthcare"="hospital"](around:25000,${lat},${lng});
  way["healthcare"="hospital"](around:25000,${lat},${lng});
  node["amenity"="clinic"](around:10000,${lat},${lng});
  node["healthcare"="clinic"](around:10000,${lat},${lng});
);
out center tags;`;

    const data = await fetchOverpass(query, 9000);

    if (data?.elements?.length) {
      const hospitals = data.elements
        .map((h: any) => {
          const hLat = h.lat ?? h.center?.lat;
          const hLng = h.lon ?? h.center?.lon;
          if (!hLat || !hLng) return null;
          const dLat = (hLat - lat) * 111;
          const dLng = (hLng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          const name = h.tags?.name || h.tags?.["name:en"] || null;
          return { name, lat: hLat, lng: hLng, dist };
        })
        .filter((h: any) => h !== null && h.dist < 30)
        .sort((a: any, b: any) => a.dist - b.dist);

      // Prefer named hospitals; fall back to unnamed if nothing named found
      const named = hospitals.filter((h: any) => h.name);
      const best = (named.length ? named : hospitals)[0];

      if (best) {
        const distKm = best.dist.toFixed(1);
        const etaMins = Math.ceil(best.dist * 3) + 2; // ~20 km/h in emergency traffic
        nearestHospital = {
          name: best.name || "Medical Facility",
          distance: `${distKm} km`,
          eta: `${etaMins} mins`,
          coordinates: { lat: best.lat, lng: best.lng },
          found: true,
        };
        await db.update(emergencyAlerts)
          .set({ hospitalName: nearestHospital.name })
          .where(eq(emergencyAlerts.id, alert.id));
      }
    }
  } catch (err) {
    console.error("Overpass error:", err);
  }

  res.json({ alert, nearestHospital });
}
