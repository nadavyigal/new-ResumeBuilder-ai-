import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            position: "relative",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Accent bar at top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: "linear-gradient(90deg, #22c55e, #2db98c, #0ea5e9)",
              display: "flex",
            }}
          />

          {/* Main content */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
              padding: "50px 60px",
            }}
          >
            {/* Left: Text */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                maxWidth: "640px",
              }}
            >
              {/* Brand */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "28px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    background: "#22c55e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "14px",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
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
                    fontSize: "26px",
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  Resumely
                </span>
              </div>

              {/* Title */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: "52px",
                    fontWeight: 800,
                    color: "white",
                    lineHeight: 1.15,
                    letterSpacing: "-1px",
                  }}
                >
                  Check Your Resume
                </span>
                <span
                  style={{
                    fontSize: "52px",
                    fontWeight: 800,
                    color: "#22c55e",
                    lineHeight: 1.15,
                    letterSpacing: "-1px",
                  }}
                >
                  Before ATS Does
                </span>
              </div>

              {/* Subtitle */}
              <span
                style={{
                  fontSize: "20px",
                  color: "#94a3b8",
                  lineHeight: 1.5,
                  marginTop: "20px",
                  maxWidth: "460px",
                }}
              >
                Free ATS score, actionable fixes, and AI-powered optimization to land more interviews.
              </span>

              {/* CTA */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: "28px",
                }}
              >
                <div
                  style={{
                    background: "#22c55e",
                    color: "white",
                    padding: "14px 30px",
                    borderRadius: "10px",
                    fontSize: "18px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Run Free ATS Check
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: "10px" }}
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: "15px",
                    color: "#64748b",
                    marginLeft: "18px",
                  }}
                >
                  resumelybuilderai.com
                </span>
              </div>
            </div>

            {/* Right: Score card */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "340px",
              }}
            >
              <div
                style={{
                  background: "#1e293b",
                  borderRadius: "24px",
                  border: "1px solid #334155",
                  padding: "32px 36px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "300px",
                  boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                }}
              >
                {/* Label */}
                <span
                  style={{
                    fontSize: "14px",
                    color: "#64748b",
                    fontWeight: 600,
                    letterSpacing: "2px",
                    marginBottom: "18px",
                  }}
                >
                  ATS SCORE
                </span>

                {/* Score ring */}
                <div
                  style={{
                    width: "150px",
                    height: "150px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle
                      cx="75"
                      cy="75"
                      r="62"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="10"
                    />
                    <circle
                      cx="75"
                      cy="75"
                      r="62"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 62 * 0.87} ${2 * Math.PI * 62 * 0.13}`}
                      strokeLinecap="round"
                      transform="rotate(-90 75 75)"
                    />
                  </svg>
                  <span
                    style={{
                      position: "absolute",
                      fontSize: "52px",
                      fontWeight: 800,
                      color: "#22c55e",
                      letterSpacing: "-2px",
                    }}
                  >
                    87
                  </span>
                </div>

                {/* Metrics */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    marginTop: "20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#22c55e",
                        marginRight: "10px",
                        display: "flex",
                      }}
                    />
                    <span style={{ fontSize: "14px", color: "#94a3b8" }}>
                      Keywords Match
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#22c55e",
                        marginRight: "10px",
                        display: "flex",
                      }}
                    />
                    <span style={{ fontSize: "14px", color: "#94a3b8" }}>
                      Format & Structure
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#eab308",
                        marginRight: "10px",
                        display: "flex",
                      }}
                    />
                    <span style={{ fontSize: "14px", color: "#94a3b8" }}>
                      Impact Bullets
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response("Failed to generate image", { status: 500 });
  }
}
