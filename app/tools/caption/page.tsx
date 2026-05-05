import { Rail } from "@/components/layout/Rail";
import { ToastProvider } from "@/components/toast";
import { CaptionTool } from "./CaptionTool";

const DEV_DEMO_USER_ID = "00000000-0000-4000-8000-000000000000";

export default async function CaptionToolPage() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Rail />
        <main className="canvas">
          <CaptionTool userId={DEV_DEMO_USER_ID} />
        </main>
      </div>
    </ToastProvider>
  );
}
