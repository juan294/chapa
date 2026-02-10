import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Dynamic icon.png generation using Next.js ImageResponse.
 * Renders the Chapa shield + chevron icon at 32x32.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="none"
          width="32"
          height="32"
        >
          <path
            d="M16 1 L29 6 L29 15 C29 23 23 29 16 31 C9 29 3 23 3 15 L3 6 Z"
            fill="#12100D"
            stroke="#E2A84B"
            strokeWidth="1.5"
          />
          <path
            d="M10 20 L16 12 L22 20"
            stroke="#E2A84B"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
