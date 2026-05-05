import type { PlatformConfig } from "./types";

type Placeholder = { from: string; to: string; icon: string };

export const PLATFORMS: PlatformConfig[] = [
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877f2",
    icon: <span className="font-bold italic text-white">f</span>,
    postTypes: [
      { id: "feed", label: "Feed post" },
      { id: "story", label: "Story" },
      { id: "reel", label: "Reel" },
      { id: "video", label: "Video" },
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "#e1306c",
    icon: <span>📸</span>,
    postTypes: [
      { id: "feed", label: "Feed post" },
      { id: "story", label: "Story" },
      { id: "reel", label: "Reel" },
      { id: "carousel", label: "Carousel" },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#000000",
    icon: <span>🎵</span>,
    postTypes: [
      { id: "video", label: "Video" },
      { id: "story", label: "Story" },
      { id: "carousel", label: "Photo carousel" },
    ],
  },
];

export const VARIANT_PLACEHOLDERS: Placeholder[] = [
  { from: "#7b2ff7", to: "#f059c0", icon: "✦" },
  { from: "#f7c948", to: "#f059c0", icon: "◈" },
  { from: "#67e8f9", to: "#7b2ff7", icon: "◆" },
  { from: "#34d399", to: "#67e8f9", icon: "✶" },
];

export const MAX_REF_IMAGES = 10;
export const MAX_REF_IMAGE_BYTES = 10 * 1024 * 1024;
