import { describe, it, expect } from "vitest";
import { recordStoreHttpFailure, takeStoreHttpFailures } from "../PriceScraper";

// axios.isAxiosError(e) is true for any object with isAxiosError === true.
const axiosErr = (extra: Record<string, unknown>) => ({ isAxiosError: true, ...extra });

describe("store HTTP failure tally", () => {
  it("starts empty", () => {
    expect(takeStoreHttpFailures()).toEqual({});
  });

  it("keys by store + HTTP status / code, counts repeats, and clears on take", () => {
    recordStoreHttpFailure("shpresa", axiosErr({ response: { status: 403 } }));
    recordStoreHttpFailure("shpresa", axiosErr({ response: { status: 403 } }));
    recordStoreHttpFailure("foleja", axiosErr({ code: "ECONNABORTED" })); // timeout
    recordStoreHttpFailure("globe", axiosErr({ code: "ECONNRESET" }));    // network code
    recordStoreHttpFailure("neptun", new Error("plain")); // not an axios error

    expect(takeStoreHttpFailures()).toEqual({
      "shpresa:403": 2,
      "foleja:timeout": 1,
      "globe:ECONNRESET": 1,
      "neptun:error": 1,
    });

    // take() resets the tally
    expect(takeStoreHttpFailures()).toEqual({});
  });
});
