import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/supabase.js", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "../utils/supabase.js";
import { pullState, pushState } from "./cloud.js";

// Chainable fake query builder — every method but the terminal one returns
// itself, mirroring the subset of the supabase-js fluent API this module uses.
const makeQueryBuilder = (result) => {
  const qb = {
    select: () => qb,
    eq: () => qb,
    update: () => qb,
    insert: () => qb,
    maybeSingle: () => Promise.resolve(result),
  };
  return qb;
};

const fakeClient = (result) => ({
  from: vi.fn(() => makeQueryBuilder(result)),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pullState", () => {
  it("returns the row when one exists", async () => {
    const row = { doc: { _version: 3 }, rev: 5, updated_at: "2026-08-13T00:00:00.000Z" };
    getSupabase.mockResolvedValue(fakeClient({ data: row, error: null }));
    await expect(pullState("user-1")).resolves.toEqual(row);
  });

  it("returns null when the user has no cloud row yet", async () => {
    getSupabase.mockResolvedValue(fakeClient({ data: null, error: null }));
    await expect(pullState("user-1")).resolves.toBeNull();
  });

  it("throws on a query error", async () => {
    getSupabase.mockResolvedValue(fakeClient({ data: null, error: new Error("boom") }));
    await expect(pullState("user-1")).rejects.toThrow("boom");
  });
});

describe("pushState", () => {
  it("inserts and returns the new rev when expectedRev is null (first push)", async () => {
    getSupabase.mockResolvedValue(fakeClient({ data: { rev: 1 }, error: null }));
    await expect(
      pushState({ userId: "user-1", doc: {}, expectedRev: null, deviceId: "d1" })
    ).resolves.toEqual({ ok: true, rev: 1 });
  });

  it("reports a conflict when a first push collides with an existing row", async () => {
    getSupabase.mockResolvedValue(fakeClient({ data: null, error: { code: "23505" } }));
    await expect(
      pushState({ userId: "user-1", doc: {}, expectedRev: null, deviceId: "d1" })
    ).resolves.toEqual({ conflict: true });
  });

  it("updates and returns the new rev on a successful CAS write", async () => {
    getSupabase.mockResolvedValue(fakeClient({ data: { rev: 6 }, error: null }));
    await expect(
      pushState({ userId: "user-1", doc: {}, expectedRev: 5, deviceId: "d1" })
    ).resolves.toEqual({ ok: true, rev: 6 });
  });

  it("reports a conflict when the CAS write matches zero rows (rev moved under it)", async () => {
    getSupabase.mockResolvedValue(fakeClient({ data: null, error: null }));
    await expect(
      pushState({ userId: "user-1", doc: {}, expectedRev: 5, deviceId: "d1" })
    ).resolves.toEqual({ conflict: true });
  });
});
