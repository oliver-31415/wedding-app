// Development data: `pnpm db:seed` (after `pnpm db:migrate`). Wipes and recreates
// the demo wedding. Sign in as demo@example.com / wedding-demo.
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema.ts";
import { newId, newToken } from "../src/lib/ids.ts";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/wedding.db" });
await client.execute("PRAGMA foreign_keys = ON");
const db = drizzle(client, { schema });

const EMAIL = "demo@example.com";
const existing = await db.select().from(schema.users).where(eq(schema.users.email, EMAIL));
for (const u of existing) {
  const members = await db.select().from(schema.weddingMembers).where(eq(schema.weddingMembers.userId, u.id));
  for (const m of members) await db.delete(schema.weddings).where(eq(schema.weddings.id, m.weddingId));
  await db.delete(schema.users).where(eq(schema.users.id, u.id));
}

const userId = newId();
await db.insert(schema.users).values({ id: userId, email: EMAIL, name: "Alex", passwordHash: await bcrypt.hash("wedding-demo", 10) });

const weddingId = newId();
await db.insert(schema.weddings).values({
  id: weddingId,
  slug: "alex-and-sam",
  partnerOne: "Alex",
  partnerTwo: "Sam",
  date: "2027-03-13",
  locationName: "Bowral, NSW",
  rsvpDeadline: "2027-01-31",
  sitePassword: "bowral",
});
await db.insert(schema.weddingMembers).values({ weddingId, userId, role: "owner" });

// tags
const tag = async (name: string) => {
  const id = newId();
  await db.insert(schema.tags).values({ id, weddingId, name });
  return id;
};
const family = await tag("Family");
const bridalParty = await tag("Wedding party");
const friends = await tag("Friends");

// events
const ev = async (position: number, v: Partial<typeof schema.events.$inferInsert> & { name: string }) => {
  const id = newId();
  await db.insert(schema.events).values({ id, weddingId, position, ...v });
  return id;
};
const rehearsal = await ev(0, {
  name: "Rehearsal dinner",
  startsAt: "2027-03-12T18:30",
  endsAt: "2027-03-12T21:30",
  venueName: "The Bowral Hotel",
  address: "Bong Bong St, Bowral NSW 2576",
  audience: { mode: "tags", tagIds: [family, bridalParty] },
});
const ceremony = await ev(1, {
  name: "Ceremony",
  startsAt: "2027-03-13T15:00",
  endsAt: "2027-03-13T15:45",
  venueName: "Centennial Vineyards",
  address: "252 Centennial Rd, Bowral NSW 2576",
  dressCode: "Garden formal",
});
const reception = await ev(2, {
  name: "Reception",
  startsAt: "2027-03-13T17:00",
  endsAt: "2027-03-13T23:00",
  venueName: "Centennial Vineyards",
  address: "252 Centennial Rd, Bowral NSW 2576",
});

// questions
const meal = newId();
const dietary = newId();
const dietaryDetail = newId();
await db.insert(schema.questions).values([
  {
    id: meal,
    weddingId,
    type: "choice",
    label: "Main course",
    required: true,
    eventId: reception,
    options: [
      { id: "beef", label: "Slow-cooked beef" },
      { id: "fish", label: "Barramundi" },
      { id: "veg", label: "Mushroom risotto (V)" },
    ],
    position: 0,
  },
  {
    id: dietary,
    weddingId,
    type: "choice",
    label: "Any dietary requirements?",
    options: [
      { id: "no", label: "No" },
      { id: "yes", label: "Yes" },
    ],
    eventId: reception,
    position: 1,
  },
  {
    id: dietaryDetail,
    weddingId,
    type: "text",
    label: "Tell us about them",
    required: true,
    parentQuestionId: dietary,
    parentOptionId: "yes",
    position: 2,
  },
  { id: newId(), weddingId, type: "text", label: "A song that will get you dancing", scope: "household", position: 3 },
]);

// guests
type G = { first: string; last: string; email?: string; tags?: string[]; child?: boolean };
const households: { id: string; guests: string[] }[] = [];
const house = async (members: G[], opts: { envelope?: string; plusOnes?: number; city?: string } = {}) => {
  const id = newId();
  await db.insert(schema.households).values({
    id,
    weddingId,
    envelopeName: opts.envelope ?? null,
    plusOnesAllowed: opts.plusOnes ?? 0,
    inviteToken: newToken(),
    city: opts.city ?? null,
  });
  const ids: string[] = [];
  for (const [i, m] of members.entries()) {
    const gid = newId();
    ids.push(gid);
    await db.insert(schema.guests).values({
      id: gid,
      weddingId,
      householdId: id,
      firstName: m.first,
      lastName: m.last,
      email: m.email ?? null,
      ageGroup: m.child ? "child" : "adult",
      position: i,
    });
    for (const t of m.tags ?? []) await db.insert(schema.guestTags).values({ guestId: gid, tagId: t });
  }
  households.push({ id, guests: ids });
  return { id, guests: ids };
};

