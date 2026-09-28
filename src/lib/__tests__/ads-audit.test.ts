import { describe, it, expect } from "vitest";
import { auditAd } from "@/lib/ads/audit";

const base = { status: "active", spend: 100, impressions: 10_000, ctr: 0.012, frequency: 1.5, results: 10 };

describe("ad audit", () => {
  it("skips paused items with no spend", () => {
    const a = auditAd({ ...base, status: "paused", spend: 0, impressions: 0, results: 0 }, 10);
    expect(a.score).toBeNull();
    expect(a.label).toBe("Not running");
  });

  it("flags spend with no results as a problem", () => {
    const a = auditAd({ ...base, results: 0 }, 10);
    expect(a.label).toBe("Problem");
    expect(a.findings[0].severity).toBe("critical");
  });

  it("explains expensive results, low CTR and fatigue", () => {
    const a = auditAd({ ...base, results: 4, ctr: 0.005, frequency: 4 }, 10);
    expect(a.findings.map((f) => f.severity)).toEqual(["warning", "warning", "warning"]);
    expect(a.score).toBe(35);
  });

  it("rewards cheap results", () => {
    const a = auditAd({ ...base, results: 20, ctr: 0.025 }, 10);
    expect(a.label).toBe("Healthy");
    expect(a.score).toBe(96);
  });
});
