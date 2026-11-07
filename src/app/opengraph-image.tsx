import { ImageResponse } from "next/og";

export const alt = "NOFLIX — thousands of films, series and anime";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card, rendered by the app itself so it can never go stale. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1a0507 0%, #141414 45%, #0b0b0b 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 74, height: 8, background: "#e50914", borderRadius: 4 }} />
          <div style={{ fontSize: 24, letterSpacing: 10, color: "#ffffff99" }}>
            STREAMING FRONT-END
          </div>
        </div>

        <div
          style={{
            marginTop: 34,
            fontSize: 168,
            fontWeight: 800,
            letterSpacing: -6,
            color: "#e50914",
            lineHeight: 1,
          }}
        >
          NOFLIX
        </div>

        <div style={{ marginTop: 26, fontSize: 40, color: "#ffffffd9", maxWidth: 900 }}>
          Thousands of films, series and anime. Profiles, My List and a player that
          switches servers for you.
        </div>

        <div style={{ marginTop: 46, display: "flex", gap: 16, fontSize: 24, color: "#ffffff80" }}>
          <span style={{ border: "1px solid #ffffff33", borderRadius: 999, padding: "10px 22px" }}>
            Next.js 15
          </span>
          <span style={{ border: "1px solid #ffffff33", borderRadius: 999, padding: "10px 22px" }}>
            TMDB catalogue
          </span>
          <span style={{ border: "1px solid #ffffff33", borderRadius: 999, padding: "10px 22px" }}>
            3 stream servers
          </span>
        </div>
      </div>
    ),
    size,
  );
}
