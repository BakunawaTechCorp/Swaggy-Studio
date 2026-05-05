import Image from "next/image";

const LOGO_SRC = "/brand/swaggy-studio-logo.png";

type LogoProps = {
  /** Visual height in px; width follows the asset aspect ratio */
  size?: number;
  className?: string;
  /** Kept for API compatibility; orbit is part of the official artwork */
  withOrbit?: boolean;
  priority?: boolean;
};

/**
 * Official Swaggy Studio lockup (transparent PNG): mascot + wordmark.
 */
export function SwaggyLogo({
  size = 96,
  className,
  priority = false,
}: LogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Swaggy Studio"
      width={1024}
      height={1024}
      priority={priority}
      sizes="(max-width: 480px) 85vw, 360px"
      className={`w-auto max-w-full object-contain object-left ${className ?? ""}`}
      style={{ height: size, width: "auto" }}
    />
  );
}

type WordmarkProps = {
  className?: string;
  /** Height of the lockup in px */
  height?: number;
};

export function SwaggyWordmark({ className, height = 44 }: WordmarkProps) {
  return (
    <div className={`flex items-center ${className ?? ""}`}>
      <SwaggyLogo size={height} priority />
    </div>
  );
}
