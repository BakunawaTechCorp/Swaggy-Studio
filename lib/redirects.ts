const DEFAULT_AUTH_REDIRECT = "/create";
const INTERNAL_URL_ORIGIN = "https://swaggy.local";

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, INTERNAL_URL_ORIGIN);
    if (url.origin !== INTERNAL_URL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
