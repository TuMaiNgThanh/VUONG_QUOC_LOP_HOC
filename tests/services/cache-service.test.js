import { describe, expect, it } from "vitest";

import { getCache, setCache } from "../../scripts/services/local/cache-service.js";

describe("cache-service", () => {
  it("setCache writes JSON string into localStorage", () => {
    setCache("k1", { a: 1 });
    expect(localStorage.getItem("k1")).toBe('{"a":1}');
  });

  it("getCache returns parsed object", () => {
    localStorage.setItem("k2", JSON.stringify({ name: "vuong" }));
    expect(getCache("k2")).toEqual({ name: "vuong" });
  });

  it("getCache returns fallback when key does not exist", () => {
    expect(getCache("missing", [])).toEqual([]);
  });

  it("getCache returns fallback when JSON is corrupted (edge case)", () => {
    localStorage.setItem("broken", "{not-valid-json");
    expect(getCache("broken", { safe: true })).toEqual({ safe: true });
  });

  it("handles primitives correctly", () => {
    setCache("n", 123);
    expect(getCache("n")).toBe(123);

    setCache("b", false);
    expect(getCache("b")).toBe(false);
  });

  it("returns fallback when localStorage has empty string", () => {
    localStorage.setItem("empty", "");
    expect(getCache("empty", "fallback")).toBe("fallback");
  });

  it("parses null literal without applying fallback", () => {
    localStorage.setItem("null-literal", "null");
    expect(getCache("null-literal", { f: true })).toBeNull();
  });

  it("stores undefined as JSON text and reads back undefined", () => {
    setCache("undef", undefined);
    expect(localStorage.getItem("undef")).toBe("undefined");
    expect(getCache("undef", "safe")).toBe("safe");
  });

  it("supports array values", () => {
    setCache("arr", [1, 2, 3]);
    expect(getCache("arr")).toEqual([1, 2, 3]);
  });
});
