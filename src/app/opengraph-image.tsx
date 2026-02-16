import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Resumely – ATS Resume Checker & Optimization";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #151c2c 0%, #1a2640 40%, #1e3045 70%, #162535 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative gradient orbs */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            right: "-60px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,185,140,0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            left: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,185,140,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Subtle grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            display: "flex",
          }}
        />

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "60px 70px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Left column - Text content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth: "620px",
              gap: "20px",
            }}
          >
            {/* Logo / Brand */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #2db98c 0%, #22a07a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(45,185,140,0.4)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                  <line x1="9" y1="11" x2="15" y2="11" />
                </svg>
              </div>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.5px",
                }}
              >
                Resumely
              </span>
            </div>

            {/* Headline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "48px",
                  fontWeight: 800,
                  color: "white",
                  lineHeight: 1.1,
                  letterSpacing: "-1px",
                }}
              >
                Check Your Resume
              </span>
              <span
                style={{
                  fontSize: "48px",
                  fontWeight: 800,
                  color: "#2db98c",
                  lineHeight: 1.1,
                  letterSpacing: "-1px",
                }}
              >
                Before ATS Does
              </span>
            </div>

            {/* Subheading */}
            <span
              style={{
                fontSize: "20px",
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.5,
                maxWidth: "480px",
              }}
            >
              Free ATS score, actionable fixes, and AI-powered optimization to land more interviews.
            </span>

            {/* CTA badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: "8px",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #2db98c 0%, #22a07a 100%)",
                  color: "white",
                  padding: "12px 28px",
                  borderRadius: "10px",
                  fontSize: "18px",
                  fontWeight: 700,
                  boxShadow: "0 4px 16px rgba(45,185,140,0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Run Free ATS Check
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
              <span
                style={{
                  fontSize: "15px",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                resumelybuilderai.com
              </span>
            </div>
          </div>

          {/* Right column - Visual element (score card mockup) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "380px",
              flexShrink: 0,
            }}
          >
            {/* Score card */}
            <div
              style={{
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(20px)",
                borderRadius: "24px",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "36px 40px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                width: "320px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}
              >
                ATS Score
              </span>

              {/* Circular score */}
              <div
                style={{
                  position: "relative",
                  width: "160px",
                  height: "160px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Score ring background */}
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 160 160"
                  style={{ position: "absolute" }}
                >
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    fill="none"
                    stroke="#2db98c"
                    strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 68 * 0.87} ${2 * Math.PI * 68 * 0.13}`}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                    style={{
                      filter: "drop-shadow(0 0 8px rgba(45,185,140,0.5))",
                    }}
                  />
                </svg>
                <span
                  style={{
                    fontSize: "56px",
                    fontWeight: 800,
                    color: "#2db98c",
                    letterSpacing: "-2px",
                  }}
                >
                  87
                </span>
              </div>

              {/* Score items */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  width: "100%",
                }}
              >
                {[
                  { label: "Keywords Match", color: "#2db98c" },
                  { label: "Format & Structure", color: "#2db98c" },
                  { label: "Impact Bullets", color: "#e5a819" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: item.color,
                        flexShrink: 0,
                        display: "flex",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "14px",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
