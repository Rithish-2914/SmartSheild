import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, hazardReports } from "../../_lib/db";
import { eq } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const id = parseInt(req.query.id as string);
  const [existing] = await db.select().from(hazardReports).where(eq(hazardReports.id, id));
  if (!existing) { res.status(404).json({ message: "Not found" }); return; }
  const [updated] = await db.update(hazardReports).set({ upvotes: (existing.upvotes || 0) + 1 }).where(eq(hazardReports.id, id)).returning();
  res.json(updated);
}
