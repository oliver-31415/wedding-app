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

  /**
   * Secret in the shared "send us your contact details" link (/contact/{token}).
   * Null = the collector is off. Replies through it wait for the couple's
   * review; personal links use the household's inviteToken and apply directly.
   */
  contactCollectorToken: text("contact_collector_token").unique(),

  /** Overall budget for the planning tools (host only). Null = not set. */
  budgetCents: integer("budget_cents"),

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

export const PHOTO_KINDS = ["cover", "page", "item", "gallery"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/**
 * Curated photos (no video, ever). Caps live in src/lib/photos-shared.ts.
 *  cover:   one per wedding: the Home page's photo, and the fallback for pages
 *           without their own in designs that always show one (Split)
 *  page:    one per page (`pageId`): that page's own photo
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
    uniqueIndex("photos_one_per_page").on(t.pageId).where(sql`${t.kind} = 'page'`),
    index("photos_page").on(t.pageId, t.position),
    check(
      "photos_owner",
      sql`(${t.kind} = 'cover' AND ${t.pageItemId} IS NULL AND ${t.pageId} IS NULL) OR (${t.kind} = 'item' AND ${t.pageItemId} IS NOT NULL AND ${t.pageId} IS NULL) OR (${t.kind} IN ('page', 'gallery') AND ${t.pageId} IS NOT NULL AND ${t.pageItemId} IS NULL)`,
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

/** "dietary" is a fixed tick-list plus a note (src/lib/rsvp/dietary.ts); at most one active per wedding. */
export const QUESTION_TYPES = ["choice", "text", "dietary"] as const;
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
  (t) => [
    index("questions_wedding").on(t.weddingId),
    uniqueIndex("questions_one_dietary").on(t.weddingId).where(sql`${t.type} = 'dietary' AND ${t.archived} = 0`),
  ],
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

/** How a message reached someone. Everything but "email" is recorded by the couple. */
export const DELIVERY_METHODS = ["email", "post", "text", "in_person", "other"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

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
    /** The address emailed; null when it was delivered another way. */
    email: text("email"),
    /** "email" = sent by this app; the others are marked by the couple. */
    method: text("method", { enum: DELIVERY_METHODS }).notNull().default("email"),
    /**
     * "queued" = waiting for room under the email limits (src/lib/email-quota.ts);
     * only ever with method "email". createdAt is when it was queued or recorded.
     */
    status: text("status", { enum: ["queued", "sent", "failed"] }).notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("deliveries_message").on(t.messageId),
    check("deliveries_email_or_other", sql`(${t.method} = 'email') = (${t.email} IS NOT NULL)`),
  ],
);

/** A person who filled in the contact details form. */
export type ContactPerson = { firstName: string; lastName: string; email: string | null; phone: string | null };
export type ContactAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
};

/**
 * Replies to the contact details form. Shared-link replies are "pending"
 * until the couple applies them to a household (or dismisses them);
 * personal-link replies are applied straight away and kept as a record.
 */
