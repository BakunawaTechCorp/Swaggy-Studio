import Link from "next/link";
import { Rail } from "@/components/layout/Rail";
import { ToastProvider } from "@/components/toast";
import { CampaignTool } from "./CampaignTool";

export default function Page() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Rail />
        <main className="canvas">
          <Link href="/home" className="back-link">← Back to home</Link>
          <CampaignTool />
        </main>
      </div>
    </ToastProvider>
  );
}
