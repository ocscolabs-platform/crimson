import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DEFAULT_OG_IMAGE_PATH, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-assets";
import { getSiteOrigin } from "@/lib/site-origin";
import { designSettingsToCssVariables } from "@/lib/design-settings";
import { getPublishedDesignSettings } from "@/lib/cms-content";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: {
    default: "OCSCO — Strategy, design, and technology",
    template: "%s — OCSCO",
  },
  description: "Strategy, design, and technology for brands ready to move with precision.",
  applicationName: "OCSCO",
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
  openGraph: {
    title: "OCSCO — Strategy, design, and technology",
    description: "Strategy, design, and technology for brands ready to move with precision.",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: "OCSCO — Strategy, design, and technology",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OCSCO — Strategy, design, and technology",
    description: "Strategy, design, and technology for brands ready to move with precision.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const designSettings = await getPublishedDesignSettings();

  return (
    <html lang="en" style={designSettingsToCssVariables(designSettings) as CSSProperties}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
