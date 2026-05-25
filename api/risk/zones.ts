import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, accidentZones } from "../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const time = (req.query.time as string) || "12:00";
  const weather = (req.query.weather as string) || "Clear";
  const hour = Number(time?.split(":")[0] ?? 12);
  if (isNaN(hour)) {
    return res.status(400).json({
      error: "Invalid time format",
      });
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
}
