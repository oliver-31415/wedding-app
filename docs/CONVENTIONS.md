# WeddingApp conventions

A slim alternative to Withjoy, built around the couple's (host's) experience.
Research notes on how Withjoy works (kept locally in `research/`, not in the repo) informed the design — copy behaviour and
layout ideas from it, never Withjoy's branding or wording.

Read this whole file before writing code. Consistency matters more than
cleverness: every screen should look and behave like the others.

## Product rules

1. **Opt-in content.** Nothing appears on the guest site unless the couple
   added it. No page exists until they add it. An empty field renders nothing —
   no placeholders like "TBD", no sample text, no "Our story goes here".
   Admin forms may use `placeholder=` hints, but never pre-fill values.
2. **Out of scope** (do not build, do not link to): travel, where to stay /
   hotels, video (never served, in any form — no GIFs either), albums, guest
   photo uploads, a shop, syncing other registries, printed stationery,
   SMS/WhatsApp, seating charts on the guest site (the host-only plan in
   `/admin/seating` is fine), multiple languages, custom CSS, a mobile app,
   AI writing help, announcement banners, countdowns.
   **Photos are curated, not an album:** one cover photo (Home page), one per
   story milestone (up to 8) and wedding-party member (up to 12), and an
   opt-in Photos page of up to 12. Caps live in `src/lib/photos-shared.ts`,
   writes go through `src/lib/photos.ts` (which deletes files with rows), and
   the agreed per-style design is in the photo components under
   `src/components/site/photos/`. Uploads are shrunk in the browser
   (`src/lib/client-image.ts`) and camera metadata (GPS) is stripped on save.
3. **One wedding per couple.** Hosts are the owner plus co-hosts.
4. **Money never passes through the app.** Cash funds show the couple's own
   payment details; guests record a pledge; the host ticks "received".
5. **Australian defaults:** AUD, `Australia/Sydney`, en-AU formats, Australian
   spelling (organise, colour, cancelled).

## Contact details and reaching guests

- **Contact details form** (`/contact/{token}`, `src/lib/contact-collector.ts`,
  pure rules in `src/lib/contacts.ts`). The shared link
  (`weddings.contactCollectorToken`, null = off) can be used by anyone, so its
  replies are stored as `contact_submissions` and only change the guest list
  when the couple applies them (Guests → Contact details). A household's
  personal link uses its `inviteToken`, which proves who's replying, so those
  replies apply straight away. Blank fields never erase existing details.
- **Who a message reached** (`src/lib/messaging/reach.ts`). Emails create
  `message_deliveries` with `method = "email"`. Guests the message was meant for
  but who weren't emailed (no address, or added since) are "not reached yet",
  and the couple can mark them posted / texted / in person / other — those
  count as reached exactly like emails. Never invent a delivery the couple
  didn't record.
- **Email limits and the send queue** (`src/lib/email-quota.ts` pure rules,
  `src/lib/email-usage.ts`, `src/lib/messaging/queue.ts`). The email account
  is shared by every wedding and allows `EMAIL_DAILY_LIMIT` (100) a day and
  `EMAIL_MONTHLY_LIMIT` (3000) a month, counted over the last 24 hours and
  31 days from `email_sends` (one row per email sent or put in the dev
  outbox). `sendEmail()` refuses once a limit is reached. Sending a message
  queues a `"queued"` delivery per recipient; the queue sends oldest first
  while bulk room remains (bulk leaves `EMAIL_BULK_RESERVE`, 10, free for
  one-off emails), and a 5-minute timer from `src/instrumentation.ts` sends
  the rest as room frees up. Queued guests show as "Waiting to send", not
  "not reached yet"; "Stop sending the rest" deletes the queued rows. Never
  send bulk email any other way.
