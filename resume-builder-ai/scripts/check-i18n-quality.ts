import fs from "node:fs";
import path from "node:path";

type JsonObject = Record<string, unknown>;

const ROOT = process.cwd();
const EN_PATH = path.join(ROOT, "src/messages/en.json");
const HE_PATH = path.join(ROOT, "src/messages/he.json");
const EN_OVERRIDE_PATH = path.join(ROOT, "src/messages-overrides/funnel/en.json");
const HE_OVERRIDE_PATH = path.join(ROOT, "src/messages-overrides/funnel/he.json");

const SCOPED_PATHS = [
  "footer",
  "header",
  "newsletter",
  "landing.hero",
  "landing.atsChecker",
  "landing.score",
  "landing.features",
  "landing.howItWorks",
  "landing.uploadForm",
  "landing.rateLimit",
  "landing.issueCard",
  "landing.loadingState",
  "landing.share",
  "auth.form",
  "dashboard.home",
  "dashboard.paywall",
  "contact",
  "blog.index",
  "blog.post.cta",
  "pricingPage",
  "meta.home",
  "meta.pricing",
  "meta.blog",
  "meta.contact",
  "meta.privacy",
  "meta.terms",
  "dashboard.optimization.design.changeDesign"
];

function readJson(filePath: string): JsonObject {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonObject;
}

function merge(base: JsonObject, overrides: JsonObject): JsonObject {
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      result[key] = merge(current as JsonObject, value as JsonObject);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getAtPath(obj: JsonObject, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as JsonObject)[part];
  }, obj);
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectLeafPaths(
  value: unknown,
  basePath = "",
  out: string[] = []
): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLeafPaths(item, `${basePath}[${index}]`, out));
    return out;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      collectLeafPaths(child, nextPath, out);
    }
    return out;
  }

  out.push(basePath);
  return out;
}

function collectLeafValues(
  value: unknown,
  basePath = "",
  out: Array<{ path: string; value: unknown }> = []
): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectLeafValues(item, `${basePath}[${index}]`, out)
    );
    return out;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      collectLeafValues(child, nextPath, out);
    }
    return out;
  }

  out.push({ path: basePath, value });
  return out;
}

function scopedLeaves(messages: JsonObject): string[] {
  const result = new Set<string>();
  for (const scopedPath of SCOPED_PATHS) {
    const scopedValue = getAtPath(messages, scopedPath);
    if (typeof scopedValue === "undefined") {
      result.add(scopedPath);
      continue;
    }

    if (!isPlainObject(scopedValue) && !Array.isArray(scopedValue)) {
      result.add(scopedPath);
      continue;
    }

    collectLeafPaths(scopedValue, scopedPath).forEach((pathValue) => result.add(pathValue));
  }
  return [...result].sort();
}

function scopedStringValues(messages: JsonObject) {
  const result: Array<{ path: string; value: string }> = [];
  for (const scopedPath of SCOPED_PATHS) {
    const scopedValue = getAtPath(messages, scopedPath);
    if (typeof scopedValue === "undefined") continue;
    const leaves = collectLeafValues(scopedValue, scopedPath);
    for (const leaf of leaves) {
      if (typeof leaf.value === "string") {
        result.push({ path: leaf.path, value: leaf.value });
      }
    }
  }
  return result;
}

function hasPlaceholderOrCorruption(value: string) {
  return /\?\?\?/.test(value) || /\uFFFD/.test(value) || /�/.test(value);
}

function main() {
  const enBase = readJson(EN_PATH);
  const heBase = readJson(HE_PATH);
  const enOverride = fs.existsSync(EN_OVERRIDE_PATH) ? readJson(EN_OVERRIDE_PATH) : {};
  const heOverride = fs.existsSync(HE_OVERRIDE_PATH) ? readJson(HE_OVERRIDE_PATH) : {};

  const enMerged = merge(enBase, enOverride);
  const heMerged = merge(merge(enBase, enOverride), merge(heBase, heOverride));

  const enLeaves = scopedLeaves(enMerged);
  const heLeaves = new Set(scopedLeaves(heMerged));

  const missingInHe = enLeaves.filter((leaf) => !heLeaves.has(leaf));
  const invalidStrings = scopedStringValues(heMerged)
    .filter((entry) => hasPlaceholderOrCorruption(entry.value))
    .map((entry) => entry.path);

  const report = {
    checkedAt: new Date().toISOString(),
    scopedPathCount: SCOPED_PATHS.length,
    scopedLeafCount: enLeaves.length,
    missingInHeCount: missingInHe.length,
    invalidStringCount: invalidStrings.length,
    missingInHe: missingInHe.slice(0, 200),
    invalidStringPaths: invalidStrings.slice(0, 200)
  };

  console.log(JSON.stringify(report, null, 2));

  if (missingInHe.length > 0 || invalidStrings.length > 0) {
    process.exit(1);
  }
}

main();
