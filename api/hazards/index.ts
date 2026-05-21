import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, hazardReports } from "../_lib/db";
import { desc } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const reports = await db.select().from(hazardReports).orderBy(desc(hazardReports.reportedAt));
    res.json(reports);
    return;
  }
  if (req.method === "POST") {
    const { hazardType, latitude, longitude } = req.body;
    const [report] = await db.insert(hazardReports).values({ hazardType, latitude, longitude }).returning();
    res.json(report);
    return;
  }
  res.status(405).end();
}