const jones = await house(
  [
    { first: "David", last: "Jones", email: "david.jones@example.com", tags: [family] },
    { first: "Susan", last: "Jones", email: "susan.jones@example.com", tags: [family] },
    { first: "Nathan", last: "Jones", tags: [family], child: true },
  ],
  { envelope: "The Jones Family", city: "Sydney" },
);
const callahan = await house(
  [
    { first: "Robert", last: "Callahan", email: "rob@example.com", tags: [bridalParty, friends] },
    { first: "Maria", last: "Callahan", email: "maria@example.com", tags: [friends] },
  ],
  { city: "Melbourne" },
);
const priya = await house([{ first: "Priya", last: "Natarajan", email: "priya@example.com", tags: [friends] }], { plusOnes: 1 });
const tom = await house([{ first: "Tom", last: "Nguyen", email: "tom@example.com", tags: [friends] }], { plusOnes: 1 });
await house([{ first: "Grace", last: "Liu", email: "grace@example.com", tags: [bridalParty, friends] }]);
await house([
  { first: "Margaret", last: "Smith", tags: [family] },
  { first: "John", last: "Smith", tags: [family] },
]);
const ellie = await house([{ first: "Ellie", last: "Brooks", email: "ellie@example.com", tags: [friends] }]);

// responses
const now = new Date();
const respond = async (guestId: string, eventId: string, attending: boolean) =>
  db.insert(schema.eventResponses).values({ weddingId, guestId, eventId, attending, updatedAt: now });
const answer = async (questionId: string, guestId: string | null, householdId: string | null, value: string) =>
  db.insert(schema.answers).values({ id: newId(), weddingId, questionId, guestId, householdId, value, updatedAt: now });
const activity = async (householdId: string, note: string | null = null) =>
  db.insert(schema.rsvpActivity).values({ id: newId(), weddingId, householdId, source: "guest", kind: "first", note });

for (const g of jones.guests) {
  await respond(g, rehearsal, true);
  await respond(g, ceremony, true);
  await respond(g, reception, true);
}
await answer(meal, jones.guests[0], null, "beef");
await answer(meal, jones.guests[1], null, "fish");
await answer(meal, jones.guests[2], null, "veg");
await answer(dietary, jones.guests[0], null, "no");
await answer(dietary, jones.guests[1], null, "yes");
await answer(dietaryDetail, jones.guests[1], null, "Coeliac — no gluten please");
await activity(jones.id, "Can't wait! Nathan is very excited about the dance floor.");

// Robert is in the wedding party (invited to the rehearsal); Maria isn't.
await respond(callahan.guests[0], rehearsal, true);
for (const g of callahan.guests) {
  await respond(g, ceremony, true);
  await respond(g, reception, true);
}
await answer(meal, callahan.guests[0], null, "beef");
await answer(meal, callahan.guests[1], null, "beef");
await activity(callahan.id);

await respond(ellie.guests[0], ceremony, false);
await respond(ellie.guests[0], reception, false);
await activity(ellie.id, "So sorry to miss it — we'll be overseas. Have the best day!");

const plusOne = newId();
await db.insert(schema.guests).values({ id: plusOne, weddingId, householdId: priya.id, firstName: "Dev", lastName: "Patel", isPlusOne: true, position: 1 });
for (const g of [priya.guests[0], plusOne]) {
  await respond(g, ceremony, true);
  await respond(g, reception, true);
}
await answer(meal, priya.guests[0], null, "veg");
await answer(meal, plusOne, null, "fish");
await activity(priya.id);
void tom;

// pages (opt-in: only these exist)
const page = async (position: number, type: schema.PageType, title: string, slug: string, body: string | null = null, visibility: schema.PageVisibility = "public") => {
  const id = newId();
  await db.insert(schema.pages).values({ id, weddingId, type, title, slug, body, position, visibility });
  return id;
};
await page(0, "home", "Home", "", "We're getting married in the Southern Highlands and we'd love you to be there.");
await page(1, "schedule", "Schedule", "schedule");
const faq = await page(2, "faq", "Q&A", "faq");
await db.insert(schema.pageItems).values([
  { id: newId(), weddingId, pageId: faq, title: "Is there parking?", body: "Yes — free parking at the vineyard.", position: 0 },
  { id: newId(), weddingId, pageId: faq, title: "Are children welcome?", body: "Yes! There's a kids' table and an earlier menu.", position: 1 },
]);
await page(3, "gifts", "Gift list", "gifts");
await page(4, "rsvp", "RSVP", "rsvp", null, "password");

// gifts
await db.insert(schema.giftItems).values([
  { id: newId(), weddingId, name: "Le Creuset casserole dish", storeName: "David Jones", url: "https://www.davidjones.com", priceCents: 54900, mostWanted: true, position: 0 },
  { id: newId(), weddingId, name: "Linen sheet set", storeName: "Bed Threads", priceCents: 34000, quantityWanted: 2, position: 1 },
]);
const fund = newId();
await db.insert(schema.cashFunds).values({
  id: fund,
  weddingId,
  name: "Honeymoon in Japan",
  description: "Ramen, onsen and too many train rides.",
  goalCents: 500000,
  paymentInstructions: "PayID: alex.sam@example.com",
});
await db.insert(schema.fundContributions).values({ id: newId(), weddingId, fundId: fund, giverName: "Grace Liu", amountCents: 20000, message: "For the onsen!", received: true });

console.log("Seeded demo wedding /w/alex-and-sam — sign in as demo@example.com / wedding-demo (site password: bowral)");
