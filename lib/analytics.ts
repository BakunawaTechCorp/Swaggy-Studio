"use client";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function trackClientEvent(
  event: string,
  properties: AnalyticsProperties = {}
) {
  const payload = JSON.stringify({
    event,
    properties,
    at: new Date().toISOString(),
  });

  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (endpoint && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
    return;
  }

  if (endpoint) {
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[analytics]", event, properties);
  }
}
