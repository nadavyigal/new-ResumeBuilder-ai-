/**
 * Whole-point gains for API payloads consumed by the iOS app.
 *
 * `estimateImpact` returns one decimal on purpose (WP-59 S1): real values land
 * between 0.36 and 3.75, and integers would erase them. That precision is
 * correct for the web, which computes and renders its own numbers.
 *
 * It is not safe on the wire. The iOS client decodes
 * `fit.topGaps[].estimatedGain` into `Int?`, and Foundation's `JSONDecoder`
 * does not coerce: a fractional number raises `dataCorrupted` ("Number 2.5 is
 * not representable in Swift") and fails the WHOLE response, not the one
 * field. From 2026-08-28, when WP-59 replaced the old flat-15 integer gain,
 * every optimization on production died in the client with "We couldn't parse
 * the optimization response" while the server-side run had already succeeded
 * and been paid for.
 *
 * The client was fixed to decode leniently (iOS #178), but installed App Store
 * builds cannot be patched, so the wire value stays an integer. Nothing is lost
 * by rounding here: the app decodes this field and never renders it.
 */
export function toWireGain(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}
