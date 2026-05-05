import Link from "next/link";
import { SwaggyLogo } from "@/components/logo";

export default function LandingPage() {
  return (
    <main className="swaggy-bg relative flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-8">
        <div className="flex w-full max-w-lg justify-center">
          <SwaggyLogo size={148} priority className="drop-shadow-[0_12px_40px_rgba(123,47,247,0.25)]" />
        </div>

        <p className="max-w-md text-base text-white/70 sm:text-lg">
          Your social media manager, in one tab. Five tools. One credit balance.
        </p>

        <Link
          href="/login"
          className="group relative inline-flex items-center justify-center rounded-full bg-brand-gradient px-8 py-3 text-base font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.99]"
        >
          Get started
          <span
            aria-hidden
            className="ml-2 transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>

      <footer className="absolute bottom-6 text-xs text-white/40">
        swaggy.studio
      </footer>
    </main>
  );
}
