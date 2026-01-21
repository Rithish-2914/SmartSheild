import express from "express";
import { storage } from "../server/storage";
import { api } from "../shared/routes";

const app = express();
app.use(express.json());

// --- Risk Prediction ---
app.get(api.risk.predict.path, async (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 0;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : 0;
  const time = (req.query.time as string) || "12:00";
  const weather = (req.query.weather as string) || "Clear";

  let riskScore = 15;
  let message = "System monitoring active.";

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
    "Hyderabad": 15, "Delhi": 15, "Mumbai": 10, "Bengaluru": 10, "Kolkata": 10, "Chennai": 5
  };
  if (minDistanceToCity < 50) {
    calculatedScore += cityBaseRisks[closestCity] || 0;
  }

  const zonesList = await storage.getAccidentZones();
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

  riskScore = Math.round(calculatedScore + proximityPenalty);

  if (proximityPenalty > 30) {
    message = `CRITICAL: Approaching High-Risk zone (${nearestZoneName}).`;
  } else if (proximityPenalty > 15) {
    message = `CAUTION: Near Accident-Prone area (${nearestZoneName}).`;
  }

  if (!isWithinIndia) {
    riskScore = 85;
    message = "WARNING: Vehicle outside standard safety monitoring zone.";
  }

  riskScore = Math.max(0, Math.min(100, Math.round(riskScore + (Math.sin(lat * 10) + Math.cos(lng * 10)) * 5)));

  let riskLevel: 'High' | 'Medium' | 'Safe' = 'Safe';
  if (riskScore >= 75) riskLevel = 'High';
  else if (riskScore >= 40) riskLevel = 'Medium';

  res.json({ riskScore, riskLevel, message, nearbyZones: zonesList });
});

app.get(api.risk.zones.path, async (req, res) => {
  const zones = await storage.getAccidentZones();
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

app.get(api.driver.getScore.path, async (req, res) => {
  const logs = await storage.getBehaviorLogs();
  let currentScore = 100;
  logs.forEach(log => { currentScore -= log.scoreDeduction; });
  currentScore = Math.max(0, currentScore);

  let badge = "Safe Driver";
  if (currentScore < 60) badge = "Risky Driver";
  else if (currentScore < 85) badge = "Caution Needed";

  res.json({ currentScore, logs, badge });
});

app.post(api.driver.logEvent.path, async (req, res) => {
  const input = api.driver.logEvent.input.parse(req.body);
  const log = await storage.createBehaviorLog(input);
  const logs = await storage.getBehaviorLogs();
  let newScore = 100;
  logs.forEach(l => { newScore -= l.scoreDeduction; });
  res.status(201).json({ newScore: Math.max(0, newScore), log });
});

app.post(api.driver.reset.path, async (req, res) => {
  await storage.clearBehaviorLogs();
  res.json({ success: true });
});

app.post(api.emergency.trigger.path, async (req, res) => {
  const { lat, lng } = req.body;
  const alert = await storage.createEmergencyAlert({
    location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    hospitalName: "City General Hospital",
    status: "Active"
  });
  res.json({
    alert,
    nearestHospital: {
      name: "City General Hospital",
      distance: "2.4 km",
      eta: "5 mins",
      coordinates: { lat: lat + 0.01, lng: lng + 0.01 }
    }
  });
});

export default app;