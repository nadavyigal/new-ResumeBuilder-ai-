export function formatDistance(target: Date | string, base: Date = new Date()): string {
  const targetDate = typeof target === "string" ? new Date(target) : target;
  const diffMs = targetDate.getTime() - base.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "soon";
  }

  const minutes = Math.ceil(diffMs / (60 * 1000));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
