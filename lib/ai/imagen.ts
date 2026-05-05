/**
 * Imagen image generation client.
 *
 * Calls Google's Generative Language API to generate images via Imagen 4.
 * Returns base64-encoded PNGs. Storage is the caller's concern.
 */

export type ImagenModel = "imagen-4-fast" | "imagen-4";

const MODEL_API_NAMES: Record<ImagenModel, string> = {
  "imagen-4-fast": "imagen-4.0-fast-generate-001",
  "imagen-4": "imagen-4.0-generate-001",
};

export type ImagenError =
  | { kind: "missing_api_key" }
  | { kind: "policy_blocked"; reason: string }
  | { kind: "rate_limited" }
  | { kind: "upstream"; status: number; message: string }
  | { kind: "malformed_response" };

export type ImagenResult =
  | { ok: true; pngBase64: string; mimeType: string; latencyMs: number }
  | { ok: false; error: ImagenError; latencyMs: number };

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

// Imagen 4 supports: "1:1", "9:16", "16:9", "3:4", "4:3"
// We map 4:5 → 3:4 (closest portrait) since 4:5 isn't natively supported.
const ASPECT_TO_IMAGEN: Record<AspectRatio, string> = {
  "1:1": "1:1",
  "4:5": "3:4",
  "9:16": "9:16",
  "16:9": "16:9",
};

export async function generateImage(args: {
  model: ImagenModel;
  prompt: string;
  aspectRatio: AspectRatio;
}): Promise<ImagenResult> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { kind: "missing_api_key" }, latencyMs: 0 };
  }

  const modelName = MODEL_API_NAMES[args.model];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

  const requestBody = {
    instances: [{ prompt: args.prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: ASPECT_TO_IMAGEN[args.aspectRatio],
      personGeneration: "allow_adult",
      safetyFilterLevel: "block_only_high",
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        return { ok: false, error: { kind: "rate_limited" }, latencyMs: Date.now() - start };
      }
      if (res.status === 400 && /safety|policy|blocked/i.test(text)) {
        return {
          ok: false,
          error: { kind: "policy_blocked", reason: text.slice(0, 200) },
          latencyMs: Date.now() - start,
        };
      }
      return {
        ok: false,
        error: { kind: "upstream", status: res.status, message: text.slice(0, 200) },
        latencyMs: Date.now() - start,
      };
    }

    const json = (await res.json()) as {
      predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
    };
    const prediction = Array.isArray(json?.predictions) ? json.predictions[0] : null;
    const b64 = prediction?.bytesBase64Encoded;
    const mimeType = prediction?.mimeType ?? "image/png";

    if (typeof b64 !== "string" || b64.length === 0) {
      return {
        ok: false,
        error: { kind: "malformed_response" },
        latencyMs: Date.now() - start,
      };
    }

    return { ok: true, pngBase64: b64, mimeType, latencyMs: Date.now() - start };
  } catch (err) {
    console.error("[imagen]", err);
    return {
      ok: false,
      error: { kind: "upstream", status: 0, message: "network failure" },
      latencyMs: Date.now() - start,
    };
  }
}
