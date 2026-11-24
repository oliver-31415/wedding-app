import { describe, expect, it } from "vitest";
import { renderMessage, type RenderWedding } from "./render";

const wedding: RenderWedding = {
  slug: "alex-and-sam",
  partnerOne: "Alex",
  partnerTwo: "Sam",
  date: "2027-03-13",
  accentColor: "#7c5c3e",
};

describe("renderMessage", () => {
  it("substitutes guest and partner tokens across subject, body and button label", () => {
    const out = renderMessage({
      wedding,
      message: {
        subject: "Hi {first_name} — from {partner_one} & {partner_two}",
        body: "Hi {first_name},\n\nLove from {partner_one} & {partner_two}.",
        buttonTarget: "site",
        buttonLabel: "Visit {partner_one} & {partner_two}",
      },
      recipient: { firstName: "Maya" },
      inviteToken: "tok123",
      baseUrl: "https://ourwedding.com.au",
    });

    expect(out.subject).toBe("Hi Maya — from Alex & Sam");
    expect(out.text).toContain("Hi Maya,");
    expect(out.text).toContain("Love from Alex & Sam.");
    expect(out.text).toContain("Visit Alex & Sam: https://ourwedding.com.au/w/alex-and-sam");
    expect(out.html).toContain("Alex &amp; Sam");
    expect(out.html).toContain("Hi Maya,");
    expect(out.html).toContain("Saturday 13 March 2027");
    expect(out.html).toContain("#7c5c3e");
  });

  it("builds site, personal RSVP, and gifts button URLs", () => {
    const base = {
      wedding,
      recipient: { firstName: "Jordan" },
      inviteToken: "secret-token-42",
      baseUrl: "https://example.com/",
    };

    const site = renderMessage({
      ...base,
      message: { subject: "S", body: "B", buttonTarget: "site", buttonLabel: "Site" },
    });
    expect(site.html).toContain('href="https://example.com/w/alex-and-sam"');

    const rsvp = renderMessage({
      ...base,
      message: { subject: "S", body: "B", buttonTarget: "rsvp", buttonLabel: "RSVP" },
    });
    expect(rsvp.html).toContain('href="https://example.com/w/alex-and-sam/i/secret-token-42"');

    const gifts = renderMessage({
      ...base,
      message: { subject: "S", body: "B", buttonTarget: "gifts", buttonLabel: "Gifts" },
    });
    expect(gifts.html).toContain('href="https://example.com/w/alex-and-sam/gifts"');

    const none = renderMessage({
      ...base,
      message: { subject: "S", body: "B", buttonTarget: null, buttonLabel: null },
    });
    expect(none.html).not.toContain("<a href=");
  });

  it("omits date from footer when wedding date is null", () => {
    const out = renderMessage({
      wedding: { ...wedding, date: null },
      message: { subject: "Hello", body: "Body", buttonTarget: null, buttonLabel: null },
      recipient: { firstName: "Maya" },
      baseUrl: "https://example.com",
    });

    expect(out.text).toContain("Alex & Sam");
    expect(out.text).not.toContain(" · ");
    expect(out.html).not.toContain(" · ");
  });

  it("escapes HTML in guest names, couple names, body and button labels, and resists special replace patterns", () => {
    const out = renderMessage({
      wedding: {
        ...wedding,
        partnerOne: "<Alex>",
        partnerTwo: 'Sam & "Co"',
      },
      message: {
        subject: "Hello {first_name}\nInjected",
        body: "Hi {first_name}, <script>alert(1)</script>",
        buttonTarget: "rsvp",
        buttonLabel: 'RSVP "now" <img onerror=1>',
      },
      recipient: { firstName: "$& <b>O'Connor</b> {partner_one}" },
      inviteToken: "tok",
      baseUrl: "https://example.com",
    });

    // Subject collapses newlines and does not double-replace {partner_one} inside firstName
    expect(out.subject).toBe("Hello $& <b>O'Connor</b> {partner_one} Injected");
    // HTML is completely escaped
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<b>");
    expect(out.html).not.toContain("<img");
    expect(out.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out.html).toContain("&lt;b&gt;O&#39;Connor&lt;/b&gt;");
    expect(out.html).toContain("&lt;Alex&gt; &amp; Sam &amp; &quot;Co&quot;");
    expect(out.html).toContain("RSVP &quot;now&quot; &lt;img onerror=1&gt;");
  });
});
