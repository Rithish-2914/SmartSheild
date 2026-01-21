import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

if (process.env.DATABASE_URL?.includes('helium')) {
  console.warn("WARNING: You are using an internal Replit database URL ('helium'). This will NOT work on Vercel. Please use the External Connection String from the Database tool settings.");
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL?.includes('sslmode=disable') || process.env.DATABASE_URL?.includes('helium')) 
    ? false 
    : { rejectUnauthorized: false }
});
export const db = drizzle(pool, { schema });
