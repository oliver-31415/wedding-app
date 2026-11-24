import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ContactAddress, ContactPerson } from "@/db/schema";
import {
  ADDRESS_FIELDS,
  type HouseholdMember,
  planContactApply,
  type ContactPlan,
} from "@/lib/contacts";
import { newId, newToken } from "@/lib/ids";

/**
 * The contact details collector. Two kinds of link open the same form:
 *  - the shared link (/contact/{weddings.contactCollectorToken}), which anyone
 *    can use, so replies wait for the couple to apply them;
 *  - a household's personal link (/contact/{households.inviteToken}), which
 *    proves who's replying, so replies are applied straight away.
 */

type Wedding = typeof schema.weddings.$inferSelect;
type Household = typeof schema.households.$inferSelect;

export type ContactLink =
  | { kind: "shared"; wedding: Wedding }
  | { kind: "personal"; wedding: Wedding; household: Household; members: HouseholdMember[] };

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function resolveContactLink(token: string): Promise<ContactLink | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [shared] = await db.select().from(schema.weddings).where(eq(schema.weddings.contactCollectorToken, token)).limit(1);
  if (shared) return { kind: "shared", wedding: shared };
  const [row] = await db
    .select({ household: schema.households, wedding: schema.weddings })
    .from(schema.households)
    .innerJoin(schema.weddings, eq(schema.weddings.id, schema.households.weddingId))
    .where(eq(schema.households.inviteToken, token))
    .limit(1);
  if (!row) return null;
  return { kind: "personal", wedding: row.wedding, household: row.household, members: await membersOf(row.household.id) };
}

export async function membersOf(householdId: string): Promise<HouseholdMember[]> {
  return db
    .select({
      id: schema.guests.id,
      firstName: schema.guests.firstName,
      lastName: schema.guests.lastName,
      email: schema.guests.email,
      phone: schema.guests.phone,
    })
    .from(schema.guests)
    .where(eq(schema.guests.householdId, householdId))
    .orderBy(asc(schema.guests.position), asc(schema.guests.createdAt));
}

export const addressOf = (h: Pick<Household, (typeof ADDRESS_FIELDS)[number]>): ContactAddress => ({
  addressLine1: h.addressLine1,
  addressLine2: h.addressLine2,
  city: h.city,
  region: h.region,
  postcode: h.postcode,
  country: h.country,
});

// ---------------------------------------------------------------- the collector switch

export async function setCollector(weddingId: string, on: boolean): Promise<void> {
  await db
    .update(schema.weddings)
    .set({ contactCollectorToken: on ? newToken() : null })
    .where(eq(schema.weddings.id, weddingId));
}

// ---------------------------------------------------------------- replies

export async function saveSharedReply(
  weddingId: string,
  reply: { people: ContactPerson[]; address: ContactAddress; note: string | null },
): Promise<void> {
  await db.insert(schema.contactSubmissions).values({
    id: newId(),
    weddingId,
    people: reply.people,
    address: reply.address,
    note: reply.note,
    via: "shared",
  });
}

/** Writes a plan into a household (inside the caller's transaction). */
async function applyPlan(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  weddingId: string,
  householdId: string,
  plan: ContactPlan,
  address: ContactAddress,
): Promise<void> {
  for (const u of plan.updates) {
    await tx
      .update(schema.guests)
      .set({ ...(u.email ? { email: u.email.to } : {}), ...(u.phone ? { phone: u.phone.to } : {}) })
      .where(and(eq(schema.guests.id, u.guestId), eq(schema.guests.weddingId, weddingId), eq(schema.guests.householdId, householdId)));
  }
  if (plan.additions.length) {
    const existing = await tx.select({ id: schema.guests.id }).from(schema.guests).where(eq(schema.guests.householdId, householdId));
    await tx.insert(schema.guests).values(
      plan.additions.map((p, i) => ({
        id: newId(),
        weddingId,
        householdId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        position: existing.length + i,
      })),
    );
  }
  if (plan.address) {
    await tx
      .update(schema.households)
      .set(address)
      .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, weddingId)));
  }
}

/**
 * A personal-link reply: the household is known, so its people's emails and
 * phone numbers (never blanked) and its address are updated now. People the
 * form doesn't list can't be added this way.
 */
export async function applyPersonalReply(
  link: Extract<ContactLink, { kind: "personal" }>,
  reply: { people: ContactPerson[]; address: ContactAddress; note: string | null },
): Promise<void> {
  const plan = planContactApply(reply, link.members, addressOf(link.household));
  plan.additions = [];
  await db.transaction(
    async (tx) => {
      await applyPlan(tx, link.wedding.id, link.household.id, plan, reply.address);
      await tx.insert(schema.contactSubmissions).values({
        id: newId(),
        weddingId: link.wedding.id,
        people: reply.people,
        address: reply.address,
        note: reply.note,
        householdId: link.household.id,
        via: "personal",
        status: "applied",
        resolvedAt: new Date(),
      });
    },
    { behavior: "immediate" },
  );
}

/**
 * The couple applies a shared-link reply to a household ("new" creates one
 * from the reply). Returns false if the reply or household is gone, or it was
 * already dealt with.
 */
export async function applySharedReply(weddingId: string, submissionId: string, target: string | "new"): Promise<boolean> {
  return db.transaction(
    async (tx) => {
      const [sub] = await tx
        .select()
        .from(schema.contactSubmissions)
        .where(
          and(
            eq(schema.contactSubmissions.id, submissionId),
            eq(schema.contactSubmissions.weddingId, weddingId),
            eq(schema.contactSubmissions.status, "pending"),
          ),
        );
      if (!sub) return false;
      let householdId: string;
      if (target === "new") {
        householdId = newId();
        await tx.insert(schema.households).values({ id: householdId, weddingId, inviteToken: newToken() });
        await applyPlan(tx, weddingId, householdId, { updates: [], unchanged: [], additions: sub.people, address: null }, sub.address);
        if (ADDRESS_FIELDS.some((f) => sub.address[f])) {
          await tx.update(schema.households).set(sub.address).where(eq(schema.households.id, householdId));
        }
      } else {
        const [household] = await tx
          .select()
          .from(schema.households)
          .where(and(eq(schema.households.id, target), eq(schema.households.weddingId, weddingId)));
        if (!household) return false;
        const members = await tx
          .select({
            id: schema.guests.id,
            firstName: schema.guests.firstName,
            lastName: schema.guests.lastName,
            email: schema.guests.email,
            phone: schema.guests.phone,
          })
          .from(schema.guests)
          .where(eq(schema.guests.householdId, household.id));
        householdId = household.id;
        await applyPlan(tx, weddingId, householdId, planContactApply(sub, members, addressOf(household)), sub.address);
      }
      await tx
        .update(schema.contactSubmissions)
        .set({ status: "applied", householdId, resolvedAt: new Date() })
        .where(eq(schema.contactSubmissions.id, sub.id));
      return true;
    },
    { behavior: "immediate" },
  );
}

export async function dismissReplies(weddingId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db
    .update(schema.contactSubmissions)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(
      and(
        eq(schema.contactSubmissions.weddingId, weddingId),
        eq(schema.contactSubmissions.status, "pending"),
        inArray(schema.contactSubmissions.id, ids),
      ),
    );
}
