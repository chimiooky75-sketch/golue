
export enum AppTab {
  SMART_ROUTE = 'route', // Replaces MAP
  ITINERARY = 'itinerary',
  MENU_SCANNER = 'menu',
  PHOTO_MAGIC = 'photo',
  COMMUNITY = 'community',
  NATIONAL = 'national'
}

export interface RiskAnalysis {
  score: number;
  summary: string;
  risks: RiskPoint[];
}

export interface RiskPoint {
  location: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  suggestion: string;
}

export interface MenuAnalysis {
  trapsFound: string[];
  verdict: 'SAFE' | 'CAUTION' | 'DANGER';
  explanation: string;
}

// New Types for Smart Route
export interface RouteNode {
  id: number;
  name: string;
  description: string;
  type: 'FOOD' | 'SCENERY' | 'HOTEL' | 'OTHER';
  estimatedStay?: string; // e.g. "建议游玩2小时"
}

export interface RouteEdge {
  from: number;
  to: number;
  transportMode: 'WALK' | 'TAXI' | 'BUS' | 'SUBWAY';
  duration: string; // e.g. "15分钟"
  distance: string; // e.g. "1.2km"
  details?: string; // e.g. "地铁1号线"
}

export interface RoutePlan {
  title: string;
  nodes: RouteNode[];
  edges: RouteEdge[];
}

export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ZoneSubmission {
  id: string;
  city: string;
  name: string;
  type: 'RED' | 'GREEN';
  description: string;
  status: SubmissionStatus;
  submittedAt: number;
  imageUrl?: string;
  coordinates?: { x: number; y: number };
}

export interface MapZone {
  id: string;
  city: string;
  name: string;
  type: 'RED' | 'GREEN';
  description: string;
  coordinates: { x: number; y: number };
  isUserGenerated?: boolean;
}

export interface ImageEditState {
  originalUrl: string | null;
  generatedUrl: string | null;
  prompt: string;
  isProcessing: boolean;
  error: string | null;
}

export interface DestinationResult {
  text: string;
  mapLinks: Array<{
    title: string;
    uri: string;
  }>;
}
