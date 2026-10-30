// Small text + icon logo, no external dependency (inline SVG). Same
// component as TASKS: usable on a light background (public pages) or a
// dark one (`light`, e.g. the sidebar). With `companyName` (dashboard),
// the company takes the main spot and APP_NAME becomes a small subtitle.
import { APP_NAME } from "@/lib/constants";

export default function Logo({ size = "normal", light = false, companyName }: { size?: "normal" | "large"; light?: boolean; companyName?: string }) {
  const isLarge = size === "large";
  const textColor = light ? "#ffffff" : "var(--color-primary)";
  const strokeColor = light ? "#ffffff" : "var(--color-primary)";
  const subtitleColor = light ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-muted)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: isLarge ? 12 : 9, minWidth: 0 }}>
      <svg width={isLarge ? 34 : 26} height={isLarge ? 34 : 26} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="4" y="4" width="24" height="24" rx="7" fill="var(--color-accent)" />
        <rect x="9.5" y="10.5" width="13" height="11" rx="2" stroke={strokeColor} strokeWidth="2.2" />
        <path d="M10 13.5l6 4 6-4" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {companyName ? (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: isLarge ? 20 : 15, color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {companyName}
          </span>
          <span style={{ fontSize: isLarge ? 11 : 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: subtitleColor }}>{APP_NAME}</span>
        </div>
      ) : (
        <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: isLarge ? 26 : 20, letterSpacing: "0.01em", color: textColor, lineHeight: 1 }}>{APP_NAME}</span>
      )}
    </div>
  );
}
