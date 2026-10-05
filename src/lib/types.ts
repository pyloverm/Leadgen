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
  /** Stable id ("osm:node/123"). */
  id: string;
  name: string;
  /** Human readable category (French). */
  category: string;
  group: CategoryGroupId;
  lat: number;
  lon: number;
  /** Distance from the search center, in meters. */
  distance: number;
  address?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  /** A real website (social / directory links are moved to `socials`). */
  website?: string;
  socials: string[];
  openingHours?: string;
  mapsUrl: string;
  sourceUrl?: string;
  isChain: boolean;
  brand?: string;
}

export interface SearchParams extends GeoPoint {
  radius: number;
  groups: CategoryGroupId[];
  excludeChains: boolean;
}

export interface SearchResponse {
  leads: Lead[];
  warnings: string[];
}

/** What we know about a business when looking for its website. */
export interface DiscoveryInput {
  name: string;
  locality?: string;
  city?: string;
  postcode?: string;
  address?: string;
  phone?: string;
  email?: string;
  /** Location of the business, used to tell apart homonyms in other regions. */
  lat?: number;
  lon?: number;
}

export interface DiscoveryResult {
  /** Verified website, when one was found. */
  website?: string;
  confidence?: "high" | "medium";
  method?: "email" | "domain";
  /** Why we believe the site belongs to this business (French). */
  evidence: string[];
  /** Domains matching the name that are registered but parked / empty. */
  parked: string[];
  /** Same-name websites that were ruled out, with the reason (French). */
  rejected?: string[];
  /** Number of candidate domains tested. */
  checked: number;
  checkedAt: string;
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

/** Stylesheet and image inspection, done with plain HTTP requests. */
export interface AssetStats {
  stylesheets: number;
  cssFetched: number;
  /** Every stylesheet could be read (no failure, no @import), so a missing @media is meaningful. */
  cssComplete: boolean;
  /** At least one responsive `@media (min|max-width)` rule was found. */
  mediaQueries: boolean;
  /** A container with a fixed width ≥ 700px (CSS or HTML attribute): typical of desktop-only layouts. */
  fixedLayout: boolean;
  images: number;
  imagesChecked: number;
  imageBytes: number;
  heaviestImage?: { url: string; bytes: number };
  modernImages: boolean;
}

/** Homepage history from the Internet Archive (Wayback Machine). Dates are "YYYY-MM". */
export interface SiteHistory {
  firstSeen: string;
  lastCapture: string;
  /** Start of the last period during which the archived homepage did not change. */
  unchangedSince: string;
  captures: number;
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
  assets?: AssetStats;
  history?: SiteHistory;
  auditedAt: string;
}

/** Status shown for a lead's website, combining "no website" and audit verdicts. */
export type WebsiteStatus =
  | "none"
  | "social"
  | "searching"
  | "pending"
  | "auditing"
  | AuditVerdict;

export type Opportunity = "hot" | "warm" | "cold" | "unknown";
