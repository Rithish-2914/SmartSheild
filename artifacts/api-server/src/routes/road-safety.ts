import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  accidentZones,
  behaviorLogs,
  emergencyAlerts,
  hazardReports,
  roadRatings,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export const roadSafetyRouter = Router();

// ---- Driver Score ----
roadSafetyRouter.get("/driver/score", async (_req: Request, res: Response) => {
  const logs = await db.select().from(behaviorLogs).orderBy(desc(behaviorLogs.timestamp));
  let currentScore = 100;
  logs.forEach((log) => { currentScore -= log.scoreDeduction; });
  if (currentScore < 0) currentScore = 0;
  const badge = currentScore < 60 ? "Risky Driver" : currentScore < 85 ? "Caution Needed" : "Safe Driver";
  res.json({ currentScore, logs, badge });
});

roadSafetyRouter.post("/driver/log", async (req: Request, res: Response) => {
  const { eventType, scoreDeduction } = req.body;
  const [log] = await db.insert(behaviorLogs).values({ eventType, scoreDeduction }).returning();
  const logs = await db.select().from(behaviorLogs);
  let newScore = 100;
  logs.forEach((l) => { newScore -= l.scoreDeduction; });
  if (newScore < 0) newScore = 0;
  res.status(201).json({ newScore, log });
});

roadSafetyRouter.post("/driver/reset", async (_req: Request, res: Response) => {
  await db.delete(behaviorLogs);
  res.json({ success: true });
});

// ---- Risk Zones ----
roadSafetyRouter.get("/risk/zones", async (req: Request, res: Response) => {
  const time = (req.query.time as string) || "12:00";
  const weather = (req.query.weather as string) || "Clear";
  const hour = Number(time?.split(":")[0] ?? 12);
  if (isNaN(hour)) {
    res.status(400).json({ error: "Invalid time format" });
    return;
  }
  const zones = await db.select().from(accidentZones);
  const dynamic = zones.map((zone) => {
    let currentRisk = zone.riskLevel;
    if (hour >= 21 || hour <= 5) {
      if (currentRisk === "Medium") currentRisk = "High";
      else if (currentRisk === "Low") currentRisk = "Medium";
    }
    if (weather.toLowerCase().includes("rain") && currentRisk === "Medium") currentRisk = "High";
    return { ...zone, riskLevel: currentRisk };
  });
  res.json(dynamic);
});

// ---- Risk Predict ----
roadSafetyRouter.get("/risk/predict", async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 0;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : 0;
  const time = (req.query.time as string) || "12:00";
  const weather = (req.query.weather as string) || "Clear";

  const isWithinIndia = lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;

  const majorCities = [
    { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
    { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
    { name: "Mumbai", lat: 19.076, lng: 72.8777 },
    { name: "Delhi", lat: 28.6139, lng: 77.209 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  ];

  let minDistanceToCity = Infinity;
  let closestCity = "";
  for (const city of majorCities) {
    const dLat = (lat - city.lat) * 111;
    const dLng = (lng - city.lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance < minDistanceToCity) {
      minDistanceToCity = distance;
      closestCity = city.name;
    }
  }

  let calculatedScore = 10;
  const hour = parseInt(time.split(":")[0]);
  if (hour >= 22 || hour <= 5) calculatedScore += 20;
  else if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) calculatedScore += 10;

  const wl = weather.toLowerCase();
  if (wl.includes("rain")) calculatedScore += 15;
  else if (wl.includes("fog")) calculatedScore += 10;

  const cityBaseRisks: Record<string, number> = {
    Hyderabad: 15, Delhi: 15, Mumbai: 10, Bengaluru: 10, Kolkata: 10, Chennai: 5,
  };
  if (minDistanceToCity < 50) calculatedScore += cityBaseRisks[closestCity] || 0;

  const zonesList = await db.select().from(accidentZones);
  let proximityPenalty = 0;
  let nearestZoneName = "";
  for (const zone of zonesList) {
    const zLat = parseFloat(zone.latitude);
    const zLng = parseFloat(zone.longitude);
    const dLat = (lat - zLat) * 111;
    const dLng = (lng - zLng) * 111 * Math.cos((lat * Math.PI) / 180);
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance < 10) {
      const base = zone.riskLevel === "High" ? 50 : zone.riskLevel === "Medium" ? 25 : 10;
      const penalty = base * (1 - distance / 10);
      if (penalty > proximityPenalty) { proximityPenalty = penalty; nearestZoneName = zone.locationName; }
    }
  }

  let riskScore = Math.round(calculatedScore + proximityPenalty);
  let message = "System monitoring active.";
  if (proximityPenalty > 30) message = `CRITICAL: Approaching High-Risk zone (${nearestZoneName}).`;
  else if (proximityPenalty > 15) message = `CAUTION: Near Accident-Prone area (${nearestZoneName}).`;

  if (!isWithinIndia) { riskScore = 85; message = "WARNING: Vehicle outside standard safety monitoring zone."; }

  const localVariation = (Math.sin(lat * 10) + Math.cos(lng * 10)) * 5;
  riskScore = Math.round(Math.max(0, Math.min(100, riskScore + localVariation)));

  const riskLevel: "High" | "Medium" | "Safe" = riskScore >= 75 ? "High" : riskScore >= 40 ? "Medium" : "Safe";
  res.json({ riskScore, riskLevel, message, nearbyZones: zonesList });
});

