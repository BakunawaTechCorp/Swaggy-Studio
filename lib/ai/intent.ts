export const GOALS = [
  { id: "awareness", label: "Awareness", desc: "Get more eyes on the brand" },
  { id: "engagement", label: "Engagement", desc: "Comments, shares, replies" },
  { id: "conversion", label: "Conversion", desc: "Drive a click or sale" },
  { id: "follower_growth", label: "Follower growth", desc: "Convert viewers into followers" },
  { id: "loyalty", label: "Loyalty", desc: "Strengthen existing audience" },
] as const;
export type GoalId = (typeof GOALS)[number]["id"];

export const TONES = [
  { id: "playful", label: "Playful" },
  { id: "premium", label: "Premium" },
  { id: "bold", label: "Bold" },
  { id: "friendly", label: "Friendly" },
  { id: "luxury", label: "Luxury" },
  { id: "minimalist", label: "Minimalist" },
  { id: "warm", label: "Warm" },
  { id: "witty", label: "Witty" },
] as const;
export type ToneId = (typeof TONES)[number]["id"];

export const AUDIENCES = [
  { id: "entrepreneurs", label: "Entrepreneurs" },
  { id: "moms", label: "Moms" },
  { id: "gen_z", label: "Gen Z" },
  { id: "millennials", label: "Millennials" },
  { id: "fitness", label: "Fitness enthusiasts" },
  { id: "fashion", label: "Fashion-forward" },
  { id: "foodies", label: "Foodies" },
  { id: "creators", label: "Content creators" },
  { id: "students", label: "Students" },
  { id: "professionals", label: "Working professionals" },
] as const;
export type AudienceId = (typeof AUDIENCES)[number]["id"];

export const HOOK_STYLES = [
  { id: "storytelling", label: "Storytelling", desc: "Open with a mini-scene" },
  { id: "direct_cta", label: "Direct CTA", desc: "Lead with the offer" },
  { id: "question", label: "Question hook", desc: "Open with a question" },
  { id: "controversial", label: "Controversial", desc: "Take a stance" },
  { id: "value_first", label: "Value-first", desc: "Lead with insight" },
] as const;
export type HookStyleId = (typeof HOOK_STYLES)[number]["id"];

export const EMOTIONS = [
  { id: "inspire", label: "Inspire" },
  { id: "excite", label: "Excite" },
  { id: "curiosity", label: "Spark curiosity" },
  { id: "trust", label: "Build trust" },
  { id: "urgency", label: "Create urgency" },
  { id: "humor", label: "Make them laugh" },
] as const;
export type EmotionId = (typeof EMOTIONS)[number]["id"];

export const LENGTHS = [
  { id: "short", label: "Short", desc: "Under 18 words" },
  { id: "medium", label: "Medium", desc: "Under 40 words" },
  { id: "long", label: "Long", desc: "40-60 words" },
] as const;
export type LengthId = (typeof LENGTHS)[number]["id"];

export type CaptionIntent = {
  goal?: GoalId;
  tone?: ToneId;
  audience?: AudienceId;
  hook_style?: HookStyleId;
  emotion?: EmotionId;
  length?: LengthId;
  include_cta?: boolean;
  include_emojis?: boolean;
};
