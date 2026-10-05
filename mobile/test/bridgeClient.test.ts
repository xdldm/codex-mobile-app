import { isRunGoneError } from "../src/api/bridgeClient";

describe("isRunGoneError", () => {
  it("recognises a bridge that has dropped the run", () => {
    expect(isRunGoneError(Object.assign(new Error("Run not found: run_1"), { status: 404 }))).toBe(
      true
    );
    expect(isRunGoneError(Object.assign(new Error("gone"), { code: "run_not_found" }))).toBe(true);
  });

  it("leaves real failures alone", () => {
    expect(isRunGoneError(Object.assign(new Error("boom"), { status: 500 }))).toBe(false);
    expect(isRunGoneError(Object.assign(new Error("nope"), { status: 400 }))).toBe(false);
    expect(isRunGoneError(new Error("network down"))).toBe(false);
    expect(isRunGoneError(null)).toBe(false);
    expect(isRunGoneError(undefined)).toBe(false);
  });
});
