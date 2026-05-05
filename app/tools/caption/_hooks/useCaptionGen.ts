"use client";

import { useCallback, useState } from "react";
import { trackClientEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { ActiveModelId } from "@/lib/credits/costs";
import type { IntentState } from "../_components/IntentFields";
import type { PlatformId, PostTypeId, RefImage, Variant, View } from "../_lib/types";
import { sanitizeName } from "../_lib/utils";

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;
type SupabaseClient = ReturnType<typeof createClient>;

type UseCaptionGenArgs = {
  userId: string;
  supabase: SupabaseClient;
  show: ShowToast;
  refImages: RefImage[];
  prompt: string;
  platform: PlatformId;
  postType: PostTypeId;
  model: ActiveModelId;
  variantCount: 1 | 2 | 3 | 4;
  intent: IntentState;
  setCreditBalance: (n: number | null | ((prev: number | null) => number | null)) => void;
  setVariants: (vs: Variant[]) => void;
  setRefImageUrl: (url: string | null) => void;
  setView: (view: View) => void;
  setBestPick: (pick: { id: string; reason?: string } | null) => void;
};

function errorMessage(code?: string): string {
  switch (code) {
    case "insufficient_credits":
      return "Out of credits — top up to keep generating.";
    case "ai_unavailable":
      return "Couldn't reach the AI right now. Try again in a moment.";
    case "service_unavailable":
      return "Service temporarily unavailable. Try again in a moment.";
    case "unauthorized":
      return "Please sign in again.";
    case "invalid_model":
    case "invalid_language":
    case "invalid_photo_url":
      return "Something in the request looks off. Refresh and try again.";
    case "malformed_response":
      return "AI returned an unexpected response. Try regenerating.";
    default:
      return "Generation failed. Try again.";
  }
}

export function useCaptionGen({
  userId,
  supabase,
  show,
  refImages,
  prompt,
  platform,
  postType,
  model,
  variantCount,
  intent,
  setCreditBalance,
  setVariants,
  setRefImageUrl,
  setView,
  setBestPick,
}: UseCaptionGenArgs) {
  const [generating, setGenerating] = useState(false);

  const generateVariants = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setView("generating");

    let publicUrl: string | null = null;
    if (refImages[0]) {
      try {
        const file = refImages[0].file;
        const path = `${userId}/${Date.now()}-ref-${sanitizeName(file.name)}`;
        const { error } = await supabase.storage
          .from("post-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (!error) {
          publicUrl = supabase.storage.from("post-photos").getPublicUrl(path).data
            .publicUrl;
        }
      } catch {
        /* photo upload failed — proceed without photo */
      }
    }
    setRefImageUrl(publicUrl);

    let res: Response;
    try {
      res = await fetch("/api/tools/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          photo_url: publicUrl ?? undefined,
          language: "english",
          model,
          variant_count: variantCount,
          platform,
          post_type: postType,
          ...intent,
        }),
      });
    } catch {
      show("Network error — couldn't reach the server.", "error");
      setView("prompt");
      setGenerating(false);
      return;
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      show(errorMessage(err.error), "error");
      trackClientEvent("caption_generation_failed", {
        platform,
        post_type: postType,
        status: res.status,
        error: err.error ?? "unknown",
      });
      setView("prompt");
      setGenerating(false);
      return;
    }

    const data = (await res.json()) as {
      variants?: {
        caption?: string;
        hook_type?: string;
        tone?: string;
        reasoning?: string;
        score?: number;
      }[];
      best_index?: number;
      best_reason?: string;
    };
    const variants: Variant[] = (data.variants ?? [])
      .filter((v) => v.caption && v.caption.trim().length > 0)
      .map((v, i) => ({
        id: `var-${Date.now()}-${i}`,
        caption: v.caption!.trim(),
        hook_type: v.hook_type ?? "",
        tone: v.tone ?? "",
        reasoning: v.reasoning,
        score: typeof v.score === "number" ? v.score : undefined,
      }));

    if (variants.length === 0) {
      show("AI returned no usable variants. Try regenerating.", "error");
      setView("prompt");
      setGenerating(false);
      return;
    }

    const balanceHeader = res.headers.get("X-Credits-Balance");
    if (balanceHeader) {
      const next = Number(balanceHeader);
      if (Number.isFinite(next) && next >= 0) setCreditBalance(next);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("credits:changed"));
    }

    setVariants(variants);
    if (
      typeof data.best_index === "number" &&
      data.best_index >= 0 &&
      data.best_index < variants.length
    ) {
      setBestPick({
        id: variants[data.best_index].id,
        reason: data.best_reason,
      });
    } else {
      setBestPick(null);
    }
    trackClientEvent("caption_generated", {
      platform,
      post_type: postType,
      used_reference_image: !!publicUrl,
      variant_count: variants.length,
      model,
    });
    setView("variants");
    setGenerating(false);
  }, [
    generating,
    refImages,
    userId,
    supabase,
    prompt,
    platform,
    postType,
    model,
    variantCount,
    intent,
    setCreditBalance,
    setRefImageUrl,
    setVariants,
    setView,
    setBestPick,
    show,
  ]);

  return { generating, generateVariants };
}
