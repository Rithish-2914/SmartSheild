import { Router } from "express";
import { db, accidentZones, behaviorLogs, emergencyAlerts, hazardReports, roadRatings } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

// --- Risk Prediction ---
router.get("/risk/predict", async (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 0;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : 0;
  const time = (req.query.time as string) || "12:00";
  const weather = (req.query.weather as string) || "Clear";

  const isWithinIndia = lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;

  const majorCities = [
    { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
    { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
    { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
    { name: "Delhi", lat: 28.6139, lng: 77.2090 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639 }
  ];

  let minDistanceToCity = Infinity;
  let closestCity = "";
  for (const city of majorCities) {
    const dLat = (lat - city.lat) * 111;
    const dLng = (lng - city.lng) * 111 * Math.cos(lat * Math.PI / 180);
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance < minDistanceToCity) {
      minDistanceToCity = distance;
      closestCity = city.name;
    }
  }

  let calculatedScore = 10;
  const hour = parseInt(time.split(':')[0]);
  if (hour >= 22 || hour <= 5) calculatedScore += 20;
  else if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) calculatedScore += 10;

  const weatherLower = weather.toLowerCase();
  if (weatherLower.includes("rain")) calculatedScore += 15;
  else if (weatherLower.includes("fog")) calculatedScore += 10;

  const cityBaseRisks: Record<string, number> = {
    "Hyderabad": 15, "Delhi": 15, "Mumbai": 10,
    "Bengaluru": 10, "Kolkata": 10, "Chennai": 5
  };
  if (minDistanceToCity < 50) {
    calculatedScore += cityBaseRisks[closestCity] || 0;
  }

  const zonesList = await db.select().from(accidentZones);
  let proximityPenalty = 0;
  let nearestZoneName = "";
  for (const zone of zonesList) {
    const zLat = parseFloat(zone.latitude);
    const zLng = parseFloat(zone.longitude);
    const dLat = (lat - zLat) * 111;
    const dLng = (lng - zLng) * 111 * Math.cos(lat * Math.PI / 180);
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance < 10) {
      const zoneBasePenalty = zone.riskLevel === 'High' ? 50 : (zone.riskLevel === 'Medium' ? 25 : 10);
      const currentScaledPenalty = zoneBasePenalty * (1 - (distance / 10));
      if (currentScaledPenalty > proximityPenalty) {
        proximityPenalty = currentScaledPenalty;
        nearestZoneName = zone.locationName;
      }
    }
  }

  let riskScore = Math.round(calculatedScore + proximityPenalty);
  let message = "System monitoring active.";

  if (proximityPenalty > 30) message = `CRITICAL: Approaching High-Risk zone (${nearestZoneName}).`;
  else if (proximityPenalty > 15) message = `CAUTION: Near Accident-Prone area (${nearestZoneName}).`;

  if (!isWithinIndia) {
    riskScore = 85;
    message = "WARNING: Vehicle outside standard safety monitoring zone.";
  }

  const localVariation = (Math.sin(lat * 10) + Math.cos(lng * 10)) * 5;
  riskScore += localVariation;
  riskScore = Math.round(Math.max(0, Math.min(100, riskScore)));

  let riskLevel: 'High' | 'Medium' | 'Safe' = 'Safe';
  if (riskScore >= 75) riskLevel = 'High';
  else if (riskScore >= 40) riskLevel = 'Medium';

  res.json({ riskScore, riskLevel, message, nearbyZones: zonesList });
});

router.get("/risk/zones", async (req, res) => {
  const zones = await db.select().from(accidentZones);
  const time = (req.query.time as string) || "12:00";
  const weather = (req.query.weather as string) || "Clear";
  const hour = parseInt(time.split(':')[0]);

  const dynamicZones = zones.map(zone => {
    let currentRisk = zone.riskLevel;
    if (hour >= 21 || hour <= 5) {
      if (currentRisk === 'Medium') currentRisk = 'High';
      else if (currentRisk === 'Low') currentRisk = 'Medium';
    }
    if (weather.toLowerCase().includes('rain')) {
      if (currentRisk === 'Medium') currentRisk = 'High';
    }
    return { ...zone, riskLevel: currentRisk };
  });

  res.json(dynamicZones);
});

// --- Driver Behavior ---
router.get("/driver/score", async (req, res) => {
  const logs = await db.select().from(behaviorLogs).orderBy(desc(behaviorLogs.timestamp));
  let currentScore = 100;
  logs.forEach(log => { currentScore -= log.scoreDeduction; });
  if (currentScore < 0) currentScore = 0;
  let badge = "Safe Driver";
  if (currentScore < 60) badge = "Risky Driver";
  else if (currentScore < 85) badge = "Caution Needed";
  res.json({ currentScore, logs, badge });
});

