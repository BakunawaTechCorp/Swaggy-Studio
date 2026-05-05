"use client";

import { useRouter } from "next/navigation";
import { MobileGate } from "./_components/Chrome";
import { PromptStep } from "./_components/PromptStep";
import { GeneratingStep } from "./_components/GeneratingStep";
import { VariantsStep } from "./_components/VariantsStep";
import { EditorStep } from "./_components/EditorStep";
import { PreviewStep } from "./_components/PreviewStep";
import { SuccessStep } from "./_components/SuccessStep";
import { ScheduleModal } from "./_components/ScheduleModal";
import { useCreationFlow } from "./_hooks/useCreationFlow";

export function CaptionTool({ userId }: { userId: string }) {
  const flow = useCreationFlow({ userId });
  const router = useRouter();

  return (
    <>
      <MobileGate />
      <div className="mx-auto hidden w-full max-w-6xl md:block">
        {(flow.view === "dashboard" || flow.view === "prompt") && (
          <PromptStep
            prompt={flow.prompt}
            setPrompt={flow.setPrompt}
            platform={flow.platform}
            setPlatform={flow.setPlatform}
            postType={flow.postType}
            setPostType={flow.setPostType}
            refImages={flow.refImages}
            onAddImages={flow.addRefImages}
            onRemoveImage={flow.removeRefImage}
            onBack={() => router.push("/home")}
            onGenerate={flow.startGenerating}
            model={flow.model}
            setModel={flow.setModel}
            variantCount={flow.variantCount}
            intent={flow.intent}
            setIntent={flow.setIntent}
            creditBalance={flow.creditBalance}
          />
        )}

        {flow.view === "generating" && <GeneratingStep prompt={flow.prompt} />}

        {flow.view === "variants" && (
          <VariantsStep
            variants={flow.variants}
            onPick={flow.chooseVariant}
            onBack={flow.backToPrompt}
            onRegenerate={flow.regenerateVariants}
            bestPick={flow.bestPick}
            goal={flow.intent.goal}
          />
        )}

        {flow.view === "editor" && (
          <EditorStep
            variant={flow.variants.find((v) => v.id === flow.selectedVariantId) ?? null}
            caption={flow.caption}
            setCaption={flow.setCaption}
            onBack={() => flow.setView("variants")}
            onHappy={flow.goToPreview}
            generating={flow.generatingCaption}
          />
        )}

        {flow.view === "preview" && flow.finalPost && (
          <PreviewStep
            finalPost={flow.finalPost}
            onBack={() => flow.setView("editor")}
            onPost={flow.postNow}
            onSchedule={() => flow.setScheduleOpen(true)}
            onDownload={flow.downloadImage}
            onCopy={flow.copyCaption}
            posting={flow.posting}
            schedulingAt={flow.schedulingAt}
          />
        )}

        {flow.view === "success" && flow.finalPost && (
          <SuccessStep
            platform={flow.finalPost.platform}
            postedUrl={flow.postedUrl}
            onAnother={flow.resetFlow}
          />
        )}
      </div>

      {flow.scheduleOpen && (
        <ScheduleModal
          onClose={() => flow.setScheduleOpen(false)}
          onConfirm={flow.schedulePost}
        />
      )}
    </>
  );
}
