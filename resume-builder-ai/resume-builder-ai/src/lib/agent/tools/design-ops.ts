import type { ThemeOptions } from "../types";
import "../validators"; // ensure validators loaded in tool context

function isHexColor(input?: string): boolean {
  return !!input && /^#?[0-9A-Fa-f]{6}$/.test(input);
}

function normalizeHex(input?: string): string | undefined {
  if (!input) return undefined;
  const v = input.startsWith("#") ? input : `#${input}`;
  return isHexColor(v) ? v.toUpperCase() : undefined;
}

export const DesignOps = {
  theme(opts: ThemeOptions) {
    const font = opts.font_family && opts.font_family.trim().length > 0 ? opts.font_family : "Inter";
    const color = normalizeHex(opts.color_hex) ?? "#0EA5E9";
    const spacing = opts.spacing ?? "normal";
    const density = opts.density ?? "cozy";
    const layout = opts.layout ?? "ats-safe";
    return { font_family: font, color_hex: color, spacing, density, layout };
  },
};
