import { ImageResponse } from "next/og";

export const alt = "OCSCO — Strategy, design, and technology";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#00c853",
            height: "8px",
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
        <div
          style={{
            color: "#ffffff",
            display: "flex",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "0.18em",
          }}
        >
          OCSCO
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "920px",
          }}
        >
          <div
            style={{
              color: "#00c853",
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.16em",
              marginBottom: "28px",
              textTransform: "uppercase",
            }}
          >
            Strategy / Design / Technology
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.06em",
              lineHeight: 1,
            }}
          >
            Digital infrastructure for brands ready to move with precision.
          </div>
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.24)",
            color: "#a6a6a6",
            display: "flex",
            fontSize: 22,
            paddingTop: "24px",
          }}
        >
          Strategy, design, and technology for brands ready to move with precision.
        </div>
        <div
          style={{
            background: "rgba(0, 200, 83, 0.14)",
            borderRadius: "999px",
            bottom: "74px",
            height: "520px",
            position: "absolute",
            right: "-180px",
            transform: "rotate(18deg)",
            width: "390px",
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}
