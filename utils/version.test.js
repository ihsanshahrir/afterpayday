import { describe, it, expect } from "vitest";
import { APP_VERSION } from "./version.js";

describe("version", () => {
  it("uses the vitest define fallback", () => {
    expect(APP_VERSION).toBe("0.0.0-test");
  });
});
