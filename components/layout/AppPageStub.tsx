import Link from "next/link";
import { Rail } from "@/components/layout/Rail";
import { ToastProvider } from "@/components/toast";

type AppPageStubProps = {
  title: string;
  subtitle?: string;
};

export function AppPageStub({ title, subtitle = "This workspace is coming soon." }: AppPageStubProps) {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Rail />
        <main className="canvas">
          <Link href="/home" className="back-link">← Back to home</Link>
          <div className="panel">
            <h1 className="stub-title">{title}</h1>
            <p className="stub-subtitle">{subtitle}</p>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
