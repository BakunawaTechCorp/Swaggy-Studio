import { PLATFORMS } from "./constants";
import type { PlatformId } from "./types";

export function labelForPlatform(id: PlatformId) {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

export function truncate(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export function sanitizeName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function safeErr(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; detail?: unknown };
    if (data?.error) return String(data.error);
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

// Returns a `YYYY-MM-DDTHH:mm` string in the browser's local timezone,
// defaulting to 7:00 PM today (or tomorrow if it's already past 7 PM).
export function defaultScheduleLocal(): string {
  const now = new Date();
  let target = new Date(now);
  if (now.getHours() >= 19) {
    target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  target.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

// Converts a `YYYY-MM-DDTHH:mm` value from a datetime-local input
// (interpreted as the browser's local timezone) to an ISO string.
export function localToIso(local: string): string | null {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(+y, +mo - 1, +d, +h, +mi);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