- **Finding an invitation by name** (`src/lib/rsvp/lookup.ts`) has three
  tiers. Exact (ignoring case, accents, punctuation, honorifics), or exactly a
  name the couple accepted before (an alias): logs straight in. Confident
  near match (nickname, shortened first name, half a double-barrelled
  surname, names swapped, or one typo in a name of 5+ letters, or a swapped
  or doubled letter in 4): "Is this you?" showing only the matched person's
  name, never an automatic login. Unsure (two typos, sounds alike, a typo in
  a 3-letter name, same first name only …): the guest sees "We couldn't find
  that name" and can ask the couple to check. Those requests are
  `name_requests` (`src/lib/name-checks.ts`); the couple matches them on
  RSVPs → Name checks using `suggestGuests()`, which emails the guest their
  personal link. Accepted rows are the aliases; "Forget" deletes one. Pass
  aliases (`loadNameAliases`) wherever you call `findInvitation`.
- **Dietary requirements** are a question type (`"dietary"`, `src/lib/rsvp/dietary.ts`):
  a fixed checklist plus a note, stored as JSON in `answers.value`
  (`{"needs":[]}` = none). Always per guest, at most one active per wedding.
  Totals come from `computeStats` (`QuestionStats.dietary`), shown on RSVPs →
  Dietary; chart slices are exact combinations so they never overlap.
