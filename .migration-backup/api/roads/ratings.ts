import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, roadRatings } from "../_lib/db";
import { desc } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const ratings = await db.select().from(roadRatings).orderBy(desc(roadRatings.lastUpdated));
    res.json(ratings);
    return;
  }
  if (req.method === "POST") {
    const { roadName, potholeCount, accidentHistory, rating } = req.body;
    const [newRating] = await db.insert(roadRatings).values({ roadName, potholeCount, accidentHistory, rating }).returning();
    res.json(newRating);
    return;
  }
  res.status(405).end();
}