// ---- Emergency ----
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
    } catch { /* continue to next mirror */ }
  }
  return null;
}

roadSafetyRouter.post("/emergency/trigger", async (req: Request, res: Response) => {
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
        .map((h: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => {
          const hLat = h.lat ?? h.center?.lat;
          const hLng = h.lon ?? h.center?.lon;
          if (!hLat || !hLng) return null;
          const dLat = (hLat - lat) * 111;
          const dLng = (hLng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          const name = h.tags?.name || h.tags?.["name:en"] || null;
          return { name, lat: hLat, lng: hLng, dist };
        })
        .filter((h: { name: string | null; lat: number; lng: number; dist: number } | null) => h !== null && h.dist < 30)
        .sort((a: { dist: number }, b: { dist: number }) => a.dist - b.dist);

      const named = hospitals.filter((h: { name: string | null }) => h.name);
      const best = (named.length ? named : hospitals)[0];

      if (best) {
        const distKm = best.dist.toFixed(1);
        const etaMins = Math.ceil(best.dist * 3) + 2;
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
    req.log.error({ err }, "Overpass error");
  }

  res.json({ alert, nearestHospital });
});

// ---- Hazards ----
roadSafetyRouter.get("/hazards", async (_req: Request, res: Response) => {
  const reports = await db.select().from(hazardReports).orderBy(desc(hazardReports.reportedAt));
  res.json(reports);
});

roadSafetyRouter.post("/hazards", async (req: Request, res: Response) => {
  const { hazardType, latitude, longitude } = req.body;
  const [report] = await db.insert(hazardReports).values({ hazardType, latitude, longitude }).returning();
  res.json(report);
});

roadSafetyRouter.post("/hazards/:id/upvote", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [updated] = await db.update(hazardReports)
    .set({ upvotes: (await db.select().from(hazardReports).where(eq(hazardReports.id, id)))[0]?.upvotes ?? 0 + 1 })
    .where(eq(hazardReports.id, id))
    .returning();
  res.json(updated);
});

// ---- Roads ----
roadSafetyRouter.get("/roads/ratings", async (_req: Request, res: Response) => {
  const ratings = await db.select().from(roadRatings).orderBy(desc(roadRatings.lastUpdated));
  res.json(ratings);
});

// ---- AI Analyze ----
roadSafetyRouter.post("/ai/analyze", async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, error: "GEMINI_API_KEY not set" });
    return;
  }

  const { lat, lng, weather, timeOfDay, riskScore, riskLevel, nearestZone, routeName } = req.body;
  const hour = parseInt((timeOfDay || "12:00").split(":")[0]);
  const timeDesc =
    hour >= 22 || hour <= 4 ? "late night" :
    hour >= 5 && hour <= 7 ? "early morning" :
    hour >= 8 && hour <= 10 ? "morning rush hour" :
    hour >= 17 && hour <= 20 ? "evening rush hour" : "daytime";

  const prompt = `You are SafePath AI, an advanced road safety intelligence system for India.
Analyze the following real-time driving conditions and provide a concise safety briefing.

CONDITIONS:
- Location: ${lat?.toFixed(4)}, ${lng?.toFixed(4)} (India)
- Time: ${timeOfDay} (${timeDesc})
- Weather: ${weather}
- Current Risk Score: ${riskScore}% (${riskLevel})
${nearestZone ? `- Nearest hazard zone: ${nearestZone}` : ""}
${routeName ? `- Active route: ${routeName}` : ""}

Respond with a JSON object in this exact format:
{
  "threat_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "1-2 sentence AI safety assessment",
  "warnings": ["warning 1", "warning 2", "warning 3"],
  "recommendations": ["action 1", "action 2"],
  "predicted_incidents": "brief prediction (1 sentence)",
  "safe_speed": "recommended max speed in current conditions"
}

Be specific to Indian road conditions. Keep each string under 80 characters.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const text = response.text ?? "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    res.json({ success: true, analysis: parsed });
  } catch (err) {
    req.log.error({ err }, "AI analyze failed");
    res.status(500).json({ success: false, error: "AI analysis failed" });
  }
});
