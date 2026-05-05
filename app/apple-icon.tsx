import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0820",
          borderRadius: 40,
        }}
      >
        <svg
          width="160"
          height="160"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="star" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f7c948" />
              <stop offset="55%" stopColor="#f059c0" />
              <stop offset="100%" stopColor="#7b2ff7" />
            </linearGradient>
          </defs>
          <path
            d="M100 28 L119 80 L174 82 L130 115 L146 168 L100 138 L54 168 L70 115 L26 82 L81 80 Z"
            fill="url(#star)"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
