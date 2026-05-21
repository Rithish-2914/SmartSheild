import express from "express";
import { storage } from "../server/storage.js";
import { api } from "../shared/routes.js";

const app = express();
app.use(express.json());

// Add CORS and Headers for Vercel
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
  next();
});

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
  let zones = await storage.getAccidentZones();
  
  // Auto-seed if empty (crucial for new deployments)
  if (!zones || zones.length === 0) {
    const defaultZones = [
      { name: "Andhra Pradesh", lat: "15.9129", lng: "79.7400", risk: "High", city: "Amaravati", count: 42, desc: "High accident rate on state highways." },
      { name: "Arunachal Pradesh", lat: "28.2180", lng: "94.7278", risk: "Low", city: "Itanagar", count: 8, desc: "Hilly terrain with weather-related risks." },
      { name: "Assam", lat: "26.2006", lng: "92.9376", risk: "Medium", city: "Dispur", count: 25, desc: "Frequent flooding affecting road safety." },
      { name: "Bihar", lat: "25.0961", lng: "85.3131", risk: "High", city: "Patna", count: 38, desc: "Heavy congestion and lack of traffic discipline." },
      { name: "Chhattisgarh", lat: "21.2787", lng: "81.8661", risk: "Medium", city: "Raipur", count: 20, desc: "Industrial traffic on major arteries." },
      { name: "Goa", lat: "15.2993", lng: "74.1240", risk: "Medium", city: "Panaji", count: 18, desc: "Tourist-heavy traffic on narrow roads." },
      { name: "Gujarat", lat: "22.2587", lng: "71.1924", risk: "Medium", city: "Gandhinagar", count: 30, desc: "Industrial corridors with heavy vehicle movement." },
      { name: "Haryana", lat: "29.0588", lng: "76.0856", risk: "High", city: "Chandigarh", count: 45, desc: "High speed on national highways near NCR." },
      { name: "Himachal Pradesh", lat: "31.1048", lng: "77.1734", risk: "Medium", city: "Shimla", count: 15, desc: "Steep terrain and landslide-prone roads." },
      { name: "Jharkhand", lat: "23.6102", lng: "85.2799", risk: "Medium", city: "Ranchi", count: 22, desc: "Mining trucks contributing to road risks." },
      { name: "Karnataka", lat: "15.3173", lng: "75.7139", risk: "High", city: "Bengaluru", count: 50, desc: "High urban traffic and technology hubs." },
      { name: "Kerala", lat: "10.8505", lng: "76.2711", risk: "Medium", city: "Thiruvananthapuram", count: 28, desc: "Narrow roads with high pedestrian density." },
      { name: "Madhya Pradesh", lat: "22.9734", lng: "78.6569", risk: "High", city: "Bhopal", count: 35, desc: "Central hub with heavy cross-country logistics." },
      { name: "Maharashtra", lat: "19.7515", lng: "75.7139", risk: "High", city: "Mumbai", count: 60, desc: "High traffic density and multiple expressways." },
      { name: "Manipur", lat: "24.6637", lng: "93.9063", risk: "Low", city: "Imphal", count: 6, desc: "Internal security and terrain challenges." },
      { name: "Meghalaya", lat: "25.4670", lng: "91.3662", risk: "Low", city: "Shillong", count: 7, desc: "Foggy conditions and hilly roads." },
      { name: "Mizoram", lat: "23.1645", lng: "92.9376", risk: "Low", city: "Aizawl", count: 4, desc: "Steep hills and low vehicle volume." },
      { name: "Nagaland", lat: "26.1584", lng: "94.5624", risk: "Low", city: "Kohima", count: 5, desc: "Challenging terrain and limited road width." },
      { name: "Odisha", lat: "20.9517", lng: "85.0985", risk: "Medium", city: "Bhubaneswar", count: 24, desc: "Mining and industrial traffic risks." },
      { name: "Punjab", lat: "31.1471", lng: "75.3412", risk: "Medium", city: "Chandigarh", count: 32, desc: "High speed traffic on agricultural corridors." },
      { name: "Rajasthan", lat: "27.0238", lng: "74.2179", risk: "High", city: "Jaipur", count: 40, desc: "Vast distances and highway speeding." },
      { name: "Sikkim", lat: "27.5330", lng: "88.5122", risk: "Low", city: "Gangtok", count: 4, desc: "High altitude and steep road segments." },
      { name: "Tamil Nadu", lat: "11.1271", lng: "78.6569", risk: "High", city: "Chennai", count: 52, desc: "Extensive road network and high vehicle count." },
      { name: "Telangana", lat: "18.1124", lng: "79.0193", risk: "High", city: "Hyderabad", count: 36, desc: "Rapid urban expansion and high-speed ORR." },
      { name: "Tripura", lat: "23.9408", lng: "91.9882", risk: "Low", city: "Agartala", count: 6, desc: "Limited connectivity and hilly terrain." },
      { name: "Uttar Pradesh", lat: "26.8467", lng: "80.9462", risk: "High", city: "Lucknow", count: 65, desc: "Highest population and mixed traffic types." },
      { name: "Uttarakhand", lat: "30.0668", lng: "79.0193", risk: "Medium", city: "Dehradun", count: 14, desc: "Pilgrimage traffic on mountain roads." },
      { name: "West Bengal", lat: "22.9868", lng: "87.8550", risk: "High", city: "Kolkata", count: 34, desc: "Dense urban areas and heavy port traffic." }
    ];

    for (const z of defaultZones) {
      try {
        await storage.createAccidentZone({
          locationName: z.name,
          latitude: z.lat,
          longitude: z.lng,
          riskLevel: z.risk,
          city: z.city,
          accidentCount: z.count,
          description: z.desc
        } as any);
      } catch (e) {
        console.error("Failed to seed zone:", z.name, e);
      }
    }
    zones = await storage.getAccidentZones();
  }

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

app.get("/api/roads/ratings", async (req, res) => {
  const ratings = await storage.getRoadRatings();
  res.json(ratings);
});

app.post("/api/roads/ratings", async (req, res) => {
  const rating = await storage.createRoadRating(req.body);
  res.json(rating);
});

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
    } as any);
    res.json(updated);
  } else {
    res.status(404).json({ message: "Not found" });
  }
});

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
        const response = await fetch(url);
        if (response.ok) {
          data = await response.json();
          if (data.elements && data.elements.length > 0) break;
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
      }
    } else {
      nearestHospital = {
        name: "Regional Emergency Center",
        distance: "Searching...",
        eta: "Calculating...",
        coordinates: { lat: lat + 0.005, lng: lng + 0.005 }
      };
    }
  } catch (error) {
    console.error("SOS: Hospital search failed:", error);
  }

  res.json({ alert, nearestHospital });
});

export default app;