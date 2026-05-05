export type LibraryItemKind =
  | "caption"
  | "image"
  | "campaign"
  | "press_release";

export type CaptionPayload = {
  caption: string;
  hook_type?: string;
  tone?: string;
  reasoning?: string;
  score?: number;
  platform?: string;
  post_type?: string;
};

export type ImagePayload = {
  image_url: string;
  prompt?: string;
  rationale?: string;
  aspect_ratio?: string;
  accompanying_caption?: string;
};

export type CampaignArcPhase = { name: string; description: string };
export type CampaignChannel = { platform: string; why: string };

export type CampaignPayload = {
  id: "safe" | "engagement" | "bold" | string;
  big_idea: string;
  arc?: CampaignArcPhase[];
  channels?: CampaignChannel[];
  budget_tier?: "low" | "medium" | "high";
  risk?: string;
  score?: number;
  brief?: string;
};

export type PressReleasePayload = {
  format: "newswire";
  headline: string;
  subhead: string | null;
  dateline_city: string;
  dateline_date: string;
  lede: string;
  body_paragraphs: string[];
  quote: { text: string; attribution: string } | null;
  boilerplate: string;
  contact: { name: string; email: string; phone?: string };
  end_marker: string;
  markdown: string;
  plain_text: string;
};

export type LibraryPayload =
  | CaptionPayload
  | ImagePayload
  | CampaignPayload
  | PressReleasePayload;

export type LibraryItem = {
  id: string;
  user_id: string;
  kind: LibraryItemKind;
  title: string;
  payload: LibraryPayload;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
