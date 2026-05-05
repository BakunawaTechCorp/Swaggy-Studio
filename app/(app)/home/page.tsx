import { HomeDashboard } from "@/components/home/HomeDashboard";
import { Rail } from "@/components/layout/Rail";
import { ToastProvider } from "@/components/toast";

export default function HomePage() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Rail />
        <HomeDashboard />
      </div>
    </ToastProvider>
  );
}
