import type { ThemeOptions } from "../types";
import "../validators"; // ensure validators loaded in tool context
import { RTL_LANGUAGE_CODES } from "../utils/language";

function isHexColor(input?: string): boolean {
  return !!input && /^#?[0-9A-Fa-f]{6}$/.test(input);
}

function normalizeHex(input?: string): string | undefined {
  if (!input) return undefined;
  const v = input.startsWith("#") ? input : `#${input}`;
  return isHexColor(v) ? v.toUpperCase() : undefined;
}

function resolveDirection(opts: ThemeOptions): "ltr" | "rtl" {
  if (opts.direction === "rtl") return "rtl";
  if (opts.direction === "ltr") return "ltr";
  if (opts.language && RTL_LANGUAGE_CODES.has(opts.language.toLowerCase())) {
    return "rtl";
  }
  if (typeof opts.rtl === "boolean") {
    return opts.rtl ? "rtl" : "ltr";
  }
  return "ltr";
}

export const DesignOps = {
  theme(opts: ThemeOptions) {
    const font = opts.font_family && opts.font_family.trim().length > 0 ? opts.font_family : "Inter";
    const color = normalizeHex(opts.color_hex) ?? "#0EA5E9";
    const spacing = opts.spacing ?? "normal";
    const density = opts.density ?? "cozy";
    const layout = opts.layout ?? "ats-safe";
    const direction = resolveDirection(opts);
    return { font_family: font, color_hex: color, spacing, density, layout, direction };
  },
};
