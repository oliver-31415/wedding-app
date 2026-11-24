import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getHostContext: async () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/db", () => ({ db: {}, schema: {} }));
const { canViewPage } = await import("./site-access");
import { guest } from "./rsvp/fixtures";

const published = { published: true, sitePassword: "pw" };
const anon = { isHost: false, unlocked: false, householdId: null };
const known = { isHost: false, unlocked: false, householdId: "h1" };
const fam = { visibility: "guests" as const, audience: { mode: "tags" as const, tagIds: ["family"] } };

describe("canViewPage", () => {
  it("lets hosts preview anything", () => {
    expect(canViewPage({ published: false, sitePassword: null }, { visibility: "hidden", audience: { mode: "all" } }, { ...anon, isHost: true }, [])).toBe("ok");
  });
  it("blocks everything on an unpublished site", () => {
    expect(canViewPage({ published: false, sitePassword: null }, { visibility: "public", audience: { mode: "all" } }, anon, [])).toBe("unpublished");
  });
  it("needs the password, or a known guest, for password pages", () => {
    const page = { visibility: "password" as const, audience: { mode: "all" as const } };
    expect(canViewPage(published, page, anon, [])).toBe("needs_password");
    expect(canViewPage(published, page, { ...anon, unlocked: true }, [])).toBe("ok");
    expect(canViewPage(published, page, known, [])).toBe("ok");
    // No password set: only guests who found their invitation get in.
    expect(canViewPage({ published: true, sitePassword: null }, page, anon, [])).toBe("needs_guest");
  });
  it("restricts guest pages to the audience", () => {
    expect(canViewPage(published, fam, anon, [])).toBe("needs_guest");
    expect(canViewPage(published, fam, known, [guest("a", "h1")])).toBe("not_for_you");
    expect(canViewPage(published, fam, known, [guest("a", "h1", { tagIds: ["family"] })])).toBe("ok");
  });
});
