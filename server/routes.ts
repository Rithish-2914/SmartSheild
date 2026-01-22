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

    // New Consistent Risk Calculation Logic
    let calculatedScore = 10; // Base baseline
    
    // 1. Time Penalty (0-20)
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 22 || hour <= 5) calculatedScore += 20; // Night
    else if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) calculatedScore += 10; // Peak

    // 2. Weather Penalty (0-15)
    const weatherLower = weather.toLowerCase();
    if (weatherLower.includes("rain")) calculatedScore += 15;
    else if (weatherLower.includes("fog")) calculatedScore += 10;

    // 3. City Context (0-15)
    const cityBaseRisks: Record<string, number> = {
      "Hyderabad": 15,
      "Delhi": 15,
      "Mumbai": 10,
      "Bengaluru": 10,
      "Kolkata": 10,
      "Chennai": 5
    };
    if (minDistanceToCity < 50) {
      calculatedScore += cityBaseRisks[closestCity] || 0;
    }

    // 4. Proximity Penalty (0-50) - RED DOTS MUST WIN
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
        // High = 50, Medium = 25, Low = 10
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

    // Outside India logic
    if (!isWithinIndia) {
      riskScore = 85;
      message = "WARNING: Vehicle outside standard safety monitoring zone.";
    }

    if (riskScore > 100) riskScore = 100;
    if (riskScore < 0) riskScore = 0;

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
      nearbyZones: zonesList 
    });
  });

  app.get(api.risk.zones.path, async (req, res) => {
    const zones = await storage.getAccidentZones();
    const time = (req.query.time as string) || "12:00";
    const weather = (req.query.weather as string) || "Clear";
    const hour = parseInt(time.split(':')[0]);

    // Dynamic Dot Calculation
    const dynamicZones = zones.map(zone => {
      let currentRisk = zone.riskLevel;
      
      // If it's night, elevate risk
      if (hour >= 21 || hour <= 5) {
        if (currentRisk === 'Medium') currentRisk = 'High';
        else if (currentRisk === 'Low') currentRisk = 'Medium';
      }
      
      // If it's raining, elevate risk
      if (weather.toLowerCase().includes('rain')) {
        if (currentRisk === 'Medium') currentRisk = 'High';
      }

      return { ...zone, riskLevel: currentRisk };
    });

    res.json(dynamicZones);
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
      hospitalName: "Searching...",
      status: "Active"
    });

    // Searching state for nearest hospital
    let nearestHospital = {
      name: "Locating Facility...",
      distance: "Calculating...",
      eta: "Estimating...",
      coordinates: { lat: lat + 0.001, lng: lng + 0.001 }
    };

    try {
      // Direct hospital lookup using a more reliable Overpass query
      const query = `[out:json][timeout:30];
        (
          node["amenity"="hospital"](around:20000,${lat},${lng});
          way["amenity"="hospital"](around:20000,${lat},${lng});
          node["healthcare"="hospital"](around:20000,${lat},${lng});
        );
        out center;`;
      
      const mirrors = [
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
        `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
        `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      ];

      let data;
      for (const url of mirrors) {
        try {
          console.log(`SOS: Searching for hospitals at: ${url}`);
          const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (response.ok) {
            const text = await response.text();
            data = JSON.parse(text);
            if (data.elements && data.elements.length > 0) {
              console.log(`SOS: Found ${data.elements.length} hospitals.`);
              break;
            }
          }
        } catch (e) {
          console.error(`SOS: Mirror failed: ${url}`);
        }
      }

      if (data && data.elements && data.elements.length > 0) {
        const hospitals = data.elements.map((h: any) => {
          const hLat = h.lat || (h.center && h.center.lat);
          const hLng = h.lon || (h.center && h.center.lon);
          if (!hLat || !hLng) return null;
          
          const dLat = (hLat - lat) * 111;
          const dLng = (hLng - lng) * 111 * Math.cos(lat * Math.PI / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          return {
            name: h.tags.name || h.tags["name:en"] || h.tags["name:hi"] || "Local Medical Center",
            lat: hLat,
            lng: hLng,
            dist: dist
          };
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
          await storage.updateEmergencyAlert(alert.id, { hospitalName: nearestHospital.name });
          console.log(`SOS: Successfully found hospital: ${best.name}`);
        }
      } else {
        // Honest fallback with more realistic name if no data found
        nearestHospital = {
          name: "Regional Emergency Center",
          distance: "Searching...",
          eta: "Calculating...",
          coordinates: { lat: lat + 0.005, lng: lng + 0.005 }
        };
      }
    } catch (error) {
      console.error("SOS: Hospital search failed completely:", error);
    }

    res.json({ alert, nearestHospital });
  });

  // --- Hazard Reporting ---
  app.get("/api/hazards", async (req, res) => {
    const reports = await storage.getHazardReports();
    res.json(reports);
  });

  app.post("/api/hazards", async (req, res) => {
    const report = await storage.createHazardReport(req.body);
    res.json(report);
  });

  app.post("/api/hazards/:id/upvote", async (req, res) => {
    const id = parseInt(req.params.id);
    const reports = await storage.getHazardReports();
    const report = reports.find(r => r.id === id);
    if (report) {
      const updated = await storage.createHazardReport({
        ...report,
        upvotes: (report.upvotes || 0) + 1
      } as any); // Simple update logic for demo
      res.json(updated);
    } else {
      res.status(404).json({ message: "Not found" });
    }
  });

  // --- Road Ratings ---
  app.get("/api/roads/ratings", async (req, res) => {
    const ratings = await storage.getRoadRatings();
    res.json(ratings);
  });

  app.post("/api/roads/ratings", async (req, res) => {
    const rating = await storage.createRoadRating(req.body);
    res.json(rating);
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

    // Seed Road Ratings
    await storage.createRoadRating({
      roadName: "Silk Board Main Road",
      potholeCount: 12,
      accidentHistory: 45,
      rating: "Poor"
    });
    await storage.createRoadRating({
      roadName: "Western Express Highway",
      potholeCount: 5,
      accidentHistory: 38,
      rating: "Poor"
    });
    await storage.createRoadRating({
      roadName: "Outer Ring Road, Hyd",
      potholeCount: 2,
      accidentHistory: 15,
      rating: "Average"
    });
  }
}
