import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { inAudience } from "@/lib/audience";
import { getHostContext } from "@/lib/auth";
import { effectiveTagIds, type SnapGuest } from "@/lib/rsvp/model";

type Wedding = typeof schema.weddings.$inferSelect;
type Page = Pick<typeof schema.pages.$inferSelect, "visibility" | "audience">;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return "dev-only-secret-change-me";
}

/** `purpose` separates the different signatures so one can't stand in for another. */
function sign(purpose: "unlock" | "guest" | "choice", value: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("base64url");
}

function verify(purpose: "unlock" | "guest" | "choice", value: string, signature: string): boolean {
  const a = Buffer.from(sign(purpose, value));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sameText(a: string, b: string): boolean {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

async function inviteTokenFor(weddingId: string, householdId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: schema.households.inviteToken })
    .from(schema.households)
    .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, weddingId)));
  return row?.token ?? null;
}

const unlockCookie = (weddingId: string) => `wa_unlock_${weddingId}`;
const guestCookie = (weddingId: string) => `wa_guest_${weddingId}`;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

/** Who is looking at the guest site. */
export type Viewer = {
  isHost: boolean;
  /** Entered the site password (changing the password signs everyone out). */
  unlocked: boolean;
  /** Household identified by name lookup or a personal invite link. */
  householdId: string | null;
};

export async function getViewer(wedding: Wedding): Promise<Viewer> {
  const jar = await cookies();
  const host = await getHostContext();
  const isHost = host?.wedding.id === wedding.id;

  const unlock = jar.get(unlockCookie(wedding.id))?.value;
  const unlocked = !!wedding.sitePassword && !!unlock && verify("unlock", `${wedding.id}:${wedding.sitePassword}`, unlock);

  // The guest cookie is bound to the household's invite token, so resetting
  // the personal link or deleting the household signs that browser out.
  let householdId: string | null = null;
  const g = jar.get(guestCookie(wedding.id))?.value;
  if (g) {
    const [id, sig] = g.split(".");
    const token = id && sig ? await inviteTokenFor(wedding.id, id) : null;
    if (token && verify("guest", `${wedding.id}:${id}:${token}`, sig)) householdId = id;
  }
  return { isHost, unlocked, householdId };
}

/** Server Action only. */
export async function unlockSite(wedding: Wedding, attempt: string): Promise<boolean> {
  if (!wedding.sitePassword || !sameText(attempt.trim().toLowerCase(), wedding.sitePassword.trim().toLowerCase())) return false;
  (await cookies()).set(unlockCookie(wedding.id), sign("unlock", `${wedding.id}:${wedding.sitePassword}`), COOKIE_OPTS);
  return true;
}

/** Server Action / Route Handler only. Remembers which household this browser belongs to. */
export async function identifyHousehold(weddingId: string, householdId: string): Promise<void> {
  const token = await inviteTokenFor(weddingId, householdId);
  if (!token) throw new Error("Unknown household");
  (await cookies()).set(guestCookie(weddingId), `${householdId}.${sign("guest", `${weddingId}:${householdId}:${token}`)}`, COOKIE_OPTS);
}

const CHOICE_TTL_MS = 15 * 60_000;

/**
 * When a name lookup offers "Is this you?" options, each option carries one of
 * these, so choosing a household proves the lookup actually offered it — a
 * visitor can't sign in as an arbitrary household id.
 */
export function signHouseholdChoice(weddingId: string, householdId: string, now = Date.now()): string {
  const exp = now + CHOICE_TTL_MS;
  return `${exp}.${sign("choice", `${weddingId}:${householdId}:${exp}`)}`;
}

export function verifyHouseholdChoice(weddingId: string, householdId: string, token: string, now = Date.now()): boolean {
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return verify("choice", `${weddingId}:${householdId}:${exp}`, sig);
}

export async function forgetHousehold(weddingId: string): Promise<void> {
  (await cookies()).delete(guestCookie(weddingId));
}

/**
 * The one rule for page access on the guest site.
 *  - hosts see everything (preview), including hidden pages and unpublished sites;
 *  - everyone else needs the site published;
 *  - "password" pages need the site password, or an identified household
 *    (with no password set, only identified households get in);
 *  - "guests" pages need an identified household with a member in the page audience.
 */
export function canViewPage(
  wedding: Pick<Wedding, "published" | "sitePassword">,
  page: Page,
  viewer: Viewer,
  householdGuests: SnapGuest[],
): "ok" | "unpublished" | "hidden" | "needs_password" | "needs_guest" | "not_for_you" {
  if (viewer.isHost) return "ok";
  if (!wedding.published) return "unpublished";
  switch (page.visibility) {
    case "public":
      return "ok";
    case "hidden":
      return "hidden";
    case "password":
      if (viewer.unlocked || viewer.householdId) return "ok";
      return wedding.sitePassword ? "needs_password" : "needs_guest";
    case "guests":
      if (!viewer.householdId) return "needs_guest";
      return householdGuests.some((g) => inAudience(page.audience, effectiveTagIds(g, householdGuests)))
        ? "ok"
        : "not_for_you";
  }
}