export const contactSubmissions = sqliteTable(
  "contact_submissions",
  {
    id: id(),
    weddingId: weddingId(),
    people: text("people", { mode: "json" }).$type<ContactPerson[]>().notNull(),
    address: text("address", { mode: "json" }).$type<ContactAddress>().notNull(),
    note: text("note"),
    /** Personal link: the household it came from. Shared link: the household it was applied to. */
    householdId: text("household_id").references(() => households.id, { onDelete: "set null" }),
    via: text("via", { enum: ["shared", "personal"] }).notNull(),
    status: text("status", { enum: ["pending", "applied", "dismissed"] }).notNull().default("pending"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("contact_submissions_wedding").on(t.weddingId, t.status)],
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

// ---------------------------------------------------------------- planning
// Host-only planning tools. Nothing here ever appears on the guest site.

/** A budget line the couple plans for, e.g. "Venue" with an estimate. */
export const budgetCategories = sqliteTable(
  "budget_categories",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    /** What the couple expects to spend; null = not estimated yet. */
    estimateCents: integer("estimate_cents"),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("budget_categories_wedding").on(t.weddingId)],
);

export const VENDOR_STATUSES = ["considering", "booked"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const vendors = sqliteTable(
  "vendors",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    /** Which budget line this vendor's payments count towards. */
    categoryId: text("category_id").references(() => budgetCategories.id, { onDelete: "set null" }),
    status: text("status", { enum: VENDOR_STATUSES }).notNull().default("considering"),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    /** Quoted total for the whole booking; payments are what's scheduled against it. */
    quoteCents: integer("quote_cents"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("vendors_wedding").on(t.weddingId)],
);

/** A deposit, instalment or final balance owed to a vendor. */
export const vendorPayments = sqliteTable(
  "vendor_payments",
  {
    id: id(),
    weddingId: weddingId(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** "YYYY-MM-DD" or null when no date is agreed. */
    dueDate: text("due_date"),
    /** "YYYY-MM-DD" the couple marked it paid; null = still to pay. */
    paidOn: text("paid_on"),
    createdAt: createdAt(),
  },
  (t) => [index("vendor_payments_wedding").on(t.weddingId), index("vendor_payments_vendor").on(t.vendorId)],
);

/** Checklist to-do. */
export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    weddingId: weddingId(),
    title: text("title").notNull(),
    notes: text("notes"),
    /** "YYYY-MM-DD" or null. */
    dueDate: text("due_date"),
    /** One of the hosts, or null = anyone. */
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_wedding").on(t.weddingId)],
);

/** A reception table for the seating plan. */
export const seatingTables = sqliteTable(
  "seating_tables",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(10),
    notes: text("notes"),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("seating_tables_wedding").on(t.weddingId)],
);

/** Which table a guest sits at. One row per seated guest. */
export const seatAssignments = sqliteTable(
  "seat_assignments",
  {
    guestId: text("guest_id")
      .primaryKey()
      .references(() => guests.id, { onDelete: "cascade" }),
    weddingId: weddingId(),
    tableId: text("table_id")
      .notNull()
      .references(() => seatingTables.id, { onDelete: "cascade" }),
  },
  (t) => [index("seat_assignments_wedding").on(t.weddingId), index("seat_assignments_table").on(t.tableId)],
);

/** One line of the wedding-day run sheet. */
export const runSheetItems = sqliteTable(
  "run_sheet_items",
  {
    id: id(),
    weddingId: weddingId(),
    /** "HH:mm" on the wedding day; null = untimed (listed last). */
    time: text("time"),
    title: text("title").notNull(),
    location: text("location"),
    /** Who's responsible / involved, e.g. "Photographer, bridal party". */
    who: text("who"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("run_sheet_items_wedding").on(t.weddingId)],
);

/** Songs for the DJ / band: must-plays per moment and do-not-plays. */
export const songs = sqliteTable(
  "songs",
  {
    id: id(),
    weddingId: weddingId(),
    /** e.g. "First dance", "Walking down the aisle"; null = general request. */
    moment: text("moment"),
    title: text("title").notNull(),
    artist: text("artist"),
    doNotPlay: integer("do_not_play", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("songs_wedding").on(t.weddingId)],
);

/**
 * One row per email this server sends (or stores in the dev outbox), so
 * bulk sends can stay under the email provider's daily and monthly limits.
 * Counted across all weddings: they share one email account.
 */
export const emailSends = sqliteTable(
  "email_sends",
  {
    id: id(),
    weddingId: text("wedding_id").references(() => weddings.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("email_sends_created").on(t.createdAt)],
);

/**
 * Someone who couldn't find their invitation by name and asked the couple to
 * check. Accepting one links the typed name to a guest (so the same spelling
 * finds them straight away next time) and emails them their invitation link.
 */
export const nameRequests = sqliteTable(
  "name_requests",
  {
    id: id(),
    weddingId: weddingId(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    note: text("note"),
    status: text("status", { enum: ["pending", "accepted", "dismissed"] }).notNull().default("pending"),
    /** Accepted: the guest this name belongs to. */
    guestId: text("guest_id").references(() => guests.id, { onDelete: "set null" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("name_requests_wedding").on(t.weddingId, t.status)],
);

// ---------------------------------------------------------------- helpers (Day of run sheet)

/** People helping on the day. Each has a private page (/helper/{token}) listing their jobs. */
export const helpers = sqliteTable(
  "helpers",
  {
    id: id(),
    weddingId: weddingId(),
    name: text("name").notNull(),
    /** e.g. "Bridesmaid", "MC". */
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    /** Secret in the helper's page link. */
    token: text("token").notNull().unique(),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("helpers_wedding").on(t.weddingId)],
);

/** Something that needs doing for an item on the Day of run sheet. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: id(),
    weddingId: weddingId(),
    runSheetItemId: text("run_sheet_item_id")
      .notNull()
      .references(() => runSheetItems.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    /** "HH:mm" on the wedding day; null = no set time (it happens at the item's time). */
    startTime: text("start_time"),
    endTime: text("end_time"),
    position: position(),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_wedding").on(t.weddingId), index("jobs_item").on(t.runSheetItemId)],
);

export const jobHelpers = sqliteTable(
  "job_helpers",
  {
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    helperId: text("helper_id")
      .notNull()
      .references(() => helpers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.helperId] }), index("job_helpers_helper").on(t.helperId)],
);

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
