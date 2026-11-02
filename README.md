# 🛡️ SmartShield — AI Road Safety & Accident Prevention Platform

> **An intelligent automotive telemetry and road safety intelligence system providing real-time accident hazard predictions, driver aggression scoring, blackspot navigation heatmaps, and automated emergency SOS alerts.**

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Overview

**SmartShield** is an advanced vehicle intelligence and accident-prevention dashboard engineered to lower road fatality rates. Combining real-time telemetry inputs (accelerometer braking, speed variance, turn velocity) with machine-learning hazard maps and weather conditions, SmartShield evaluates real-time danger indexes, gives audible proactive warnings to drivers, and triggers instant dispatch in severe collisions.

---

## ✨ Features

- **🗺️ Predictive Accident Zone Heatmap**: Dynamic geospatial mapping of high-risk accident blackspots, road condition ratings, and community hazard alerts.
- **📊 Real-Time Driver Score Gauge**: Telemetry-based scoring tracking smooth acceleration, safe braking intervals, and curve navigation.
- **⚠️ AI Threat Level & Weather Adjustment**: Integrates live precipitation, time-of-day visibility, and road grade to recommend safe transit speeds.
- **🚨 Instant SOS & Emergency Modal**: One-touch collision emergency dispatch transmitting GPS coordinates and vehicle status to emergency services.
- **🕹️ Interactive Simulation Mode**: Test edge-case hazard warnings and driver maneuvers with built-in telemetry simulation.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Radix UI Primitives
- **Data & Visualizations**: TanStack Query (React Query), Recharts, Leaflet/Mapbox geospatial mapping
- **Architecture**: Monorepo with dedicated `road-safety` dashboard, `api-server`, and simulation sandbox

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- pnpm or npm

### 1. Clone the Repository
```bash
git clone https://github.com/Rithish-2914/SmartSheild.git
cd SmartSheild
```

### 2. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Run the Road Safety Application
```bash
cd artifacts/road-safety
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📂 Project Structure

```
SmartShield/
├── artifacts/
│   └── road-safety/         # Main frontend telemetry dashboard
│       ├── src/
│       │   ├── components/  # DriverGauge, RiskMap, CyberCard, EmergencyModal
│       │   ├── hooks/       # useDriverScore, useRiskPrediction, useAccidentZones
│       │   ├── pages/       # Dashboard and hazard monitors
│       │   └── types/       # Telemetry and road safety type definitions
├── api/                     # Backend risk prediction services
├── .env.example             # Environment template
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