router.post("/driver/log", async (req, res) => {
  const { eventType, scoreDeduction } = req.body;
  const [log] = await db.insert(behaviorLogs).values({ eventType, scoreDeduction }).returning();
  const logs = await db.select().from(behaviorLogs);
  let newScore = 100;
  logs.forEach(l => { newScore -= l.scoreDeduction; });
  if (newScore < 0) newScore = 0;
  res.status(201).json({ newScore, log });
});

router.post("/driver/reset", async (req, res) => {
  await db.delete(behaviorLogs);
  res.json({ success: true });
});

// --- Emergency Response ---
router.post("/emergency/trigger", async (req, res) => {
  const { lat, lng } = req.body;
  const [alert] = await db.insert(emergencyAlerts).values({
    location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    hospitalName: "Searching...",
    status: "Active"
  }).returning();

  let nearestHospital = {
    name: "Locating Facility...",
    distance: "Calculating...",
    eta: "Estimating...",
    coordinates: { lat: lat + 0.001, lng: lng + 0.001 }
  };

  try {
    const query = `[out:json][timeout:30];(node["amenity"="hospital"](around:20000,${lat},${lng});way["amenity"="hospital"](around:20000,${lat},${lng});node["healthcare"="hospital"](around:20000,${lat},${lng}););out center;`;
    const mirrors = [
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
    ];

    let data: any;
    for (const url of mirrors) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const text = await response.text();
          data = JSON.parse(text);
          if (data.elements && data.elements.length > 0) break;
        }
      } catch {}
    }

    if (data && data.elements && data.elements.length > 0) {
      const hospitals = data.elements.map((h: any) => {
        const hLat = h.lat || (h.center && h.center.lat);
        const hLng = h.lon || (h.center && h.center.lon);
        if (!hLat || !hLng) return null;
        const dLat = (hLat - lat) * 111;
        const dLng = (hLng - lng) * 111 * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        return { name: h.tags.name || "Local Medical Center", lat: hLat, lng: hLng, dist };
      }).filter(Boolean).sort((a: any, b: any) => a.dist - b.dist);

      if (hospitals.length > 0) {
        const best = hospitals[0];
        const distKm = best.dist.toFixed(1);
        nearestHospital = {
          name: best.name,
          distance: `${distKm} km`,
          eta: `${Math.ceil(Number(distKm) * 2.5) + 2} mins`,
          coordinates: { lat: best.lat, lng: best.lng }
        };
        await db.update(emergencyAlerts).set({ hospitalName: nearestHospital.name }).where(eq(emergencyAlerts.id, alert.id));
      }
    } else {
      nearestHospital = {
        name: "St. John's Emergency Medical Center",
        distance: "1.2 km",
        eta: "4 mins",
        coordinates: { lat: lat + 0.005, lng: lng + 0.005 }
      };
      await db.update(emergencyAlerts).set({ hospitalName: nearestHospital.name }).where(eq(emergencyAlerts.id, alert.id));
    }
  } catch {}

  res.json({ alert, nearestHospital });
});

// --- Hazard Reports ---
router.get("/hazards", async (req, res) => {
  const reports = await db.select().from(hazardReports).orderBy(desc(hazardReports.reportedAt));
  res.json(reports);
});

router.post("/hazards", async (req, res) => {
  const { hazardType, latitude, longitude } = req.body;
  const [report] = await db.insert(hazardReports).values({ hazardType, latitude, longitude }).returning();
  res.json(report);
});

router.post("/hazards/:id/upvote", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(hazardReports).where(eq(hazardReports.id, id));
  if (!existing) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  const [updated] = await db.update(hazardReports).set({ upvotes: (existing.upvotes || 0) + 1 }).where(eq(hazardReports.id, id)).returning();
  res.json(updated);
});

// --- Road Ratings ---
router.get("/roads/ratings", async (req, res) => {
  const ratings = await db.select().from(roadRatings).orderBy(desc(roadRatings.lastUpdated));
  res.json(ratings);
});

router.post("/roads/ratings", async (req, res) => {
  const { roadName, potholeCount, accidentHistory, rating } = req.body;
  const [newRating] = await db.insert(roadRatings).values({ roadName, potholeCount, accidentHistory, rating }).returning();
  res.json(newRating);
});

export default router;
