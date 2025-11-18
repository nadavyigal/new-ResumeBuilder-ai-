type Category = "agent_run" | "tool_error" | "storage_warn";

function redactPII(input: string): string {
  let out = input;
  // Emails
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
  // Phones (simple patterns)
  out = out.replace(/\+?\d{1,3}?[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[redacted-phone]");
  // Addresses (very naive): number + street word
  out = out.replace(/\b\d{1,5}\s+([A-Za-z]+\s?){1,4}(Street|St|Avenue|Ave|Road|Rd|Blvd|Lane|Ln|Drive|Dr)\b/gi, "[redacted-address]");
  return out;
}

export function log(category: Category, message: string, meta?: Record<string, any>) {
  const safeMessage = redactPII(String(message || ""));
  const safeMeta = meta ? JSON.parse(redactPII(JSON.stringify(meta))) : undefined;
  const payload = { t: new Date().toISOString(), category, message: safeMessage, ...(safeMeta ? { meta: safeMeta } : {}) };
  console.log(JSON.stringify(payload));
}

