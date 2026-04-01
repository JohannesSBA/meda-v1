import { describe, expect, it } from "vitest";
import { computeHostTrustScore, mapScoreToTrustBadge } from "@/services/trustScore";

describe("trustScore", () => {
  it("weights the trust score inputs for v1", () => {
    const score = computeHostTrustScore({
      avgRating: 4.5,
      attendanceRate: 0.9,
      cancellationRate: 0.1,
      refundRate: 0.05,
      repeatPlayerRate: 0.4,
    });

    expect(score).toBeCloseTo(85.5, 1);
  });

  it("maps low-volume hosts to NEW_HOST", () => {
    expect(mapScoreToTrustBadge({ reviewCount: 2, trustScore: 98 })).toBe("NEW_HOST");
  });

  it("maps stable hosts to graded badges", () => {
    expect(mapScoreToTrustBadge({ reviewCount: 10, trustScore: 90 })).toBe("HIGHLY_RATED");
    expect(mapScoreToTrustBadge({ reviewCount: 10, trustScore: 72 })).toBe("RELIABLE_HOST");
    expect(mapScoreToTrustBadge({ reviewCount: 10, trustScore: 60 })).toBe("NEEDS_IMPROVEMENT");
  });
});
