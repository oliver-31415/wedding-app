import { describe, expect, it } from "vitest";
import { canSeeEvent, visibleEvents } from "./event-visibility";
import { guest } from "./rsvp/fixtures";

const ceremony = { id: "ceremony", audience: { mode: "all" as const }, guestsOnly: false };
const reception = { id: "reception", audience: { mode: "all" as const }, guestsOnly: true };
const rehearsal = { id: "rehearsal", audience: { mode: "tags" as const, tagIds: ["family"] }, guestsOnly: false };
const all = [ceremony, reception, rehearsal];
const anon = { isHost: false, householdId: null };
const host = { isHost: true, householdId: null };

describe("event visibility", () => {
  it("shows only public events to anonymous visitors, with a prompt", () => {
    expect(visibleEvents(all, anon, [])).toEqual({ events: [ceremony], promptToIdentify: true });
  });
  it("shows guests-only events to any identified guest on the list", () => {
    const friend = [guest("amy", "h1")];
    expect(visibleEvents(all, { isHost: false, householdId: "h1" }, friend).events.map((e) => e.id)).toEqual(["ceremony", "reception"]);
  });
  it("shows tag-limited events only to invited households", () => {
    const family = [guest("dave", "h2", { tagIds: ["family"] })];
    expect(canSeeEvent(rehearsal, { isHost: false, householdId: "h2" }, family)).toBe(true);
    expect(canSeeEvent(rehearsal, { isHost: false, householdId: "h1" }, [guest("amy", "h1")])).toBe(false);
  });
  it("shows everything to hosts and no prompt", () => {
    expect(visibleEvents(all, host, [])).toEqual({ events: all, promptToIdentify: false });
  });
  it("doesn't prompt when nothing is hidden", () => {
    expect(visibleEvents([ceremony], anon, []).promptToIdentify).toBe(false);
  });
});
