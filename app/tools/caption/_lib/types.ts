import type { ReactNode } from "react";

export type PlatformId = "facebook" | "instagram" | "tiktok";
export type PostTypeId = "feed" | "story" | "reel" | "video" | "carousel";

export type View =
  | "dashboard"
  | "prompt"
  | "generating"
  | "variants"
  | "editor"
  | "preview"
  | "success";

export type RefImage = {
  id: string;
  url: string;
  file: File;
};

export type Variant = {
  id: string;
  caption: string;
  hook_type: string;
  tone: string;
  reasoning?: string;
  score?: number;
};

export type FinalPost = {
  imageUrl: string | null;
  caption: string;
  platform: PlatformId;
  postType: PostTypeId;
};

export type PlatformConfig = {
  id: PlatformId;
  label: string;
  color: string;
  icon: ReactNode;
  postTypes: { id: PostTypeId; label: string }[];
};
