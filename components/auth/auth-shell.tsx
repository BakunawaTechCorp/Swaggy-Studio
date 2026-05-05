import type { ReactNode } from "react";
import { SwaggyLogo } from "@/components/logo";

type Props = {
  tagline: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ tagline, children, footer }: Props) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12 xs:px-6">
      <AmbientOrbs />

      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center">
        <div className="flex w-full flex-col items-center gap-6 rounded-none border-0 bg-transparent p-6 xs:rounded-[20px] xs:border xs:border-[#2a1f5e]/70 xs:bg-bg-card xs:p-10">
          <div className="flex w-full justify-center px-1">
            {/* 52px target on xs+; ~44px on narrow screens via scale */}
            <div className="origin-top scale-[0.846] xs:scale-100">
              <SwaggyLogo size={52} priority />
            </div>
          </div>

          <header className="flex flex-col items-center gap-1.5 text-center">
            <p className="font-serif text-[12px] italic leading-tight text-white/50">
              {tagline}
            </p>
          </header>

          {children}
        </div>

        <div className="mt-6 text-center text-[13px] text-white/50">
          {footer}
        </div>
      </div>
    </main>
  );
}

function AmbientOrbs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full"
        style={{
          backgroundColor: "rgba(123, 47, 247, 0.25)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 h-[280px] w-[280px] rounded-full"
        style={{
          backgroundColor: "rgba(240, 89, 192, 0.20)",
          filter: "blur(60px)",
        }}
      />
    </div>
  );
}

