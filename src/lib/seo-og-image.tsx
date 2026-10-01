import { ImageResponse } from "next/og";

export const SEO_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

type SeoOgImageOptions = {
  eyebrow: string;
  title: string;
  description: string;
};

export function createSeoOgImage({ eyebrow, title, description }: SeoOgImageOptions) {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 72px",
          width: "100%",
        }}
      >
        <div style={{ color: "#00c853", display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1.02 }}>
            {title}
          </div>
          <div style={{ color: "#b8b8b8", display: "flex", fontSize: 24, lineHeight: 1.35, marginTop: "24px", maxWidth: "900px" }}>
            {description}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.24)", color: "#ffffff", display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: "0.16em", paddingTop: "24px" }}>
          OCSCO
        </div>
      </div>
    ),
    SEO_OG_IMAGE_SIZE,
  );
}
