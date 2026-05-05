import { Rail } from "@/components/layout/Rail";
import { ToastProvider } from "@/components/toast";

/**
 * Shared shell layout for the in-app pages (Create, Library, Press,
 * Connections). Auth is enforced at the edge by `middleware.ts` — there's no
 * need to repeat `supabase.auth.getUser()` here, which would block every
 * navigation on a Supabase round-trip. The toast provider and rail are
 * mounted ONCE so client-side navigation between siblings only swaps the
 * canvas (no re-fetch of profile/connections, no Rail remount).
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Rail />
        {children}
      </div>
    </ToastProvider>
  );
}
