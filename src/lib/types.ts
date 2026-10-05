export type Source = "osm" | "google";

export type CategoryGroupId =
  | "food"
  | "shops"
  | "lodging"
  | "health_beauty"
  | "services"
  | "auto"
  | "leisure";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeocodeResult extends GeoPoint {
  label: string;
  /** Short name used in links / exports (e.g. "Lagos"). */
  locality: string;
  type?: string;
}

export interface Lead {
  /** Stable id, prefixed by its source ("osm:node/123", "google:ChIJ…"). */
  id: string;
  source: Source;
  name: string;
  /** Human readable category (French). */
  category: string;
  group: CategoryGroupId;
  lat: number;
  lon: number;
  /** Distance from the search center, in meters. */
  distance: number;
  address?: string;
  phone?: string;
  email?: string;
  /** A real website (social / directory links are moved to `socials`). */
  website?: string;
  socials: string[];
  openingHours?: string;
  rating?: number;
  ratingCount?: number;
  mapsUrl: string;
  sourceUrl?: string;
  isChain: boolean;
  brand?: string;
}

export interface SearchParams extends GeoPoint {
  radius: number;
  groups: CategoryGroupId[];
  source: Source;
  excludeChains: boolean;
}

export interface SearchResponse {
  leads: Lead[];
  warnings: string[];
  /** Number of upstream API requests that were made. */
  requests: number;
}

export type AuditVerdict = "redo" | "improve" | "good" | "unknown";

export type CheckSeverity = "critical" | "major" | "minor";

export interface AuditCheck {
  id: string;
  label: string;
  ok: boolean;
  severity: CheckSeverity;
  /** Points removed from the score when the check fails. */
  penalty: number;
  detail?: string;
}

export interface AuditResult {
  url: string;
  finalUrl?: string;
  reachable: boolean;
  httpStatus?: number;
  error?: string;
  https: boolean;
  responseTimeMs?: number;
  htmlBytes?: number;
  score: number;
  verdict: AuditVerdict;
  /** Most important problems, already sorted, in French. */
  reasons: string[];
  checks: AuditCheck[];
  tech: string[];
  copyrightYear?: number;
  title?: string;
  emails: string[];
  phones: string[];
  socials: string[];
  auditedAt: string;
}

export interface PageSpeedResult {
  url: string;
  strategy: "mobile";
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  lcpMs?: number;
  cls?: number;
  error?: string;
}

/** Status shown for a lead's website, combining "no website" and audit verdicts. */
export type WebsiteStatus =
  | "none"
  | "social"
  | "pending"
  | "auditing"
  | AuditVerdict;

export type Opportunity = "hot" | "warm" | "cold" | "unknown";
