import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { accidentZones } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Risk Prediction ---
  app.get(api.risk.predict.path, async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 0;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 0;
    const time = (req.query.time as string) || "12:00";
    const weather = (req.query.weather as string) || "Clear";

    // Dynamic Risk Score Logic for India
    let riskScore = 15; // Base risk
    let message = "System monitoring active.";

    // Geofence check for India (approximate bounding box)
    const isWithinIndia = lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;
    
    if (!isWithinIndia) {
      riskScore = 85;
      message = "WARNING: Vehicle outside standard safety monitoring zone (Off-road/International).";
    }

    // Distance-based base risk from major hubs
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

    // Increase risk as we move away from safe hubs or deep into remote areas
    // Remote area risk (simple model: risk increases with distance from any major city)
    if (isWithinIndia) {
      if (minDistanceToCity > 100) {
        riskScore += Math.min(30, (minDistanceToCity - 100) / 10);
        message = "Entering remote region: Reduced emergency response availability.";
      }
    }

    // Time based risk
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 22 || hour <= 5) {
      riskScore += 25;
      message = "High risk: Night driving hazards detected.";
    } else if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
      riskScore += 15;
    }

    // Weather based risk
    const weatherLower = weather.toLowerCase();
    if (weatherLower.includes("rain")) riskScore += 20;
    else if (weatherLower.includes("fog")) riskScore += 15;

    // Location proximity logic
    const zones = await storage.getAccidentZones();
    let proximityPenalty = 0;
    let nearestZoneName = "";

    // City-specific base risks based on time
    const cityBaseRisks: Record<string, { night: number, day: number }> = {
      "Hyderabad": { night: 60, day: 20 },
      "Bengaluru": { night: 40, day: 15 },
      "Mumbai": { night: 50, day: 25 },
      "Delhi": { night: 55, day: 30 },
      "Chennai": { night: 35, day: 15 },
      "Kolkata": { night: 45, day: 20 }
    };

    if (minDistanceToCity < 50) {
      const cityData = cityBaseRisks[closestCity];
      if (cityData) {
        const isNight = hour >= 21 || hour <= 5;
        riskScore = Math.max(riskScore, isNight ? cityData.night : cityData.day);
      }
    }

    for (const zone of zones) {
      const zLat = parseFloat(zone.latitude);
      const zLng = parseFloat(zone.longitude);
      
      const dLat = (lat - zLat) * 111;
      const dLng = (lng - zLng) * 111 * Math.cos(lat * Math.PI / 180);
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distance < 5) { // Immediate zone proximity
        const penalty = zone.riskLevel === 'High' ? 40 : (zone.riskLevel === 'Medium' ? 20 : 10);
        const scaledPenalty = penalty * (1 - (distance / 5));
        proximityPenalty = Math.max(proximityPenalty, scaledPenalty);
        if (proximityPenalty === scaledPenalty) nearestZoneName = zone.locationName;
      }
    }

    riskScore += proximityPenalty;
    if (proximityPenalty > 10) {
      message = `CAUTION: Critical accident zone (${nearestZoneName}).`;
    }

    // Add coordinate-based variation (seed for deterministic local jitter)
    const localVariation = (Math.sin(lat * 10) + Math.cos(lng * 10)) * 5;
    riskScore += localVariation;

    if (riskScore > 100) riskScore = 100;
    if (riskScore < 0) riskScore = 0;
    riskScore = Math.round(riskScore);

    let riskLevel: 'High' | 'Medium' | 'Safe' = 'Safe';
    if (riskScore >= 75) riskLevel = 'High';
    else if (riskScore >= 40) riskLevel = 'Medium';

    res.json({
      riskScore,
      riskLevel,
      message,
      nearbyZones: zones 
    });
  });

  app.get(api.risk.zones.path, async (req, res) => {
    const zones = await storage.getAccidentZones();
    res.json(zones);
  });

  // --- Driver Behavior ---
  app.get(api.driver.getScore.path, async (req, res) => {
    const logs = await storage.getBehaviorLogs();
    
    let currentScore = 100;
    logs.forEach(log => {
      currentScore -= log.scoreDeduction;
    });
    if (currentScore < 0) currentScore = 0;

    let badge = "Safe Driver";
    if (currentScore < 60) badge = "Risky Driver";
    else if (currentScore < 85) badge = "Caution Needed";

    res.json({ currentScore, logs, badge });
  });

  app.post(api.driver.logEvent.path, async (req, res) => {
    const input = api.driver.logEvent.input.parse(req.body);
    const log = await storage.createBehaviorLog(input);
    
    // Recalculate score
    const logs = await storage.getBehaviorLogs();
    let newScore = 100;
    logs.forEach(l => {
      newScore -= l.scoreDeduction;
    });
    if (newScore < 0) newScore = 0;

    res.status(201).json({ newScore, log });
  });

  app.post(api.driver.reset.path, async (req, res) => {
    await storage.clearBehaviorLogs();
    res.json({ success: true });
  });

  // --- Emergency Response ---
  app.post(api.emergency.trigger.path, async (req, res) => {
    const { lat, lng } = req.body;
    
    // Create alert
    const alert = await storage.createEmergencyAlert({
      location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      hospitalName: "City General Hospital",
      status: "Active"
    });

    // Mock Hospital Data
    const nearestHospital = {
      name: "City General Hospital",
      distance: "2.4 km",
      eta: "5 mins",
      coordinates: { lat: lat + 0.01, lng: lng + 0.01 } // Just slightly offset
    };

    res.json({ alert, nearestHospital });
  });

  // --- Seed Data Helper ---
  seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingZones = await storage.getAccidentZones();
  if (existingZones.length === 0) {
    // Seed Indian cities data
    await storage.createAccidentZone({
      locationName: "Silk Board Junction, Bengaluru",
      latitude: "12.9176",
      longitude: "77.6233",
      riskLevel: "High",
      accidentCount: 45,
      description: "Extremely high traffic density and complex merging lanes."
    });
    await storage.createAccidentZone({
      locationName: "Western Express Highway, Mumbai",
      latitude: "19.0760",
      longitude: "72.8777",
      riskLevel: "High",
      accidentCount: 38,
      description: "High speed corridor with frequent lane cutting incidents."
    });
    await storage.createAccidentZone({
      locationName: "Connaught Place, Delhi",
      latitude: "28.6315",
      longitude: "77.2167",
      riskLevel: "Medium",
      accidentCount: 12,
      description: "Heavy pedestrian movement and chaotic circular traffic."
    });
    await storage.createAccidentZone({
      locationName: "Outer Ring Road, Hyderabad",
      latitude: "17.3850",
      longitude: "78.4867",
      riskLevel: "Medium",
      accidentCount: 15,
      description: "Speeding violations common during night hours."
    });
  }
}
