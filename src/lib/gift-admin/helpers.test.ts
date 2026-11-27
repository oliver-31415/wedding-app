import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE,
  MAX_NAME,
  buildReceivedEntries,
  centsToInputValue,
  extractLink,
  filterReceivedEntries,
  formatThankYouCopyList,
  itemStatusBadge,
  nameFromProductUrl,
  parseImageMode,
  parseReceivedFilter,
  planLinkFill,
  resolveImagePlan,
  sortGuestItems,
  storeNameForUrl,
  suggestStoreFromUrl,
  validateCashFundInput,
  validateGiftItemInput,
  validateGuestClaimInput,
  validateGuestPledgeInput,
  validateHttpUrl,
  validateOfflineGiftInput,
} from "./helpers";

describe("gift-admin helpers", () => {
  describe("validateHttpUrl", () => {
    it("allows blank and valid http/https URLs", () => {
      expect(validateHttpUrl("")).toEqual({ ok: true, value: null });
      expect(validateHttpUrl("   ")).toEqual({ ok: true, value: null });
      expect(validateHttpUrl("https://www.davidjones.com/item")).toEqual({
        ok: true,
        value: "https://www.davidjones.com/item",
      });
      expect(validateHttpUrl("http://example.com")).toEqual({
        ok: true,
        value: "http://example.com",
      });
    });

    it("rejects non-http(s) and malformed URLs", () => {
      expect(validateHttpUrl("javascript:alert(1)").ok).toBe(false);
      expect(validateHttpUrl("ftp://example.com").ok).toBe(false);
      expect(validateHttpUrl("davidjones.com").ok).toBe(false);
      expect(validateHttpUrl("not a url").ok).toBe(false);
    });
  });

  describe("suggestStoreFromUrl", () => {
    it("strips www. and lowercases hostname", () => {
      expect(suggestStoreFromUrl("https://www.davidjones.com/product/123")).toBe("davidjones.com");
      expect(suggestStoreFromUrl("https://WWW.BedThreads.com.au/sheets")).toBe("bedthreads.com.au");
      expect(suggestStoreFromUrl("http://shop.myer.com.au")).toBe("shop.myer.com.au");
    });

    it("returns null for invalid or non-http URLs", () => {
      expect(suggestStoreFromUrl("")).toBeNull();
      expect(suggestStoreFromUrl("javascript:alert(1)")).toBeNull();
      expect(suggestStoreFromUrl("not-a-url")).toBeNull();
    });
  });

  describe("centsToInputValue", () => {
    it("formats whole and fractional dollar amounts", () => {
      expect(centsToInputValue(null)).toBe("");
      expect(centsToInputValue(54900)).toBe("549");
      expect(centsToInputValue(54950)).toBe("549.50");
      expect(centsToInputValue(5)).toBe("0.05");
    });
  });

  describe("itemStatusBadge", () => {
    it("matches CONVENTIONS status vocabulary", () => {
      expect(itemStatusBadge({ claimed: 0, remaining: 3, complete: false }, 3)).toBeNull();
      expect(itemStatusBadge({ claimed: 2, remaining: 1, complete: false }, 3)).toEqual({
        label: "2 of 3 gifted",
        tone: "info",
      });
      expect(itemStatusBadge({ claimed: 3, remaining: 0, complete: true }, 3)).toEqual({
        label: "Gifted",
        tone: "good",
      });
    });
  });

  describe("sortGuestItems", () => {
    it("excludes hidden items, preserves host order, and moves fully gifted items to the end", () => {
      const items = [
        { id: "a", quantityWanted: 1, hidden: false, position: 0 },
        { id: "b", quantityWanted: 2, hidden: false, position: 1 },
        { id: "c", quantityWanted: 1, hidden: true, position: 2 },
        { id: "d", quantityWanted: 1, hidden: false, position: 3 },
      ];
      const claims = [
        { itemId: "a", quantity: 1, thankedAt: null },
        { itemId: "b", quantity: 1, thankedAt: null },
      ];
      const sorted = sortGuestItems(items, claims);
      expect(sorted.map((s) => s.item.id)).toEqual(["b", "d", "a"]);
      expect(sorted[0].progress).toEqual({ claimed: 1, remaining: 1, complete: false });
      expect(sorted[2].progress).toEqual({ claimed: 1, remaining: 0, complete: true });
    });
  });

  describe("validateGiftItemInput", () => {
    it("accepts valid input and rejects NaN price, bad URL, out-of-range quantity", () => {
      const ok = validateGiftItemInput({
        name: "Coffee machine",
        url: "https://example.com/coffee",
        storeName: "Breville",
        price: "$899.50",
        quantityWanted: "2",
        mostWanted: true,
        note: "Silver please",
        hidden: false,
      });
      expect(ok).toEqual({
        ok: true,
        value: {
          name: "Coffee machine",
          url: "https://example.com/coffee",
          storeName: "Breville",
          priceCents: 89950,
          quantityWanted: 2,
          mostWanted: true,
          note: "Silver please",
          hidden: false,
        },
      });

      const bad = validateGiftItemInput({
        name: "",
        url: "javascript:void(0)",
        storeName: "",
        price: "abc",
        quantityWanted: "100",
        mostWanted: false,
        note: "",
        hidden: false,
      });
      expect(bad.ok).toBe(false);
      if (!bad.ok) {
        expect(bad.errors.name).toBeDefined();
        expect(bad.errors.url).toBeDefined();
        expect(bad.errors.price).toBeDefined();
        expect(bad.errors.quantityWanted).toBeDefined();
      }
    });
  });

  describe("validateCashFundInput", () => {
    it("accepts optional goal and rejects invalid goal or URL", () => {
      const ok = validateCashFundInput({
        name: "Honeymoon",
        description: "Flights and hotels",
        goal: "",
        paymentInstructions: "PayID: couple@example.com",
        paymentUrl: "https://paypal.me/couple",
        hidden: false,
      });
      expect(ok.ok).toBe(true);

      const bad = validateCashFundInput({
        name: "Honeymoon",
        description: null,
        goal: "0",
        paymentInstructions: null,
        paymentUrl: "not-url",
        hidden: false,
      });
      expect(bad.ok).toBe(false);
      if (!bad.ok) {
        expect(bad.errors.goal).toBeDefined();
        expect(bad.errors.paymentUrl).toBeDefined();
      }
    });
  });

  describe("validateOfflineGiftInput", () => {
    it("validates item claims and fund contributions", () => {
      const fundOk = validateOfflineGiftInput({
        kind: "fund",
        itemId: null,
        fundId: "f1",
        giverName: "Uncle Bob",
        quantity: null,
        amount: "$150",
        message: "Enjoy Japan!",
      });
      expect(fundOk).toEqual({
        ok: true,
        value: { kind: "fund", fundId: "f1", giverName: "Uncle Bob", amountCents: 15000, message: "Enjoy Japan!" },
      });

      const itemOk = validateOfflineGiftInput({
        kind: "item",
        itemId: "i1",
        fundId: null,
        giverName: "Aunt Sue",
        quantity: "2",
        amount: null,
        message: "",
      });
      expect(itemOk).toEqual({
        ok: true,
        value: { kind: "item", itemId: "i1", giverName: "Aunt Sue", quantity: 2, message: null },
      });
    });
  });

  describe("guest claim and pledge validation", () => {
    it("enforces remaining quantity and length caps on claims", () => {
      const over = validateGuestClaimInput(
        { giverName: "Sam", giverEmail: "", quantity: "3", message: "" },
        2,
      );
      expect(over.ok).toBe(false);
      if (!over.ok) expect(over.errors.quantity).toBeDefined();

      const tooLong = validateGuestClaimInput(
        {
          giverName: "a".repeat(MAX_NAME + 1),
          giverEmail: "bad-email",
          quantity: "1",
          message: "m".repeat(MAX_MESSAGE + 1),
        },
        1,
      );
      expect(tooLong.ok).toBe(false);
      if (!tooLong.ok) {
        expect(tooLong.errors.giverName).toBeDefined();
        expect(tooLong.errors.giverEmail).toBeDefined();
        expect(tooLong.errors.message).toBeDefined();
      }
    });

    it("enforces positive amount and length caps on pledges", () => {
      const bad = validateGuestPledgeInput({ giverName: "", amount: "0", message: "m".repeat(MAX_MESSAGE + 1) });
      expect(bad.ok).toBe(false);
      if (!bad.ok) {
        expect(bad.errors.giverName).toBeDefined();
        expect(bad.errors.amount).toBeDefined();
        expect(bad.errors.message).toBeDefined();
      }

      const good = validateGuestPledgeInput({ giverName: "The Jones Family", amount: "250.50", message: "Congrats!" });
      expect(good).toEqual({
        ok: true,
        value: { giverName: "The Jones Family", amountCents: 25050, message: "Congrats!" },
      });
    });
  });

  describe("received list, filters, and copy text", () => {
    const t1 = new Date("2026-11-01T10:00:00Z");
    const t2 = new Date("2026-11-02T10:00:00Z");
    const t3 = new Date("2026-11-03T10:00:00Z");

    const entries = buildReceivedEntries({
      items: [{ id: "i1", name: "Linen sheet set" }],
      claims: [
        {
          id: "cl1",
          itemId: "i1",
          giverName: "David Jones",
          giverEmail: "david@example.com",
          quantity: 2,
          message: "Happy wedding!",
          thankedAt: null,
          createdAt: t2,
        },
      ],
      funds: [{ id: "f1", name: "Honeymoon in Japan" }],
      contributions: [
        {
          id: "co1",
          fundId: "f1",
          giverName: "Grace Liu",
          giverEmail: null,
          amountCents: 20000,
          message: "For the onsen!",
          received: true,
          thankedAt: t3,
          createdAt: t1,
        },
        {
          id: "co2",
          fundId: "f1",
          giverName: "Tom Nguyen",
          giverEmail: null,
          amountCents: 15000,
          message: null,
          received: false,
          thankedAt: null,
          createdAt: t3,
        },
      ],
    });

    it("combines and sorts newest first", () => {
      expect(entries.map((e) => e.id)).toEqual(["co2", "cl1", "co1"]);
    });

    it("filters all / to_thank / pledged", () => {
      expect(parseReceivedFilter("to_thank")).toBe("to_thank");
      expect(parseReceivedFilter("pledged")).toBe("pledged");
      expect(parseReceivedFilter("other")).toBe("all");

      expect(filterReceivedEntries(entries, "all").map((e) => e.id)).toEqual(["co2", "cl1", "co1"]);
      expect(filterReceivedEntries(entries, "to_thank").map((e) => e.id)).toEqual(["co2", "cl1"]);
      expect(filterReceivedEntries(entries, "pledged").map((e) => e.id)).toEqual(["co2"]);
    });

    it("formats plain-text thank-you copy list", () => {
      const text = formatThankYouCopyList(entries, "AUD");
      expect(text).toContain("Tom Nguyen — Honeymoon in Japan ($150, pledged)");
      expect(text).toContain('David Jones — Linen sheet set × 2 — "Happy wedding!"');
      expect(text).toContain('Grace Liu — Honeymoon in Japan ($200) — "For the onsen!"');
    });

    it("carries item imageUrl onto claim entries and defaults to null", () => {
      const withImg = buildReceivedEntries({
        items: [{ id: "i1", name: "Linen sheet set", imageUrl: "/uploads/sheets1234.jpg" }],
        claims: [
          {
            id: "cl1",
            itemId: "i1",
            giverName: "David Jones",
            giverEmail: null,
            quantity: 1,
            message: null,
            thankedAt: null,
            createdAt: t2,
          },
        ],
        funds: [],
        contributions: [],
      });
      expect(withImg[0]).toMatchObject({ kind: "claim", imageUrl: "/uploads/sheets1234.jpg" });
      const claimWithoutImg = entries.find((e) => e.kind === "claim");
      expect(claimWithoutImg && claimWithoutImg.kind === "claim" ? claimWithoutImg.imageUrl : undefined).toBeNull();
    });
  });

  describe("gift picture mode and plan", () => {
    it("parses valid image modes and falls back to keep", () => {
      expect(parseImageMode("upload")).toBe("upload");
      expect(parseImageMode("shop")).toBe("shop");
      expect(parseImageMode("url")).toBe("url");
      expect(parseImageMode("remove")).toBe("remove");
      expect(parseImageMode("keep")).toBe("keep");
      expect(parseImageMode("bogus")).toBe("keep");
      expect(parseImageMode(null)).toBe("keep");
    });

    it("auto-imports from shop link on add when no picture was chosen", () => {
      expect(
        resolveImagePlan({
          isEdit: false,
          mode: "keep",
          hasFile: false,
          shopUrl: "https://shop.example/kettle",
          imageLink: null,
        }),
      ).toEqual({
        ok: true,
        plan: { kind: "shop", url: "https://shop.example/kettle", required: false },
      });

      // On edit, keeping leaves the existing picture alone even if shopUrl is present
      expect(
        resolveImagePlan({
          isEdit: true,
          mode: "keep",
          hasFile: false,
          shopUrl: "https://shop.example/kettle",
          imageLink: null,
        }),
      ).toEqual({ ok: true, plan: { kind: "keep" } });
    });

    it("validates explicit upload, shop, url, and remove modes", () => {
      expect(
        resolveImagePlan({ isEdit: false, mode: "upload", hasFile: false, shopUrl: null, imageLink: null }).ok,
      ).toBe(false);
      expect(
        resolveImagePlan({ isEdit: false, mode: "upload", hasFile: true, shopUrl: null, imageLink: null }),
      ).toEqual({ ok: true, plan: { kind: "upload" } });

      expect(
        resolveImagePlan({ isEdit: true, mode: "shop", hasFile: false, shopUrl: null, imageLink: null }).ok,
      ).toBe(false);
      // Avoids duplicate error when the store link itself already failed URL validation
      expect(
        resolveImagePlan({
          isEdit: true,
          mode: "shop",
          hasFile: false,
          shopUrl: null,
          shopUrlInvalid: true,
          imageLink: null,
        }),
      ).toEqual({ ok: true, plan: { kind: "keep" } });
      expect(
        resolveImagePlan({
          isEdit: true,
          mode: "shop",
          hasFile: false,
          shopUrl: "https://shop.example/kettle",
          imageLink: null,
        }),
      ).toEqual({ ok: true, plan: { kind: "shop", url: "https://shop.example/kettle", required: true } });

      expect(
        resolveImagePlan({ isEdit: true, mode: "url", hasFile: false, shopUrl: null, imageLink: "" }).ok,
      ).toBe(false);
      expect(
        resolveImagePlan({ isEdit: true, mode: "url", hasFile: false, shopUrl: null, imageLink: "javascript:alert(1)" })
          .ok,
      ).toBe(false);
      expect(
        resolveImagePlan({
          isEdit: true,
          mode: "url",
          hasFile: false,
          shopUrl: null,
          imageLink: "https://cdn.example/kettle.jpg",
        }),
      ).toEqual({ ok: true, plan: { kind: "url", url: "https://cdn.example/kettle.jpg" } });

      expect(
        resolveImagePlan({ isEdit: true, mode: "remove", hasFile: false, shopUrl: "https://shop.example/a", imageLink: null }),
      ).toEqual({ ok: true, plan: { kind: "remove" } });
    });

    it("falls back to file or pasted link if submitted under keep mode", () => {
      expect(
        resolveImagePlan({ isEdit: true, mode: "keep", hasFile: true, shopUrl: null, imageLink: null }),
      ).toEqual({ ok: true, plan: { kind: "upload" } });
      expect(
        resolveImagePlan({
          isEdit: false,
          mode: "keep",
          hasFile: false,
          shopUrl: "https://shop.example/kettle",
          imageLink: "https://cdn.example/kettle.png",
        }),
      ).toEqual({ ok: true, plan: { kind: "url", url: "https://cdn.example/kettle.png" } });
    });
  });
});

