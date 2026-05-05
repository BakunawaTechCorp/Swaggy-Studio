/**
 * Marketplace types — shared between client and server.
 * Mirror the columns in marketplace-schema.sql.
 */

export type ActiveMode = "brand" | "partner";

export type PartnerType =
  | "blogger"
  | "influencer"
  | "journalist"
  | "outlet"
  | "creator";

export type AudienceSizeBand =
  | "unknown"
  | "nano"
  | "micro"
  | "mid"
  | "macro"
  | "mega";

export type GigStatus =
  | "draft"
  | "open"
  | "reviewing"
  | "awarded"
  | "in_progress"
  | "completed"
  | "cancelled";

export type GigMode = "open" | "invite_only";

export type ApplicationStatus =
  | "submitted"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type ContractState =
  | "awarded"
  | "delivered"
  | "approved"
  | "disputed"
  | "cancelled"
  | "completed";

export type PayoutMode = "coordination" | "escrow";
export type PayoutState =
  | "pending"
  | "funded"
  | "held"
  | "released"
  | "refunded"
  | "cancelled";

export type BrandProfile = {
  user_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  logo_url: string | null;
  contact_email: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

export type PartnerProfile = {
  user_id: string;
  display_name: string;
  partner_type: PartnerType;
  bio: string | null;
  niches: string[];
  region: string | null;
  audience_size: number | null;
  audience_size_band: AudienceSizeBand;
  primary_outlet: string | null;
  outlet_url: string | null;
  portfolio_links: string[];
  rate_card_min: number | null;
  rate_card_max: number | null;
  keywords: string[];
  verified: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileBundle = {
  brand: BrandProfile | null;
  partner: PartnerProfile | null;
  active_mode: ActiveMode;
};

export type Deliverable = {
  type: "instagram_post" | "instagram_reel" | "tiktok_video" | "blog_article" | "youtube_video" | "other";
  count: number;
  notes?: string;
};

export type PrGig = {
  id: string;
  brand_id: string;
  title: string;
  brief: string;
  deliverables: Deliverable[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  deadline: string | null;
  niches: string[];
  region: string | null;
  audience_size_min: number | null;
  audience_size_max: number | null;
  partner_types: PartnerType[];
  status: GigStatus;
  mode: GigMode;
  applications_count: number;
  awarded_application_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type PrGigWithBrand = PrGig & {
  brand_company_name: string;
  brand_industry: string | null;
  brand_logo_url: string | null;
  brand_verified: boolean;
};

export type KanbanColumn = {
  id: string;
  user_id: string;
  scope: "brand_gigs";
  status_key: GigStatus;
  display_name: string;
  position: number;
  color: string | null;
  archived: boolean;
};

export type Application = {
  id: string;
  gig_id: string;
  partner_id: string;
  proposal: string;
  proposed_rate: number | null;
  estimated_delivery: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

// Predefined niche taxonomy. Used in both brand gig posting and partner profile.
// Add to this list freely; UI reads from here.
export const NICHES = [
  "fashion",
  "beauty",
  "food",
  "travel",
  "tech",
  "gaming",
  "fitness",
  "lifestyle",
  "parenting",
  "automotive",
  "finance",
  "business",
  "music",
  "art",
  "sustainability",
  "wellness",
  "education",
  "entertainment",
  "sports",
  "outdoor",
] as const;

export type Niche = (typeof NICHES)[number];

export const REGIONS = [
  "NCR",
  "Cebu",
  "Davao",
  "Iloilo",
  "Cagayan de Oro",
  "Baguio",
  "PH-nationwide",
  "international",
] as const;

export type Region = (typeof REGIONS)[number];

export const PARTNER_TYPES: { value: PartnerType; label: string }[] = [
  { value: "blogger", label: "Blogger" },
  { value: "influencer", label: "Influencer" },
  { value: "journalist", label: "Journalist" },
  { value: "outlet", label: "Outlet / Publication" },
  { value: "creator", label: "Content Creator" },
];

export const AUDIENCE_BANDS: { value: AudienceSizeBand; label: string; min: number | null; max: number | null }[] = [
  { value: "nano", label: "Nano (under 1K)", min: 0, max: 999 },
  { value: "micro", label: "Micro (1K–10K)", min: 1000, max: 9999 },
  { value: "mid", label: "Mid (10K–100K)", min: 10000, max: 99999 },
  { value: "macro", label: "Macro (100K–1M)", min: 100000, max: 999999 },
  { value: "mega", label: "Mega (1M+)", min: 1000000, max: null },
];
