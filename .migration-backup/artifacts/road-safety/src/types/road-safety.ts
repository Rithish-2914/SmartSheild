export interface AccidentZone {
  id: number;
  locationName: string;
  latitude: string;
  longitude: string;
  riskLevel: string;
  city: string;
  accidentCount: number | null;
  description: string | null;
}

export interface HazardReport {
  id: number;
  hazardType: string;
  latitude: string;
  longitude: string;
  reportedAt: string | null;
  upvotes: number | null;
}

export interface RoadRating {
  id: number;
  roadName: string;
  potholeCount: number | null;
  accidentHistory: number | null;
  rating: string;
  lastUpdated: string | null;
}
