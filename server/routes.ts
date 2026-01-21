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

    // Simple Logic for Risk Score
    let riskScore = 10; // Base risk
    let message = "Conditions are safe.";

    // Time based risk
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 22 || hour <= 5) {
      riskScore += 30; // Night driving
      message = "Night driving increases risk.";
    } else if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
      riskScore += 20; // Rush hour
      message = "High traffic volume detected.";
    }

    // Weather based risk
    const weatherLower = weather.toLowerCase();
    if (weatherLower.includes("rain")) {
      riskScore += 40;
      message += " Slippery roads due to rain.";
    } else if (weatherLower.includes("snow") || weatherLower.includes("ice")) {
      riskScore += 50;
      message += " Hazardous road conditions.";
    } else if (weatherLower.includes("fog")) {
      riskScore += 30;
      message += " Reduced visibility.";
    }

    // Location proximity (Mock: check if close to a "known" zone)
    const zones = await storage.getAccidentZones();
    // Simple mock "nearby" check - if we had real lat/lng we'd calc distance
    // For demo, we'll just say if risk > 80, we are in a Red Zone.

    if (riskScore > 100) riskScore = 100;

    let riskLevel: 'High' | 'Medium' | 'Safe' = 'Safe';
    if (riskScore >= 70) riskLevel = 'High';
    else if (riskScore >= 40) riskLevel = 'Medium';

    res.json({
      riskScore,
      riskLevel,
      message,
      nearbyZones: zones // Send all zones for map display
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
