import { describe, it, expect } from "vitest";
import { StoreLimiter, with403Retry, takeStoreHttpFailures } from "../storeHttp";

const err403 = () => ({ isAxiosError: true, response: { status: 403 } });

describe("StoreLimiter", () => {
  it("caps in-flight concurrency", async () => {
    const limiter = new StoreLimiter({ concurrency: 2, minGapMs: 0 });
    let active = 0;
    let maxActive = 0;
    const task = () =>
      limiter.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
      });
    await Promise.all([task(), task(), task(), task(), task(), task()]);
    expect(maxActive).toBe(2);
  });

  it("spaces request starts by minGapMs", async () => {
    const limiter = new StoreLimiter({ concurrency: 3, minGapMs: 40 });
    const starts: number[] = [];
    const task = () =>
      limiter.run(async () => {
        starts.push(Date.now());
      });
    await Promise.all([task(), task(), task(), task()]);
    starts.sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      // generous slop for timer jitter
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(30);
    }
  });

  it("releases the slot when the task throws", async () => {
    const limiter = new StoreLimiter({ concurrency: 1, minGapMs: 0 });
    await expect(limiter.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    // If the slot leaked, this would hang; vitest's test timeout would trip.
    await expect(limiter.run(async () => "ok")).resolves.toBe("ok");
  });
});

describe("with403Retry", () => {
  it("retries once on 403 and tallies the recovery", async () => {
    takeStoreHttpFailures(); // clear
    let calls = 0;
    const result = await with403Retry(
      "teststore",
      async () => {
        calls++;
        if (calls === 1) throw err403();
        return "ok";
      },
      1, // fast retry for tests
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
    expect(takeStoreHttpFailures()).toEqual({ "teststore:403-recovered": 1 });
  });

  it("propagates a second 403 without tallying a recovery", async () => {
    takeStoreHttpFailures();
    let calls = 0;
    await expect(
      with403Retry("teststore", async () => { calls++; throw err403(); }, 1),
    ).rejects.toMatchObject({ response: { status: 403 } });
    expect(calls).toBe(2);
    expect(takeStoreHttpFailures()).toEqual({});
  });

  it("does not retry non-403 failures", async () => {
    let calls = 0;
    await expect(
      with403Retry(
        "teststore",
        async () => { calls++; throw { isAxiosError: true, response: { status: 500 } }; },
        1,
      ),
    ).rejects.toBeTruthy();
    expect(calls).toBe(1);
  });
});
