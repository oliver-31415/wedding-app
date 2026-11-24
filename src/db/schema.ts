/**
 * Database schema. One wedding per couple; every row below a wedding carries
 * `weddingId` so a query can always be scoped to the signed-in host's wedding.
 *
 * Conventions (see docs/CONVENTIONS.md):
 * - ids are random text ids from `newId()`.
 * - money is integer cents in the wedding's currency.
 * - instants (createdAt, sentAt…) are unix ms; wall-clock event times are
 *   "YYYY-MM-DDTHH:mm" strings interpreted in `weddings.timeZone`.
 * - `position` orders anything the host can drag to reorder (0-based).
 * - Nothing has default display content. Optional text is null when empty and
 *   the guest site renders nothing for null.
 */
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const weddingId = () =>
  text("wedding_id")
    .notNull()
    .references(() => weddings.id, { onDelete: "cascade" });
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const position = () => integer("position").notNull().default(0);

/** Who can see something: everyone, or only guests carrying one of the tags. */
export type Audience = { mode: "all" } | { mode: "tags"; tagIds: string[] };
const audience = (name = "audience") =>
  text(name, { mode: "json" })
    .$type<Audience>()
    .notNull()
    .default(sql`'{"mode":"all"}'`);

// ---------------------------------------------------------------- accounts

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Set once they click the link in the verification email (or reset their password). */
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

/** Single-use links emailed to account holders: verify an address, or reset a password. */
export const accountTokens = sqliteTable(
  "account_tokens",
  {
    /** sha256 of the token in the link. */
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: ["verify_email", "reset_password"] }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("account_tokens_user").on(t.userId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    /** sha256 of the cookie token; the raw token is never stored. */
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

// ---------------------------------------------------------------- wedding

export const weddings = sqliteTable("weddings", {
  id: id(),
  /** Public URL: /w/{slug} */
  slug: text("slug").notNull().unique(),
  partnerOne: text("partner_one").notNull(),
  partnerTwo: text("partner_two").notNull(),
  /** "YYYY-MM-DD" or null when not decided yet. */
  date: text("date"),
  locationName: text("location_name"),
  timeZone: text("time_zone").notNull().default("Australia/Sydney"),
  currency: text("currency").notNull().default("AUD"),

  published: integer("published", { mode: "boolean" }).notNull().default(false),
  /** Shared guest code for password-protected pages. Null = no password set. */
  sitePassword: text("site_password"),
  /** When false the site sends noindex. */
  searchVisible: integer("search_visible", { mode: "boolean" })
    .notNull()
    .default(false),

  theme: text("theme").notNull().default("classic"),
  accentColor: text("accent_color").notNull().default("#7c5c3e"),

  /** RSVP rules — see src/lib/rsvp. */
  rsvpOpen: integer("rsvp_open", { mode: "boolean" }).notNull().default(true),
  /** "YYYY-MM-DD"; RSVPs close at the end of this day in `timeZone`. */
  rsvpDeadline: text("rsvp_deadline"),
  /** Guests may change an RSVP they already sent, until the deadline. */
  rsvpAllowEdits: integer("rsvp_allow_edits", { mode: "boolean" })
    .notNull()
    .default(true),
  /** Shown after RSVPs close. Null = a plain "RSVPs are closed" line. */
  rsvpClosedMessage: text("rsvp_closed_message"),

  createdAt: createdAt(),
});

export const weddingMembers = sqliteTable(
  "wedding_members",
  {
    weddingId: weddingId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "cohost"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.weddingId, t.userId] }),
    // One wedding per person.
    uniqueIndex("wedding_members_user").on(t.userId),
  ],
);