describe("filling a gift from a link", () => {
  it("finds the link in pasted share text and bare addresses", () => {
    expect(extractLink("https://www.amazon.com.au/dp/B07PGL2WVS")).toBe("https://www.amazon.com.au/dp/B07PGL2WVS");
    expect(extractLink("Check out this item on Amazon https://amzn.asia/d/3wFXbRz")).toBe("https://amzn.asia/d/3wFXbRz");
    expect(extractLink("Le Creuset Dutch Oven : Amazon.com.au: Home\nhttps://a.co/d/abc123.")).toBe("https://a.co/d/abc123");
    expect(extractLink("www.davidjones.com/home/123")).toBe("https://www.davidjones.com/home/123");
    expect(extractLink("bedthreads.com.au/products/sheets")).toBe("https://bedthreads.com.au/products/sheets");
    expect(extractLink("  ")).toBeNull();
    expect(extractLink("a lovely casserole")).toBeNull();
    expect(extractLink("e.g. the blue one")).toBeNull();
    expect(extractLink("javascript:alert(1)")).toBeNull();
  });

  it("names the store, and reads Amazon's product name from its link", () => {
    expect(storeNameForUrl("https://www.amazon.com.au/dp/B0")).toBe("Amazon");
    expect(storeNameForUrl("https://amzn.asia/d/x")).toBe("Amazon");
    expect(storeNameForUrl("https://www.jbhifi.com.au/products/x")).toBe("JB Hi-Fi");
    expect(storeNameForUrl("https://shop.example.com/x")).toBe("shop.example.com");
    expect(nameFromProductUrl("https://www.amazon.com.au/Le-Creuset-Signature-Casserole/dp/B07PGL2WVS/ref=sr_1_3")).toBe(
      "Le Creuset Signature Casserole",
    );
    expect(nameFromProductUrl("https://www.amazon.com.au/dp/B07PGL2WVS")).toBeNull();
    expect(nameFromProductUrl("https://www.myer.com.au/Le-Creuset/dp/1")).toBeNull();
  });

  it("replaces every detail the new page has, and clears what only the last link filled", () => {
    const first = planLinkFill({ name: "", storeName: "", price: "" }, {}, { name: "Toaster", storeName: "Kmart", price: "49" });
    expect(first).toEqual({ values: { name: "Toaster", storeName: "Kmart", price: "49" }, filled: ["name", "storeName", "price"], missing: [] });

    // A second link with no price: the toaster's price must not stay behind.
    const second = planLinkFill(first.values, first.values, { name: "Kettle", storeName: "Amazon", price: null });
    expect(second.values).toEqual({ name: "Kettle", storeName: "Amazon", price: "" });
    expect(second.missing).toEqual(["price"]);

    // A price the couple typed themselves is kept when the page has none, and replaced when it has one.
    expect(planLinkFill({ name: "Kettle", storeName: "", price: "80" }, { name: "Kettle" }, { name: null, storeName: null, price: null }).values)
      .toEqual({ name: "", storeName: "", price: "80" });
    expect(planLinkFill({ name: "Mine", storeName: "", price: "80" }, {}, { name: "Theirs", storeName: null, price: "95" }).values)
      .toEqual({ name: "Theirs", storeName: "", price: "95" });
  });
});
