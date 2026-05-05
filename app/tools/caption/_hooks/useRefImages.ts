"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_REF_IMAGE_BYTES, MAX_REF_IMAGES } from "../_lib/constants";
import type { RefImage } from "../_lib/types";

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;

export function useRefImages(show: ShowToast) {
  const [refImages, setRefImages] = useState<RefImage[]>([]);

  useEffect(() => {
    return () => {
      setRefImages((current) => {
        current.forEach((r) => URL.revokeObjectURL(r.url));
        return current;
      });
    };
  }, []);

  const addRefImages = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const accepted: RefImage[] = [];
      for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
          show(`"${file.name}" is not an image.`, "error");
          continue;
        }
        if (file.size > MAX_REF_IMAGE_BYTES) {
          show(`"${file.name}" is larger than 10 MB.`, "error");
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: URL.createObjectURL(file),
          file,
        });
      }
      if (!accepted.length) return;
      setRefImages((prev) => {
        const room = MAX_REF_IMAGES - prev.length;
        if (room <= 0) {
          show(`You can attach up to ${MAX_REF_IMAGES} reference images.`, "error");
          accepted.forEach((a) => URL.revokeObjectURL(a.url));
          return prev;
        }
        const taken = accepted.slice(0, room);
        const dropped = accepted.slice(room);
        dropped.forEach((d) => URL.revokeObjectURL(d.url));
        if (dropped.length) {
          show(`Only the first ${MAX_REF_IMAGES} images were attached.`, "info");
        }
        return [...prev, ...taken];
      });
    },
    [show]
  );

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const clearRefImages = useCallback(() => {
    setRefImages((prev) => {
      prev.forEach((r) => URL.revokeObjectURL(r.url));
      return [];
    });
  }, []);

  return { refImages, addRefImages, removeRefImage, clearRefImages };
}