export const cohostInvites = sqliteTable("cohost_invites", {
  /** sha256 of the invite token. */
  id: id(),
  weddingId: weddingId(),
  email: text("email").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

/**
 * Single-use links that let someone create an account on this server
 * (when sign-up is invite-only). Created by super users (SUPERUSER_EMAILS).
 */
export const signupInvites = sqliteTable("signup_invites", {
  /** sha256 of the token in the link. */
  id: id(),
  /** If set, only this email address can use the invite. */
  email: text("email"),
  note: text("note"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- website

export const PAGE_TYPES = [
  "home",
  "schedule",
  "story",
  "party",
  "faq",
  "gifts",
  "rsvp",
  "photos",
  "custom",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_VISIBILITY = ["public", "password", "guests", "hidden"] as const;
export type PageVisibility = (typeof PAGE_VISIBILITY)[number];

/**
 * A page exists only once the host adds it. Every type except "custom" can be
 * added at most once (enforced in src/lib/pages.ts).
 */
export const pages = sqliteTable(
  "pages",
  {
    id: id(),
    weddingId: weddingId(),
    type: text("type", { enum: PAGE_TYPES }).notNull(),
    title: text("title").notNull(),
    /** URL segment under /w/{slug}/. Home has slug "". */
    slug: text("slug").notNull(),
    /** Optional intro text shown above the page's items. */
    body: text("body"),
    visibility: text("visibility", { enum: PAGE_VISIBILITY })
      .notNull()
      .default("public"),
    /** Only used when visibility = "guests". */
    audience: audience(),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pages_wedding_slug").on(t.weddingId, t.slug)],
);

/**
 * Ordered entries on story / party / faq pages.
 *  story: title = heading,  body = text
 *  party: title = name,     subtitle = role, body = bio
 *  faq:   title = question, body = answer
 */
export const pageItems = sqliteTable(
  "page_items",
  {
    id: id(),
    weddingId: weddingId(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    body: text("body"),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("page_items_page").on(t.pageId)],
);

// ---------------------------------------------------------------- photos

export const PHOTO_KINDS = ["cover", "item", "gallery"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/**
 * Curated photos (no video, ever). Caps live in src/lib/photos-shared.ts.
 *  cover:   one per wedding, shown on the Home page
 *  item:    one per story milestone / wedding-party member (`pageItemId`)
 *  gallery: up to 12 on the Photos page (`pageId`), ordered by `position`
 * Files live in UPLOAD_DIR; delete them with the row (src/lib/photos.ts).
 */
export const photos = sqliteTable(
  "photos",
  {
    id: id(),
    weddingId: weddingId(),
    kind: text("kind", { enum: PHOTO_KINDS }).notNull(),
    pageItemId: text("page_item_id").references(() => pageItems.id, { onDelete: "cascade" }),
    pageId: text("page_id").references(() => pages.id, { onDelete: "cascade" }),
    /** /uploads/<file> */
    url: text("url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Null = a sensible fallback when rendered (see the site photo components). */
    alt: text("alt"),
    caption: text("caption"),
    /** CSS object-position for crops, e.g. "50% 20%". */
    focus: text("focus").notNull(),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("photos_one_cover").on(t.weddingId).where(sql`${t.kind} = 'cover'`),
    uniqueIndex("photos_one_per_item").on(t.pageItemId),
    index("photos_page").on(t.pageId, t.position),
    check(
      "photos_owner",
      sql`(${t.kind} = 'cover' AND ${t.pageItemId} IS NULL AND ${t.pageId} IS NULL) OR (${t.kind} = 'item' AND ${t.pageItemId} IS NOT NULL AND ${t.pageId} IS NULL) OR (${t.kind} = 'gallery' AND ${t.pageId} IS NOT NULL AND ${t.pageItemId} IS NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------- events

export const events = sqliteTable(
  "events",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    description: text("description"),
    /** "YYYY-MM-DDTHH:mm" wall-clock in the wedding time zone; null = time TBA. */
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    venueName: text("venue_name"),
    address: text("address"),
    dressCode: text("dress_code"),
    /** Who is invited. Invitation drives schedule visibility AND RSVP. */
    audience: audience(),
    /**
     * Hide this event from visitors who haven't found their invitation (or
     * aren't invited to it). Tag-limited events are always hidden that way.
     */
    guestsOnly: integer("guests_only", { mode: "boolean" }).notNull().default(false),
    /** Ask invited guests to RSVP to this event. */
    rsvpEnabled: integer("rsvp_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("events_wedding").on(t.weddingId)],
);

// ---------------------------------------------------------------- guests

/**
 * A household is the unit that RSVPs together (Withjoy's "party"). Every guest
 * belongs to exactly one; a single guest is a household of one.
 */
export const households = sqliteTable(
  "households",
  {
    id: id(),
    weddingId: weddingId(),
    /** Name on the envelope, e.g. "The Jones Family". Null = derived from members. */
    envelopeName: text("envelope_name"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postcode: text("postcode"),
    country: text("country"),
    /** How many extra people this household may bring (named at RSVP). */
    plusOnesAllowed: integer("plus_ones_allowed").notNull().default(0),
    /** Secret for personal RSVP links: /w/{slug}/i/{token}. */
    inviteToken: text("invite_token").notNull().unique(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("households_wedding").on(t.weddingId)],
);

export const guests = sqliteTable(
  "guests",
  {
    id: id(),
    weddingId: weddingId(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    ageGroup: text("age_group", { enum: ["adult", "child"] })
      .notNull()
      .default("adult"),
    /** Set when the guest was added as a plus-one at RSVP time. */
    isPlusOne: integer("is_plus_one", { mode: "boolean" })
      .notNull()
      .default(false),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [
    index("guests_wedding").on(t.weddingId),
    index("guests_household").on(t.householdId),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tags_wedding_name").on(t.weddingId, t.name)],
);

export const guestTags = sqliteTable(
  "guest_tags",
  {
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.guestId, t.tagId] }), index("guest_tags_tag").on(t.tagId)],
);

// ---------------------------------------------------------------- RSVP

/** One row per guest per event once answered. No row = not answered yet. */
export const eventResponses = sqliteTable(
  "event_responses",
  {
    weddingId: weddingId(),
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    attending: integer("attending", { mode: "boolean" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guestId, t.eventId] }),
    index("event_responses_wedding").on(t.weddingId),
    index("event_responses_event").on(t.eventId),
  ],
);

export const QUESTION_TYPES = ["choice", "text"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionOption = { id: string; label: string };

/**
 * When a question is asked (all must hold — see src/lib/rsvp/model.ts):
 *  - the guest is in `audience`;
 *  - if `eventId` is set, the guest is attending that event
 *    (e.g. meal choice for the reception); if not, the guest is attending
 *    at least one event (or has none to RSVP to);
 *  - if `parentQuestionId` is set, the guest answered `parentOptionId` to it.
 * scope "household" questions are asked once per household, not per guest.
 */
export const questions = sqliteTable(
  "questions",
  {
    id: id(),
    weddingId: weddingId(),
    type: text("type", { enum: QUESTION_TYPES }).notNull(),
    label: text("label").notNull(),
    options: text("options", { mode: "json" })
      .$type<QuestionOption[]>()
      .notNull()
      .default(sql`'[]'`),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    scope: text("scope", { enum: ["guest", "household"] })
      .notNull()
      .default("guest"),
    /** Deleting an event archives its questions (src/lib/cleanup.ts); the FK only nulls it as a fallback. */
    eventId: text("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    parentQuestionId: text("parent_question_id"),
    parentOptionId: text("parent_option_id"),
    audience: audience(),
    /** Questions with answers are archived instead of deleted. */
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("questions_wedding").on(t.weddingId)],
);

/** guestId is set for guest-scope questions, householdId for household-scope. */
export const answers = sqliteTable(
  "answers",
  {
    id: id(),
    weddingId: weddingId(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    guestId: text("guest_id").references(() => guests.id, {
      onDelete: "cascade",
    }),
    householdId: text("household_id").references(() => households.id, {
      onDelete: "cascade",
    }),
    /** Option id for "choice", free text for "text". */
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("answers_question").on(t.questionId),
    index("answers_wedding").on(t.weddingId),
    uniqueIndex("answers_question_guest").on(t.questionId, t.guestId),
    uniqueIndex("answers_question_household").on(t.questionId, t.householdId),
    // Exactly one of guest / household.
    check("answers_owner", sql`(${t.guestId} IS NULL) <> (${t.householdId} IS NULL)`),
  ],
);

/** Append-only log of RSVP submissions, for the activity feed. */
export const rsvpActivity = sqliteTable(
  "rsvp_activity",
  {
    id: id(),
    weddingId: weddingId(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["guest", "host"] }).notNull(),
    /** "first" for a household's first RSVP, "update" afterwards. */
    kind: text("kind", { enum: ["first", "update"] }).notNull(),
    /** Free-text note to the couple, if the guest left one. */
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("rsvp_activity_wedding").on(t.weddingId), index("rsvp_activity_household").on(t.householdId)],
);

// ---------------------------------------------------------------- gifts

export const giftItems = sqliteTable(
  "gift_items",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    url: text("url"),
    storeName: text("store_name"),
    priceCents: integer("price_cents"),
    /** "/uploads/<file>" (stored by src/lib/uploads.ts) or null. Never a remote hotlink. */
    imageUrl: text("image_url"),
    quantityWanted: integer("quantity_wanted").notNull().default(1),
    mostWanted: integer("most_wanted", { mode: "boolean" })
      .notNull()
      .default(false),
    note: text("note"),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("gift_items_wedding").on(t.weddingId)],
);

/** A guest saying "I bought this". */
export const giftClaims = sqliteTable(
  "gift_claims",
  {
    id: id(),
    weddingId: weddingId(),
    itemId: text("item_id")
      .notNull()
      .references(() => giftItems.id, { onDelete: "cascade" }),
    giverName: text("giver_name").notNull(),
    giverEmail: text("giver_email"),
    quantity: integer("quantity").notNull().default(1),
    message: text("message"),
    thankedAt: integer("thanked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("gift_claims_wedding").on(t.weddingId), index("gift_claims_item").on(t.itemId), check("gift_claims_quantity", sql`${t.quantity} > 0`)],
);

/** Money goes straight to the couple; the app only records pledges. */
export const cashFunds = sqliteTable(
  "cash_funds",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    description: text("description"),
    goalCents: integer("goal_cents"),
    /** e.g. bank details or PayID, shown to guests. */
    paymentInstructions: text("payment_instructions"),
    paymentUrl: text("payment_url"),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("cash_funds_wedding").on(t.weddingId)],
);

export const fundContributions = sqliteTable(
  "fund_contributions",
  {
    id: id(),
    weddingId: weddingId(),
    fundId: text("fund_id")
      .notNull()
      .references(() => cashFunds.id, { onDelete: "cascade" }),
    giverName: text("giver_name").notNull(),
    giverEmail: text("giver_email"),
    amountCents: integer("amount_cents").notNull(),
    message: text("message"),
    /** Host ticks this once the money has actually arrived. */
    received: integer("received", { mode: "boolean" }).notNull().default(false),
    thankedAt: integer("thanked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("fund_contributions_wedding").on(t.weddingId), index("fund_contributions_fund").on(t.fundId), check("fund_contributions_amount", sql`${t.amountCents} > 0`)],
);

// ---------------------------------------------------------------- messaging

export const MESSAGE_KINDS = [
  "custom",
  "save_the_date",
  "invitation",
  "rsvp_reminder",
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Recipient filter: audience tags AND (optionally) household RSVP status. */
export type MessageRecipients = {
  audience: Audience;
  rsvpStatus: "any" | "not_responded" | "responded" | "attending" | "declined";
};

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    weddingId: weddingId(),
    kind: text("kind", { enum: MESSAGE_KINDS }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    /** Where the email's button points; null = no button. */
    buttonTarget: text("button_target", { enum: ["site", "rsvp", "gifts"] }),
    buttonLabel: text("button_label"),
    recipients: text("recipients", { mode: "json" })
      .$type<MessageRecipients>()
      .notNull(),
    status: text("status", { enum: ["draft", "sent"] })
      .notNull()
      .default("draft"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_wedding").on(t.weddingId)],
);

export const messageDeliveries = sqliteTable(
  "message_deliveries",
  {
    id: id(),
    weddingId: weddingId(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    guestId: text("guest_id").references(() => guests.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    status: text("status", { enum: ["sent", "failed"] }).notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("deliveries_message").on(t.messageId)],
);

/**
 * Development only: when email isn't configured (no SMTP_HOST), emails
 * are stored here instead of being sent. Never written in production.
 */
export const outbox = sqliteTable("outbox", {
  id: id(),
  /** Null for emails not tied to a wedding (e.g. account emails). */
  weddingId: text("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- relations

export const householdRelations = relations(households, ({ many }) => ({
  guests: many(guests),
}));
export const guestRelations = relations(guests, ({ one, many }) => ({
  household: one(households, {
    fields: [guests.householdId],
    references: [households.id],
  }),
  tags: many(guestTags),
}));
export const guestTagRelations = relations(guestTags, ({ one }) => ({
  guest: one(guests, { fields: [guestTags.guestId], references: [guests.id] }),
  tag: one(tags, { fields: [guestTags.tagId], references: [tags.id] }),
}));
export const pageRelations = relations(pages, ({ many }) => ({
  items: many(pageItems),
}));
export const pageItemRelations = relations(pageItems, ({ one }) => ({
  page: one(pages, { fields: [pageItems.pageId], references: [pages.id] }),
}));
