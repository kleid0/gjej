import { describe, it, expect } from "vitest";
import {
  monthKeyUtc,
  projectMonthly,
  pruneMonths,
  breakerVerdict,
  type MonthUsage,
  type BreakerLimits,
} from "../usageTracker";

const mu = (gbHours: number): MonthUsage => ({
  invocations: 1,
  functionSeconds: 1,
  gbHours,
  warnedAt: null,
});

describe("monthKeyUtc", () => {
  it("formats YYYY-MM in UTC", () => {
    expect(monthKeyUtc(new Date("2026-07-21T14:00:00Z"))).toBe("2026-07");
    // Late on the last day local-time is still the same UTC month key
    expect(monthKeyUtc(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
  });
});

describe("projectMonthly", () => {
  it("projects linearly to month end", () => {
    // 10 GB-hours by day 10 of a 31-day month → 31 projected
    const p = projectMonthly(10, new Date("2026-07-10T12:00:00Z"), 100);
    expect(p.projected).toBeCloseTo(31, 5);
    expect(p.pctUsed).toBeCloseTo(10, 5);
    expect(p.pctProjected).toBeCloseTo(31, 5);
  });

  it("equals actual usage on the last day of the month", () => {
    const p = projectMonthly(90, new Date("2026-06-30T12:00:00Z"), 100);
    expect(p.projected).toBeCloseTo(90, 5);
    expect(p.pctProjected).toBeCloseTo(90, 5);
  });

  it("flags a month trending over the limit", () => {
    // 60 by day 15 of a 30-day month → 120 projected → 120% of limit
    const p = projectMonthly(60, new Date("2026-06-15T00:30:00Z"), 100);
    expect(p.pctProjected).toBeCloseTo(120, 5);
  });
});

describe("breakerVerdict", () => {
  const limits: BreakerLimits = { gbHoursLimit: 100, cpuHoursLimit: 4, breakerPct: 95 };
  const month = (over: Partial<MonthUsage>): MonthUsage => ({ ...mu(0), ...over });

  it("does not trip under both caps", () => {
    const v = breakerVerdict(month({ gbHours: 50, cpuSeconds: 2 * 3600 }), limits);
    expect(v.tripped).toBe(false);
  });

  it("trips on active CPU crossing 95% of its limit", () => {
    // 3.8 CPU-hours = exactly 95% of 4
    const v = breakerVerdict(month({ cpuSeconds: 3.8 * 3600 }), limits);
    expect(v.tripped).toBe(true);
    expect(v.reason).toContain("active CPU");
  });

  it("trips on GB-hours crossing 95% of its limit", () => {
    const v = breakerVerdict(month({ gbHours: 95 }), limits);
    expect(v.tripped).toBe(true);
    expect(v.reason).toContain("GB-hour");
  });

  it("does not trip on a missing month bucket or legacy file without cpuSeconds", () => {
    expect(breakerVerdict(undefined, limits).tripped).toBe(false);
    const legacy = { invocations: 1, functionSeconds: 1, gbHours: 10, warnedAt: null };
    expect(breakerVerdict(legacy, limits).tripped).toBe(false);
  });
});

describe("pruneMonths", () => {
  it("keeps only the most recent N month buckets", () => {
    const months = {
      "2026-03": mu(1),
      "2026-04": mu(2),
      "2026-05": mu(3),
      "2026-06": mu(4),
      "2026-07": mu(5),
    };
    const pruned = pruneMonths(months, 3);
    expect(Object.keys(pruned).sort()).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(pruned["2026-07"].gbHours).toBe(5);
  });

  it("is a no-op when under the cap", () => {
    const months = { "2026-07": mu(5) };
    expect(pruneMonths(months, 3)).toEqual(months);
  });
});