- **Jobs and helpers on the Day of run sheet** (pure rules in
  `src/lib/run-sheet.ts`, loading in `src/lib/run-sheet-data.ts`). Each run
  sheet item can have `jobs` ("HH:mm" start/end on the wedding day, both
  optional, end after start; a new job starts at the item's time), listed by
  start time with untimed jobs last. `helpers` are people doing jobs (not
  guests; the form can copy a guest's details), linked through `job_helpers`.
  Each helper has a private page `/helper/{helpers.token}` (works while the
  site is a draft, noindex) showing only their jobs, grouped by run sheet
  item, and the names and roles of others on them, never anyone's contact
  details. Admin: Day of → Run sheet (jobs under each item, printable) ·
  Helpers (links, emails) · Music. Each song can list its instruments
  (`song_parts`), each with an optional sheet music PDF (15 MB max, checked
  by its `%PDF-` header, stored like pictures; removing the instrument or the
  song deletes the file).
- **Visual editor** (`/editor/[pageId]`): the guest page in an iframe with
  `?edit=1`. Editable parts carry `editAttrs(...)` from `src/lib/edit-targets.ts`
  (hosts only); `EditBridge` turns clicks into messages that open the matching
  panel. New editable content needs a target there and a panel in
  `src/components/admin/editor/visual-editor.tsx`.

## Commands

```
pnpm db:migrate     # apply migrations to data/wedding.db
pnpm db:seed        # demo wedding: demo@example.com / wedding-demo, site at / (and /w/alex-and-sam), site password "bowral"
pnpm test           # vitest (pure logic in src/lib)
pnpm typecheck
pnpm lint
NEXT_DIST_DIR=.next-<you> pnpm dev -p <your port>   # your own dev server
```

Do **not** run `next build` or plain `pnpm dev` (other agents share the
checkout). Do **not** add dependencies or edit `src/db/schema.ts`,
`drizzle/`, `src/lib/rsvp/*`, `src/lib/stats.ts`, `src/lib/auth.ts`,
`src/lib/site-access.ts`, or `src/components/ui/*` — if you need a change
there, describe it in your final report instead. Only fix type/lint errors in
files you own; ignore errors in other agents' in-progress files.

Verify UI **headlessly only** — never open a visible browser window. Use
Playwright (`playwright` is installed; Chromium is cached) from a script in a
temp directory, e.g. log in at `/login`, visit your pages, take screenshots,
look at them.

## Next.js 16

This is Next.js 16 — read `node_modules/next/dist/docs/` when unsure.
- Cache Components is **off**; pages that read cookies are dynamic as usual.
- `params` and `searchParams` are Promises: `const { id } = await params`.
- Use the global `PageProps<"/admin/guests/[householdId]">` / `LayoutProps<...>` types.
- `cookies()` is async and can only be **set** in Server Actions / Route Handlers.
- Middleware is called `proxy.ts` now (we don't use one).

## Architecture

```
src/db/schema.ts           tables + shared types (Audience, PageType, …)
src/db/index.ts            db client (server only)
src/lib/auth.ts            sessions; requireHost() / requireOwner()
src/lib/snapshot.ts        loadSnapshot(weddingId) → everything RSVP/stats need
src/lib/stats.ts           computeStats(snapshot) — EVERY number shown to hosts
src/lib/rsvp/model.ts      RSVP rules (invitations, questions, validation, status)
src/lib/rsvp/lookup.ts     find a household from a typed name
src/lib/rsvp/save.ts       saveRsvp() — the ONLY way RSVP data is written
src/lib/site-access.ts     getViewer(), canViewPage(), unlockSite(), identifyHousehold()
src/lib/messaging/recipients.ts  selectRecipients() — who a message goes to
src/lib/email.ts           sendEmail() (SMTP, e.g. Resend; or the dev outbox table)
src/lib/audience.ts        inAudience() — "everyone" vs "guests with tags"
src/lib/dates.ts           all date/time conversion + formatting
src/lib/money.ts           formatMoney(cents), parseMoney(input)
src/lib/forms.ts           ActionState, text()/bool()/int(), readAudience(), moveId(), slugify()
src/components/ui/         the UI kit (import from "@/components/ui")
src/components/admin/      admin shell
```

### Data rules

- Every admin page and Server Action starts with `const { wedding } = await requireHost()`
  and scopes every query with `eq(table.weddingId, wedding.id)`. Never load or
  change a row by an id from the request without also checking `weddingId`.
- Numbers (counts, percentages, headcounts, meal totals) come from
  `computeStats(await loadSnapshot(wedding.id))`. Don't count rows yourself —
  the rules for who is invited/asked are subtle and live in one place.
- RSVP status per guest/household comes from `guestEventStatus` /
  `householdRsvpState` in `src/lib/rsvp/model.ts`.
- Writes to `event_responses` / `answers` / plus-one guests go through `saveRsvp`.
- "Who sees / who is invited" is always an `Audience`, edited with
  `<AudiencePicker>` and read with `readAudience(formData)`.
- Ordered lists have a `position` column (0-based). Reorder with
  `<ReorderButtons>` + `moveId()`, then rewrite positions 0..n-1.
- Optional text: store `null` when blank (`text(formData, "x")` does this).
- Money: integer cents. Dates: `"YYYY-MM-DD"`; event times `"YYYY-MM-DDTHH:mm"`
  in `wedding.timeZone`. Format only via `src/lib/dates.ts` / `src/lib/money.ts`.
- New ids: `newId()` from `src/lib/ids.ts`.

### Server Actions

Put them in an `actions.ts` next to the page (`"use server"` at the top):

```ts
export async function saveThing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const name = text(formData, "name");
  if (!name) return fail("Please fix the highlighted fields.", { name: "Enter a name." });
  await db.update(...).where(and(eq(t.id, id), eq(t.weddingId, wedding.id)));
  revalidatePath("/admin/…");
  return ok("Saved.");
}
```

Client form (`"use client"`):

```tsx
const [state, action] = useActionState(saveThing, null);
<form action={action} className="space-y-5">
  <FormMessage state={state} />
  <Field label="Name" htmlFor="name" error={state?.errors?.name}>
    <Input id="name" name="name" defaultValue={thing.name} invalid={!!state?.errors?.name} />
  </Field>
  <SubmitButton>Save</SubmitButton>
</form>
```

Simple one-click actions (delete, reorder, toggle) can be plain
`(formData: FormData) => Promise<void>` actions used directly in `<form action>`.
Destructive ones use `<ConfirmButton confirm="Delete this event? …">`.

## UI rules

- Use `@/components/ui` components. Don't hand-roll buttons, inputs, cards,
  badges or stat displays. Use the colour tokens (`bg-surface`, `text-ink-muted`,
  `border-line`, `bg-brand`, `text-good` …) — never raw Tailwind palette colours
  like `bg-gray-100` or `text-green-600` in admin screens.
- Every admin screen: `<PageHeader title description actions />` first, then
  `Card`s. Section tabs use `<SubNav>`. Primary action top-right in the header.
- Lists with no rows show `<EmptyState>` that says what to do and offers the button.
- Forms: one column, max width ~`max-w-2xl`, labels above fields, optional
  fields marked with `optional`, Save button at the bottom left.
- Copy: sentence case ("Add guest", not "Add Guest"), plain words, talk to the
  couple as "you". Buttons say what they do ("Save event", "Send to 42 guests").
- Mobile: everything must work at 375px wide.

### Status vocabulary (use exactly these words and tones)

| Thing | Values → label (Badge tone) |
|---|---|
| Guest at an event | attending → "Attending" (good) · declined → "Declined" (bad) · pending → "Awaiting reply" (warn) · not_invited → "Not invited" (neutral) |
| Household | complete → "Replied" (good) · partial → "Partly replied" (warn) · not_started → "Awaiting reply" (warn) · none → "No RSVP needed" (neutral) |
| Site | published → "Published" (good) · draft → "Draft" (warn) |
| Page visibility | public → "Everyone" · password → "Password" · guests → "Invited guests" · hidden → "Hidden" |
| Gifts | claimed in full → "Gifted" (good) · partly → "2 of 3 gifted" (info) · none → nothing |
| Pledges | received → "Received" (good) · not yet → "Pledged" (warn) |
| Thank-you | thankedAt set → "Thanked" (good) · not → "To thank" (warn) |
| Email delivery | queued → "Waiting to send" (info) · sent → "Sent" (good) · failed → "Failed" (bad) |

Stats: `StatTile` for headline numbers, `SegmentBar` for attending /
declined / awaiting splits (tones good / bad / warn), `BarList` for answer
counts, `Progress` for response rate and fund goals.

## Routes and ownership

Public guest site (`/w/[slug]/…`). On a server without `SUPERUSER_EMAILS`
the (first) wedding is also served at the root of the domain: rewrites in
`next.config.ts` send `/`, `/rsvp`, `/i/…` etc. to `/w/_/…`, and
`getWeddingBySlug("_")` loads that wedding. So never write `/w/${slug}` in a
link — build it from the wedding's `siteBase` ("" at the root, else
`/w/{slug}`) with `sitePath()` / `pageUrl()` from `src/lib/site-paths.ts` /
`src/lib/pages.ts`. Site pages get it as `wedding.siteBase`, admin code from
`requireHost()`, anything else from `siteBaseOf(wedding)`
(`src/lib/site-root.ts`). New top-level app routes must be added to
`RESERVED_SLUGS` so a custom page can't be hidden behind them.

| Route | Owner |
|---|---|
| `/w/[slug]` layout, home, `/w/[slug]/[page]` for schedule, story, wedding-party, faq, custom pages; `/w/[slug]/unlock` | Website |
| RSVP page body (`src/components/site/rsvp/`), `/w/[slug]/find`, `/w/[slug]/i/[token]` | Guest RSVP |
| Gift list page body (`src/components/site/gifts/`) | Gifts |

Fixed page slugs: home `""`, schedule `schedule`, story `story`, party
`wedding-party`, faq `faq`, gifts `gifts`, rsvp `rsvp`. Custom pages use
`slugify(title)`, must be unique and must not be a fixed slug or `unlock`,
`find`, `i`.

The page renderer (Website) mounts, for `type === "rsvp"`:
`<RsvpPageBody wedding={wedding} page={page} viewer={viewer} />` from
`@/components/site/rsvp/rsvp-page-body`, and for `type === "gifts"`:
`<GiftsPageBody wedding={wedding} page={page} viewer={viewer} />` from
`@/components/site/gifts/gifts-page-body`. Both are async Server Components;
`wedding` is the weddings row, `page` the pages row, `viewer` from `getViewer()`.

Admin (`/admin/…`, inside the shell in `src/app/admin/layout.tsx`):

| Route | Owner |
|---|---|
| `/login`, `/signup`, `/onboarding`, `/invite/[token]`, `/admin` (dashboard), `/admin/settings/**` | Accounts |
| `/admin/website/**`, `/admin/schedule/**` | Website |
| `/admin/guests/**` | Guests |
| `/admin/rsvp/**` | RSVP admin |
| `/admin/messages/**`, `/admin/dev/outbox`, `src/lib/messaging/render.ts` | Messaging |
| `/admin/gifts/**` | Gifts |
| `/admin/checklist`, `/admin/budget/**`, `/admin/seating`, `/admin/day-of/**` (incl. jobs and helpers), `/helper/[token]` | Planning |

Shared site components go in `src/components/site/`, admin ones in
`src/components/admin/<area>/`.

## Shared helpers added for several areas

- `<TextBlock text={…} />` (UI kit) — renders every multi-line host-written text
  (paragraphs, line breaks, links). Use it everywhere, on the site and in admin previews.
- `src/lib/gifts.ts` — `itemProgress`, `fundProgress`, `computeGiftSummary`;
  `src/lib/gifts-data.ts` — `loadGiftData(weddingId)`. All gift numbers come from these.
- `src/lib/email-layout.ts` — `renderEmail({ heading, body, button, footer, accentColor })`
  and `appUrl()`. Every email goes through it, then `sendEmail()`.
- `scripts/dev-session.mts` — prints a session token for headless testing:
  `T=$(pnpm -s tsx scripts/dev-session.mts)`, then cookie `wa_session=$T`.
- Personal invite links are `${appUrl()}${sitePath(siteBase, `i/${household.inviteToken}`)}`.

## Shared database while building

All agents share `data/wedding.db` with the seeded demo wedding. Don't run
`pnpm db:seed` or `db:migrate`, and don't delete the demo wedding or its
households — add your own test rows instead and clean them up when done.
`next dev` may add `.next-<you>/…` lines to `tsconfig.json` `include`; leave them.

## Rules added after the foundation review (Gemini ↔ Claude)

**Secrets never reach the browser.** The `weddings` row contains
`sitePassword`. Server Components may receive the full row, but anything
passed as a prop to a `"use client"` component is sent to the browser — pass
`toPublicWedding(wedding)` (src/lib/public-wedding.ts) or just the fields you
need. Same for households: never send `inviteToken` to a client component
except on the host's own household page.

**Use the status components** in `src/components/ui/status.tsx`
(`GuestEventBadge`, `HouseholdBadge`, `SiteBadge`, `VisibilityBadge`,
`GiftProgressBadge`, `PledgeBadge`, `ThankedBadge`, `DeliveryBadge`) instead
of writing status words and tones by hand.

**More UI kit pieces:** `CopyButton` (links, passwords, payment details),
`BackLink` (pass to `PageHeader back`), `MoneyInput`, `SearchInput`.
`ConfirmButton` now opens a proper dialog: give it `confirm` (the question)
and `detail` (the consequences, with real numbers, e.g. "42 RSVP answers will
be deleted"). `AudiencePicker` takes an optional `legend`.

**Deleting things that other things depend on** goes through
`src/lib/cleanup.ts`:
- events → `deleteEvent()` (archives the event's questions so answers survive);
- RSVP questions → `deleteOrArchiveQuestion()` / `archiveQuestion()` (follow-ups go with their parent);
- tags → `deleteTag()`, which refuses while a page, event, question or draft message is limited to that tag and returns where it's used (`tagUsage()`), so the couple can change those first.

**RSVP rules changed:** questions with no event are only asked of guests
coming to at least one event; a plus-one can only attend an event someone from
their invitation is attending; "Let guests change their RSVP" off now means
guests can still answer anything new but can't change what they already
answered. Stats: `openPlusOnes` counts only households still deciding;
`QuestionStats.removedOptionAnswers` counts answers to options that were
removed (show these — don't let them vanish); `guests.withoutEmail` counts
adults only, plus `householdsWithoutEmail`.

**Guest-site styling contract.** The site layout sets CSS variables on its
wrapper for the chosen theme (`--color-accent` and, per theme, the canvas /
surface / ink / line tokens). Guest-site components (RSVP, gifts) use the
token classes (`text-ink`, `bg-surface`, `border-line`, `bg-accent`,
`text-accent-strong`, `font-serif`) and never hard-coded colours, so they follow the
couple's theme automatically. Text in the accent colour uses
`text-accent-strong`, never `text-accent`: a pale accent (pastel pink) is
deepened there so it stays readable, while fills and borders keep the chosen
colour.

**Freshness.** Pages are rendered per request (Cache Components is off).
After a write, call `revalidateWedding()` (`src/lib/revalidate.ts`), which
refreshes the admin and the guest site wherever it's served.

**Email.** Pass `weddingId` to `sendEmail()`. In development (no
SMTP_HOST) emails go to the outbox; in production the outbox is never
written. `/admin/dev/outbox` must only show the signed-in host's wedding's emails.

**Types.** `pnpm typecheck` runs `next typegen` first; `.next-*` folders are
excluded, so `PageProps<…>` works regardless of other agents' dev servers.

**Event visibility on the guest site** comes from `src/lib/event-visibility.ts`
(`canSeeEvent`, `visibleEvents`). An event is hidden from visitors who haven't
found their invitation when it's limited to tags or the couple ticked "Only
show this event to invited guests" (`events.guestsOnly`). When something is
hidden, show a "find your invitation" prompt that never reveals what or how
many events are hidden. Anything that shows event details (schedule page,
calendar downloads) must use these functions.

**Gift pictures** are stored with `src/lib/uploads.ts` (uploads, or copied
from a shop page / image link with private-network blocking) and served from
`/uploads/<file>`. Never hotlink remote images.

## Site styles (Settings → Design)

The guest site has five complete styles in `src/lib/site-styles.ts`
(classic, modern, garden, editorial, minimal; stored in `weddings.theme`).
Each defines a palette, fonts and layout choices (header, nav, content
treatment, schedule / party / FAQ layout, radius, heading scale). The site
shell (`src/components/site/site-shell.tsx`) sets the palette as CSS tokens
on the site wrapper plus `data-style`; page bodies get the spec via
`pageStyle()` (`src/components/site/page-style.ts`) and switch layout on
`style.layout.*`. Guest-site components must use tokens (`text-ink`,
`bg-surface`, `border-line`, `bg-accent`, `text-accent-ink`, `font-serif`,
`rounded-[var(--radius-card)]`) so all five styles work automatically.
Hosts can preview any style with `?style=<id>&accent=%23rrggbb&embed=1`;
those parameters are ignored for guests. Garden's tinted paper takes the hue
of a custom accent (`paletteForAccent`), so a pink accent gets blush paper.

The browser-tab icon is the couple's initials on their accent colour
(`src/lib/couple-icon.tsx`, served by `icon.tsx` in `w/[slug]` and `admin`;
the root `icon.tsx` is a plain circle for sign-in pages).

## Status words

Labels and tones for every status live in `src/lib/status-words.ts`; the UI
kit's status badges, the guest list, the CSV export and the page manager all
read from it. Change wording there, nowhere else.

## Accounts and email

- Who can sign up: `src/lib/signup-policy.ts` (`ALLOWED_SIGNUP_EMAILS`,
  `SUPERUSER_EMAILS`, sign-up invites from `/site-admin`, co-host invites).
- When SMTP is configured, accounts must confirm their email
  (`requireVerifiedUser()`; `requireHost()` includes it). Single-use links for
  confirming and resetting passwords: `src/lib/account-emails.ts`.
- Co-host invites only work for the address they were sent to.

## Planning tools (host only)

Checklist, Budget & vendors (budget categories, vendors, vendor payments),
Seating and Day of (run sheet, music). None of it is ever shown on the guest
site. Pure rules and every planning number live in `src/lib/planning.ts`
(`computeBudget`, `paymentState`, `groupTasks`, `suggestedTasks`,
`seatingCandidates`, `sortRunSheet`); data loading in `src/lib/planning-data.ts`.
- **Budget:** only *booked* vendors count. A vendor costs the larger of its
  quote and its scheduled payments. "Forecast left" = total budget minus, per
  category, the larger of the estimate and what's booked.
- **Payments:** `paidOn` is the date ticked paid. "Due soon" = within
  `DUE_SOON_DAYS` (14); the dashboard lists overdue and due-soon payments.
- **Suggested content is opt-in.** Suggested budget categories and checklist
  tasks are only added when the couple clicks the button; tasks get due dates
  worked back from the wedding date (never in the past) and skip titles the
  couple already has.
- **Seating** lists every guest except those who declined every event they
  were asked about (same RSVP rules as the stats); dietary needs come from
  `computeStats`. Status words for vendors and payments are in `status-words.ts`.
