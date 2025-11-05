import { describe, expect, it, jest } from "@jest/globals";

import { detectLanguage } from "@/lib/agent/utils/language";

describe("detectLanguage", () => {
  it("detects Hebrew text with high confidence", async () => {
    const result = await detectLanguage("שלום עולם, אני כותב בעברית מלאה.");
    expect(result.lang).toBe("he");
    expect(result.rtl).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("marks mixed Hebrew and English content", async () => {
    const result = await detectLanguage("שלום לצוות, this resume mixes English עם עברית.");
    expect(result.lang).toBe("mixed");
    expect(result.rtl).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.confidence).toBeLessThanOrEqual(0.65);
  });

  it("propagates rtl flag from model results when requested", async () => {
    const callModel = jest.fn().mockResolvedValue({
      lang: "ar",
      confidence: 0.9,
      rtl: true,
    });
    const result = await detectLanguage("مرحبا بالعالم", {
      callModel,
      preferModel: true,
    });
    expect(callModel).toHaveBeenCalled();
    expect(result.lang).toBe("ar");
    expect(result.rtl).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
