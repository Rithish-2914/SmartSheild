import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, accidentZones } from "../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
}
