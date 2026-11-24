import { describe, expect, it } from "vitest";
import { selectRecipients } from "./recipients";
import { event, guest, household } from "@/lib/rsvp/fixtures";

const snapshot = {
  households: [household("h1"), household("h2"), household("h3")],
  guests: [
    guest("david", "h1", { tagIds: ["family"] }),
    guest("susan", "h1", { email: "DAVID@example.com" }), // shared address
    guest("amy", "h2", { email: null }),
    guest("bob", "h3", { tagIds: ["family"] }),
  ],
  events: [event("ceremony")],
  questions: [],
  responses: [
    { guestId: "david", eventId: "ceremony", attending: true },
    { guestId: "susan", eventId: "ceremony", attending: false },
    { guestId: "bob", eventId: "ceremony", attending: false },
  ],
  answers: [],
};

describe("selectRecipients", () => {
  it("sends one email per address and reports guests without one", () => {
    const r = selectRecipients(snapshot, { audience: { mode: "all" }, rsvpStatus: "any" });
    expect(r.recipients.map((x) => x.email)).toEqual(["david@example.com", "bob@example.com"]);
    expect(r.missingEmail.map((x) => x.name)).toEqual(["Amy Jones"]);
  });
  it("filters by household RSVP status", () => {
    const ids = (s: Parameters<typeof selectRecipients>[1]["rsvpStatus"]) =>
      selectRecipients(snapshot, { audience: { mode: "all" }, rsvpStatus: s }).recipients.map((x) => x.guestId);
    expect(ids("not_responded")).toEqual([]); // amy has no email
    expect(selectRecipients(snapshot, { audience: { mode: "all" }, rsvpStatus: "not_responded" }).missingEmail).toHaveLength(1);
    expect(ids("attending")).toEqual(["david"]);
    expect(ids("declined")).toEqual(["bob"]);
  });
  it("filters by tag", () => {
    const r = selectRecipients(snapshot, { audience: { mode: "tags", tagIds: ["family"] }, rsvpStatus: "any" });
    expect(r.recipients.map((x) => x.guestId)).toEqual(["david", "bob"]);
  });
});
