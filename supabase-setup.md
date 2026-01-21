# Supabase Setup Guide for Smart Shield

Follow these steps to set up your Supabase database for the Smart Shield platform.

## 1. Create a New Project
1. Log in to [Supabase](https://supabase.com/).
2. Click **New Project** and select your organization.
3. Name your project (e.g., `Smart-Shield`) and set a secure database password.

## 2. Run the SQL Schema
Go to the **SQL Editor** in the Supabase sidebar and run the following code to create your tables:

```sql
-- Create Accident Zones Table
CREATE TABLE IF NOT EXISTS accident_zones (
  id SERIAL PRIMARY KEY,
  location_name TEXT NOT NULL,
  latitude TEXT NOT NULL,
  longitude TEXT NOT NULL,
  risk_level TEXT NOT NULL, -- 'High', 'Medium', 'Low'
  city TEXT NOT NULL DEFAULT 'Unknown',
  accident_count INTEGER DEFAULT 0,
  description TEXT
);

-- Create Behavior Logs Table
CREATE TABLE IF NOT EXISTS behavior_logs (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'braking', 'speeding', 'swerving'
  score_deduction INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create Emergency Alerts Table
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id SERIAL PRIMARY KEY,
  location TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'Active', 'Resolved'
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. Configure Environment Variables
1. In Supabase, go to **Project Settings** > **Database**.
2. Scroll to **Connection Pooler** and ensure it is **enabled**.
3. Set **Mode** to `Transaction`.
4. Copy the **Connection string** (it will use port `6543`).
   * *Example: postgresql://postgres.[ID]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres*
5. In **Replit Secrets** and **Vercel Environment Variables**, set `DATABASE_URL` to this string.
   * *Remember to replace `[YOUR-PASSWORD]` with your actual database password.*

## 4. Final Step
Once the database is connected, the application will automatically populate the 28 Indian states on your first visit!
