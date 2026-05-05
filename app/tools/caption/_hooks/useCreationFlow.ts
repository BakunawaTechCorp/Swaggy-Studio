"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { trackClientEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_MODEL, type ActiveModelId } from "@/lib/credits/costs";
import { cachedFetchJson } from "@/lib/client-cache";
import type { IntentState } from "../_components/IntentFields";
import { PLATFORMS } from "../_lib/constants";
import type { FinalPost, PlatformId, PostTypeId, Variant, View } from "../_lib/types";
import { labelForPlatform, safeErr } from "../_lib/utils";
import { useCaptionGen } from "./useCaptionGen";
import { useRefImages } from "./useRefImages";

export function useCreationFlow({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { show } = useToast();

  const [view, setView] = useState<View>("dashboard");
  const [platform, setPlatform] = useState<PlatformId>("facebook");
  const [postType, setPostType] = useState<PostTypeId>("feed");
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [finalPost, setFinalPost] = useState<FinalPost | null>(null);
  const [postedUrl, setPostedUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingAt, setSchedulingAt] = useState<string | null>(null);
  const [model, setModel] = useState<ActiveModelId>(DEFAULT_MODEL);
  const [intent, setIntent] = useState<IntentState>({
    goal: "engagement",
    tone: "friendly",
  });
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [bestPick, setBestPick] = useState<{ id: string; reason?: string } | null>(null);
  const variantCount: 1 | 2 | 3 | 4 = 4;

  useEffect(() => {
    cachedFetchJson<{ unlimited?: boolean; balance?: number }>(
      "/api/credits/balance"
    )
      .then((j) => {
        setCreditBalance(j.unlimited ? null : j.balance ?? 0);
      })
      .catch(() => undefined);
  }, []);

  const { refImages, addRefImages, removeRefImage, clearRefImages } =
    useRefImages(show);

  useEffect(() => {
    const valid = PLATFORMS.find((p) => p.id === platform)!.postTypes.map((t) => t.id);
    if (!valid.includes(postType)) {
      setPostType(valid[0]);
    }
  }, [platform, postType]);

  const { generating, generateVariants } = useCaptionGen({
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
  });

  const startCreate = useCallback(() => {
    setView("prompt");
  }, []);

  const resetFlow = useCallback(() => {
    clearRefImages();
    setPrompt("");
    setVariants([]);
    setSelectedVariantId(null);
    setCaption("");
    setFinalPost(null);
    setPostedUrl(null);
    setView("dashboard");
  }, [clearRefImages]);

  const startGenerating = useCallback(() => {
    if (!prompt.trim()) {
      show("Tell Joestar what the post is about first.", "error");
      return;
    }
    void generateVariants();
  }, [prompt, show, generateVariants]);

  const chooseVariant = useCallback(
    (id: string) => {
      const v = variants.find((x) => x.id === id);
      if (!v) return;
      setSelectedVariantId(id);
      setCaption(v.caption);
      trackClientEvent("variant_selected", { variant_id: id });
      setView("editor");
    },
    [variants]
  );

  const backToPrompt = useCallback(() => setView("prompt"), []);

  const regenerateVariants = useCallback(() => {
    void generateVariants();
  }, [generateVariants]);

  const goToPreview = useCallback(() => {
    if (!caption.trim()) {
      show("Caption is empty — pick or type one first.", "error");
      return;
    }
    const finalCaption = caption.trim();
    setFinalPost({
      imageUrl: refImageUrl,
      caption: finalCaption,
      platform,
      postType,
    });
    setView("preview");

    // Save to library, fire-and-forget. Don't block UX on failure.
    const variant = variants.find((v) => v.id === selectedVariantId);
    void fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "caption",
        title: finalCaption.slice(0, 80),
        payload: {
          caption: finalCaption,
          hook_type: variant?.hook_type,
          tone: variant?.tone,
          reasoning: variant?.reasoning,
          score: variant?.score,
          platform,
          post_type: postType,
        },
        thumbnail_url: refImageUrl,
        metadata: { model, intent },
      }),
    })
      .then((r) => {
        if (r.ok) show("Saved to Library.", "success");
      })
      .catch(() => undefined);
  }, [
    caption,
    refImageUrl,
    platform,
    postType,
    show,
    variants,
    selectedVariantId,
    model,
    intent,
  ]);

  const postNow = useCallback(async () => {
    if (!finalPost) return;
    if (platform !== "facebook") {
      show(
        `${labelForPlatform(platform)} posting is coming soon. Facebook-only for now.`,
        "info"
      );
      return;
    }
    if (!finalPost.imageUrl) {
      show("Attach a reference photo first — we need an image to post.", "error");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/post-facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_url: finalPost.imageUrl,
          caption: finalPost.caption,
        }),
      });
      if (!res.ok) {
        if (res.status === 428) {
          show("Connect your Facebook Page first.", "error");
        } else {
          const detail = await safeErr(res);
          show(`Couldn't post. ${detail}`, "error");
          trackClientEvent("post_publish_failed", {
            platform,
            post_type: postType,
            error: detail,
          });
        }
        return;
      }
      const data = (await res.json()) as { fb_post_id?: string | null };
      if (data.fb_post_id) {
        const [pageId, postId] = data.fb_post_id.split("_");
        if (pageId && postId) {
          setPostedUrl(`https://www.facebook.com/${pageId}/posts/${postId}`);
        }
      }
      trackClientEvent("post_published", {
        platform,
        post_type: postType,
        has_post_id: !!data.fb_post_id,
      });
      setView("success");
    } catch (err) {
      console.error("[postNow]", err);
      show("Network error — try again in a moment.", "error");
      trackClientEvent("post_publish_failed", {
        platform,
        post_type: postType,
        error: "network_error",
      });
    } finally {
      setPosting(false);
    }
  }, [finalPost, platform, postType, show]);

  const copyCaption = useCallback(async () => {
    if (!finalPost) return;
    try {
      await navigator.clipboard.writeText(finalPost.caption);
      show("Caption copied.", "success");
    } catch {
      show("Copy failed — select and copy manually.", "error");
    }
  }, [finalPost, show]);

  const downloadImage = useCallback(async () => {
    if (!finalPost?.imageUrl) {
      show("No reference image to download.", "info");
      return;
    }
    try {
      const res = await fetch(finalPost.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `swaggy-${platform}-${postType}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      show("Image saved.", "success");
    } catch {
      show("Download failed.", "error");
    }
  }, [finalPost, platform, postType, show]);

  const schedulePost = useCallback(
    async (whenIso: string) => {
      if (!finalPost) return;
      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        photo_url: finalPost.imageUrl ?? "",
        caption: finalPost.caption,
        status: "scheduled",
        platform,
        post_type: postType,
        scheduled_at: whenIso,
      });
      if (error) {
        show(`Couldn't schedule: ${error.message}`, "error");
        trackClientEvent("post_schedule_failed", {
          platform,
          post_type: postType,
          error: error.message,
        });
        return;
      }
      setSchedulingAt(whenIso);
      setScheduleOpen(false);
      trackClientEvent("post_scheduled", {
        platform,
        post_type: postType,
      });
      show("Scheduled.", "success");
    },
    [finalPost, supabase, userId, platform, postType, show]
  );

  return {
    view,
    setView,
    platform,
    setPlatform,
    postType,
    setPostType,
    prompt,
    setPrompt,
    refImages,
    addRefImages,
    removeRefImage,
    variants,
    selectedVariantId,
    caption,
    setCaption,
    generatingCaption: generating,
    finalPost,
    postedUrl,
    posting,
    scheduleOpen,
    setScheduleOpen,
    schedulingAt,
    startCreate,
    resetFlow,
    startGenerating,
    chooseVariant,
    backToPrompt,
    regenerateVariants,
    goToPreview,
    postNow,
    copyCaption,
    downloadImage,
    schedulePost,
    model,
    setModel,
    variantCount,
    intent,
    setIntent,
    creditBalance,
    bestPick,
  };
}
