import { describe, it, expect } from "vitest";
import { formatEntry, type LogEntry } from "../logger";
import { capLines, MAX_LOG_LINES } from "../gitSink";

function entry(extra: Record<string, unknown> = {}): LogEntry {
  return { t: "2026-06-20T00:00:00.000Z", level: "info", scope: "test", msg: "hi", ...extra };
}

describe("formatEntry", () => {
  it("emits single-line JSON with all fields", () => {
    const line = formatEntry(entry({ count: 3, nested: { a: 1 } }));
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toMatchObject({
      level: "info",
      scope: "test",
      msg: "hi",
      count: 3,
      nested: { a: 1 },
    });
  });

  it("serializes Error values to name/message/stack", () => {
    const parsed = JSON.parse(formatEntry(entry({ err: new Error("boom") })));
    expect(parsed.err.name).toBe("Error");
    expect(parsed.err.message).toBe("boom");
    expect(typeof parsed.err.stack).toBe("string");
  });

  it("escapes embedded newlines so the entry stays on one physical line", () => {
    const line = formatEntry(entry({ note: "line1\nline2" }));
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).note).toBe("line1\nline2");
  });

  it("falls back gracefully on circular structures instead of throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const line = formatEntry(entry({ circular }));
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed._unserializable).toBe(true);
    expect(parsed.msg).toBe("hi");
  });
});

describe("capLines", () => {
  it("returns the input unchanged when under the line cap", () => {
    const lines = ["a", "b", "c"];
    expect(capLines(lines)).toEqual(lines);
  });

  it("keeps only the newest MAX_LOG_LINES lines (ring buffer)", () => {
    const lines = Array.from({ length: MAX_LOG_LINES + 500 }, (_, i) => `line-${i}`);
    const capped = capLines(lines);
    expect(capped.length).toBe(MAX_LOG_LINES);
    expect(capped[capped.length - 1]).toBe(`line-${lines.length - 1}`);
    expect(capped[0]).toBe(`line-${lines.length - MAX_LOG_LINES}`);
  });

  it("always keeps at least the newest line", () => {
    expect(capLines(["only"])).toEqual(["only"]);
    expect(capLines([])).toEqual([]);
  });
});
