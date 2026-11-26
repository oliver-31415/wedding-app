import "server-only";
import { and, asc, eq, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { emailLimits, QUEUE_INTERVAL_MS, roomNow } from "@/lib/email-quota";
import { pruneSends, recentSends } from "@/lib/email-usage";
import { renderMessage } from "@/lib/messaging/render";
import { siteBaseOf } from "@/lib/site-root";

/**
 * The bulk email queue. Sending a message records a "queued" delivery for
 * each recipient; this sends them oldest first (across all weddings, which
 * share one email account) while the limits leave room for bulk email, and
 * the timer started in src/instrumentation.ts carries on with the rest as
 * older sends age out — the next day for a big send.
 *
 * Never sends twice: each row is claimed with a conditional update
 * (queued → sent) before its email goes, so only one runner can win it, and a
 * process-wide lock keeps the inline run and the timer from overlapping.
 * If the server stops mid-send, a claimed row stays "sent" (at most once).
 */

type QueueState = {
  running: Promise<void> | null;
  again: boolean;
  /** Messages the couple stopped while a row of theirs may be mid-send. */
  stopped?: Set<string>;
  timer?: ReturnType<typeof setInterval>;
  first?: ReturnType<typeof setTimeout>;
};
const g = globalThis as unknown as { __weddingEmailQueue?: QueueState };
const state: QueueState = (g.__weddingEmailQueue ??= { running: null, again: false });
const stopped = (state.stopped ??= new Set());

/**
 * "Stop sending the rest": drops the message's queued emails. A row already
 * claimed by a run can't be deleted here, so the message is remembered and
 * that row is dropped, not put back, if the limit turns it away.
 */
export async function stopQueuedMessage(weddingId: string, messageId: string): Promise<void> {
  stopped.add(messageId);
  await db
    .delete(schema.messageDeliveries)
    .where(
      and(
        eq(schema.messageDeliveries.messageId, messageId),
        eq(schema.messageDeliveries.weddingId, weddingId),
        eq(schema.messageDeliveries.status, "queued"),
      ),
    );
}

/**
 * Sends what the limits allow. Calls while a run is going join it (and make it
 * look again once it's done, so newly queued rows aren't left for the timer).
 */
export function processEmailQueue(): Promise<void> {
  if (state.running) {
    state.again = true;
    return state.running;
  }
  state.running = (async () => {
    try {
      do {
        state.again = false;
        await drain();
      } while (state.again);
    } catch (e) {
      console.error("Email queue:", e);
    } finally {
      state.running = null;
    }
  })();
  return state.running;
}

async function drain(): Promise<void> {
  const limits = emailLimits();
  for (;;) {
    const room = roomNow(await recentSends(), Date.now(), limits, "bulk");
    if (room <= 0) return;
    const rows = await db
      .select({ id: schema.messageDeliveries.id })
      .from(schema.messageDeliveries)
      .where(eq(schema.messageDeliveries.status, "queued"))
      .orderBy(asc(schema.messageDeliveries.createdAt), asc(schema.messageDeliveries.id))
      .limit(room);
    if (!rows.length) return;
    for (const row of rows) {
      if ((await sendQueued(row.id)) === "limited") return;
    }
  }
}

type Outcome = "sent" | "failed" | "dropped" | "skipped" | "limited";

async function sendQueued(deliveryId: string): Promise<Outcome> {
  // Claim it: only one runner gets the row back.
  const [d] = await db
    .update(schema.messageDeliveries)
    .set({ status: "sent" })
    .where(and(eq(schema.messageDeliveries.id, deliveryId), eq(schema.messageDeliveries.status, "queued")))
    .returning();
  if (!d) return "skipped";
  try {
    return await deliver(d);
  } catch (e) {
    // Something broke before the email could go: record it rather than retry forever.
    await db
      .update(schema.messageDeliveries)
      .set({ status: "failed", error: e instanceof Error ? e.message : "Unknown error" })
      .where(eq(schema.messageDeliveries.id, d.id));
    return "failed";
  }
}

async function deliver(d: typeof schema.messageDeliveries.$inferSelect): Promise<Outcome> {
  const drop = async () => {
    await db.delete(schema.messageDeliveries).where(eq(schema.messageDeliveries.id, d.id));
    return "dropped" as const;
  };

  const [message] = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.id, d.messageId), eq(schema.messages.weddingId, d.weddingId)));
  const [guest] = d.guestId
    ? await db
        .select({ firstName: schema.guests.firstName, email: schema.guests.email, householdId: schema.guests.householdId })
        .from(schema.guests)
        .where(and(eq(schema.guests.id, d.guestId), eq(schema.guests.weddingId, d.weddingId)))
    : [];
  // Guest deleted, or their address removed since: nothing to send. Without a
  // delivery they count as "not reached yet" (if still on the list).
  const to = guest?.email?.trim().toLowerCase();
  if (!message || !guest || !d.guestId || !to) return drop();

  // Reached another way since it was queued (the couple marked them), or this
  // address already got it: don't send it again.
  const [already] = await db
    .select({ id: schema.messageDeliveries.id })
    .from(schema.messageDeliveries)
    .where(
      and(
        eq(schema.messageDeliveries.messageId, d.messageId),
        eq(schema.messageDeliveries.status, "sent"),
        ne(schema.messageDeliveries.id, d.id),
        or(eq(schema.messageDeliveries.guestId, d.guestId), eq(schema.messageDeliveries.email, to)),
      ),
    )
    .limit(1);
  if (already) return drop();

  const [wedding] = await db.select().from(schema.weddings).where(eq(schema.weddings.id, d.weddingId));
  const [household] = await db
    .select({ inviteToken: schema.households.inviteToken })
    .from(schema.households)
    .where(and(eq(schema.households.id, guest.householdId), eq(schema.households.weddingId, d.weddingId)));
  if (!wedding) return drop();

  const rendered = renderMessage({
    wedding: { ...wedding, siteBase: await siteBaseOf(wedding) },
    message: {
      subject: message.subject,
      body: message.body,
      buttonTarget: message.buttonTarget,
      buttonLabel: message.buttonLabel,
    },
    recipient: { firstName: guest.firstName },
    inviteToken: household?.inviteToken ?? null,
  });
  if (stopped.has(d.messageId)) return drop();
  const res = await sendEmail(
    { to, subject: rendered.subject, html: rendered.html, text: rendered.text, weddingId: d.weddingId },
    { kind: "bulk" },
  );

  if (!res.ok && res.limited) {
    // Nothing went: put it back at the front of the queue, unless the couple stopped the message meanwhile.
    if (stopped.has(d.messageId)) return drop();
    await db.update(schema.messageDeliveries).set({ status: "queued" }).where(eq(schema.messageDeliveries.id, d.id));
    return "limited";
  }
  // createdAt becomes when it actually went, so "recorded at" is the send time.
  await db
    .update(schema.messageDeliveries)
    .set(
      res.ok
        ? { email: to, error: null, createdAt: new Date() }
        : { status: "failed", email: to, error: res.error, createdAt: new Date() },
    )
    .where(eq(schema.messageDeliveries.id, d.id));
  return res.ok ? "sent" : "failed";
}

/**
 * Runs the queue every 5 minutes (and once shortly after start, to pick up
 * after a restart). Safe to call again: replaces the previous timer, so hot
 * reloads never leave two running.
 */
export function startEmailQueueTimer(): void {
  if (state.timer) clearInterval(state.timer);
  if (state.first) clearTimeout(state.first);
  const tick = () => {
    void processEmailQueue();
    void pruneSends().catch(() => {});
  };
  state.first = setTimeout(tick, 15_000);
  state.timer = setInterval(tick, QUEUE_INTERVAL_MS);
  state.first.unref?.();
  state.timer.unref?.();
}
