import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Swaggy Studio — AI captions for online sellers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0820",
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 80% 10%, rgba(123,47,247,0.45), transparent 60%), radial-gradient(ellipse 60% 40% at 10% 90%, rgba(240,89,192,0.35), transparent 60%)",
          fontFamily: "sans-serif",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="og-star" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f7c948" />
                <stop offset="55%" stopColor="#f059c0" />
                <stop offset="100%" stopColor="#7b2ff7" />
              </linearGradient>
            </defs>
            <path
              d="M100 28 L119 80 L174 82 L130 115 L146 168 L100 138 L54 168 L70 115 L26 82 L81 80 Z"
              fill="url(#og-star)"
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            Swaggy Studio
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 38,
            fontWeight: 500,
            textAlign: "center",
            color: "rgba(255,255,255,0.78)",
            maxWidth: 960,
            lineHeight: 1.3,
          }}
        >
          AI captions for online sellers. Write a post in 30 seconds.
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 56,
            fontSize: 22,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 2,
          }}
        >
          swaggy.studio
        </div>
      </div>
    ),
    { ...size }
  );
}
