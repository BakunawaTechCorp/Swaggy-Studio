import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swaggy Studio — AI captions for online sellers",
  description:
    "Upload a photo. Get a caption. Post to Facebook. All in under a minute.",
  metadataBase: new URL("https://swaggy.studio"),
  openGraph: {
    title: "Swaggy Studio — AI captions for online sellers",
    description:
      "Upload a photo. Get a caption. Post to Facebook. All in under a minute.",
    url: "https://swaggy.studio",
    siteName: "Swaggy Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swaggy Studio — AI captions for online sellers",
    description:
      "Upload a photo. Get a caption. Post to Facebook. All in under a minute.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0820",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-bg-base font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
