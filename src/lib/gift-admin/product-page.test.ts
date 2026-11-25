import { describe, expect, it } from "vitest";
import { decodeEntities, extractProductDetails, looksLikeBlockedPage, toCents } from "./product-page";

const page = (head: string, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe("extractProductDetails", () => {
  it("reads schema.org Product data first", () => {
    const html = page(
      `<title>Casserole 24cm | Kitchen Warehouse™</title>
       <meta property="og:site_name" content="Kitchen Warehouse">
       <meta property="og:image" content="https://cdn.example.com/kwh-open-graph.jpg">` +
        ld({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "BreadcrumbList" },
            {
              "@type": "Product",
              name: "Le Creuset Signature Casserole 24cm",
              image: ["/img/casserole.jpg"],
              offers: { "@type": "Offer", price: "539.00", priceCurrency: "AUD" },
            },
          ],
        }),
    );
    expect(extractProductDetails(html, "https://www.kitchenwarehouse.com.au/product/x")).toEqual({
      name: "Le Creuset Signature Casserole 24cm",
      storeName: "Kitchen Warehouse",
      priceCents: 53900,
      currency: "AUD",
      imageUrl: "https://www.kitchenwarehouse.com.au/img/casserole.jpg",
    });
  });

  it("prefers the page title's casing over SHOUTED product data, and a full-size image over a thumbnail", () => {
    const html = page(
      `<meta property="og:title" content="Anolon Covered Casserole 30cm | David Jones">
       <meta property="og:site_name" content="David Jones">
       <meta property="og:image" content="https://www.davidjones.com/productimages/magnify/1.jpg">` +
        ld({
          "@type": "Product",
          name: "COVERED CASSEROLE 30CM",
          image: "https://www.davidjones.com/productimages/thumb/1.jpg",
          offers: { "@type": "AggregateOffer", lowPrice: 115, priceCurrency: "AUD" },
        }),
    );
    const d = extractProductDetails(html, "https://www.davidjones.com/product/x");
    expect(d.name).toBe("Anolon Covered Casserole 30cm");
    expect(d.priceCents).toBe(11500);
    expect(d.imageUrl).toBe("https://www.davidjones.com/productimages/magnify/1.jpg");
  });

  it("falls back to meta tags and skips a logo used as the sharing image", () => {
    const html = page(
      `<title>3-ply Saucepan Set | Le Creuset AU</title>
       <meta property="og:image" content="https://www.lecreuset.com.au/images/lec-logo-og.png">
       <meta property="product:price:amount" content="651.00">
       <meta property="product:price:currency" content="aud">`,
      `<script>var data = {"image":"https:\\/\\/www.lecreuset.com.au\\/dw\\/image\\/set.jpg"}</script>`,
    );
    expect(extractProductDetails(html, "https://www.lecreuset.com.au/en_AU/p/set.html")).toEqual({
      name: "3-ply Saucepan Set",
      storeName: "Le Creuset AU",
      priceCents: 65100,
      currency: "AUD",
      imageUrl: "https://www.lecreuset.com.au/dw/image/set.jpg",
    });
  });

  it("uses a price only when the page's data agrees on one", () => {
    const one = page("<title>Thing</title>", `<script>{"price": "49.95"} {"price":49.95}</script>`);
    const many = page("<title>Thing</title>", `<script>{"price": "49.95"} {"price": "12.00"}</script>`);
    expect(extractProductDetails(one, "https://shop.example/x").priceCents).toBe(4995);
    expect(extractProductDetails(many, "https://shop.example/x").priceCents).toBeNull();
  });

  it("needs a price seen only in page data to appear more than once (a lone one may be a membership or fee)", () => {
    const html = page("<title>Cushion</title>", `<script>{"membership":{"code":"4110","price":19.95}}</script><p>$19.95 a year</p>`);
    expect(extractProductDetails(html, "https://shop.example/x").priceCents).toBeNull();
  });

  it("reads whole numbers in page data as cents or dollars only when the page shows which", () => {
    // Shopify-style cents: 4900 shown as "$49.00", never $4,900.
    const cents = page("<title>Vase</title>", `<script>{"price":4900} {"price":4900}</script><span>$49.00</span>`);
    expect(extractProductDetails(cents, "https://shop.example/products/vase").priceCents).toBe(4900);
    // Dollars: 99 shown as "$99".
    const dollars = page("<title>Skirt</title>", `<script>{"price":99} {"price":"99"}</script><span>$99</span>`);
    expect(extractProductDetails(dollars, "https://shop.example/p/skirt").priceCents).toBe(9900);
    // Not shown either way: leave it for the couple.
    const unknown = page("<title>Ink</title>", `<script>{"price":2000} {"price":2000}</script>`);
    expect(extractProductDetails(unknown, "https://shop.example/p/ink").priceCents).toBeNull();
    // Decimal prices and Shopify cents of the same amount agree.
    const both = page("<title>Cups</title>", `<script>{"price":"89.85"} {"price":8985}</script><b>$89.85</b>`);
    expect(extractProductDetails(both, "https://shop.example/products/cups").priceCents).toBe(8985);
  });

  it("reads a $1,299-style price shown with thousands separators", () => {
    const html = page("<title>Sofa</title>", `<script>{"price":1299} {"price":1299}</script><span>$1,299</span>`);
    expect(extractProductDetails(html, "https://shop.example/sofa").priceCents).toBe(129900);
  });

  it("finds JSON-LD written with an escaped + and without @ on its keys", () => {
    const html = page(
      `<title>Otis Cushion</title>
       <script type="application/ld&#x2B;json">${JSON.stringify({
         context: "https://schema.org",
         type: "Product",
         name: "Otis Boucle Cushion",
         offers: { type: "AggregateOffer", priceCurrency: "AUD", lowPrice: "62.99", highPrice: "62.99" },
       })}</script>`,
      `<script>{"linenLoversProduct":{"price":19.95}}</script>`,
    );
    expect(extractProductDetails(html, "https://www.adairs.com.au/x/")).toMatchObject({
      name: "Otis Boucle Cushion",
      priceCents: 6299,
      currency: "AUD",
    });
  });

  it("prefers the selling price over a strikethrough or list price in JSON-LD", () => {
    const html = page(
      ld({
        "@type": "Product",
        name: "Cake pan",
        offers: {
          "@type": "Offer",
          priceSpecification: [
            { "@type": "UnitPriceSpecification", price: "8.99", priceCurrency: "AUD", priceType: "https://schema.org/StrikethroughPrice" },
            { "@type": "UnitPriceSpecification", price: "8.09", priceCurrency: "AUD" },
          ],
        },
      }),
    );
    expect(extractProductDetails(html, "https://www.ikea.com/au/en/p/x/")).toMatchObject({ priceCents: 809, currency: "AUD" });
  });

  it("reads offers nested inside an AggregateOffer", () => {
    const html = page(
      ld({
        "@type": "Product",
        name: "Kettle",
        offers: { "@type": "AggregateOffer", offers: [{ "@type": "Offer", price: "1,299.00", priceCurrency: "AUD" }] },
      }),
    );
    expect(extractProductDetails(html, "https://shop.example/kettle").priceCents).toBe(129900);
  });

  it("reads schema.org microdata on ordinary elements", () => {
    const html = page(
      "<title>Serve Bowl</title>",
      `<div itemprop="offers" itemscope><span itemprop="priceCurrency" content="AUD">$</span><span itemprop="price" content="79.00">79.00</span></div>`,
    );
    expect(extractProductDetails(html, "https://shop.example/bowl")).toMatchObject({ priceCents: 7900, currency: "AUD" });
    const text = page("<title>Bowl</title>", `<span itemprop="price">$1,049.95</span>`);
    expect(extractProductDetails(text, "https://shop.example/bowl").priceCents).toBe(104995);
    const conflicting = page("<title>Bowl</title>", `<span itemprop="price" content="79.00"></span><span itemprop="price" content="12.00"></span>`);
    expect(extractProductDetails(conflicting, "https://shop.example/bowl").priceCents).toBeNull();
  });

  it("reads the price from a Next.js shop's page data, including a price range", () => {
    const next = (product: unknown) =>
      page("<title>Sheet</title>", `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { product } } })}</script>`);
    const range = next({
      name: "Arlo Fitted Sheet",
      price: null,
      wasPrice: null,
      priceRange: { minPrice: { value: 27, currencyIso: "AUD" }, maxPrice: { value: 42, currencyIso: "AUD" } },
    });
    expect(extractProductDetails(range, "https://www.target.com.au/p/x")).toMatchObject({ priceCents: 2700, currency: "AUD" });
    const plain = next({ name: "Lamp", price: "149.50" });
    expect(extractProductDetails(plain, "https://www.example.com/p/lamp").priceCents).toBe(14950);
  });

  it("reads Amazon's buy-box price", () => {
    const html = page(
      "<title>Casserole: Amazon.com.au</title>",
      `<input type="hidden" name="items[0.base][customerVisiblePrice][amount]" value="413.55" id="items[0.base][customerVisiblePrice][amount]"/>
       <input type="hidden" name="items[0.base][customerVisiblePrice][currencyCode]" value="AUD" id="items[0.base][customerVisiblePrice][currencyCode]"/>
       <span class="a-price apex-pricetopay-value"><span class="a-offscreen">$413.55</span></span>`,
    );
    expect(extractProductDetails(html, "https://www.amazon.com.au/dp/B0")).toMatchObject({ priceCents: 41355, currency: "AUD" });
    const shownOnly = page("<title>x</title>", `<span class="a-price apex-pricetopay-value" data-a-size="xl"><span class="a-offscreen">$1,089.00</span></span>`);
    expect(extractProductDetails(shownOnly, "https://www.amazon.com.au/dp/B1").priceCents).toBe(108900);
  });

  it("treats a price without a currency as AUD on an Australian shop or when the page names only AUD", () => {
    const html = page(`<title>Vase</title><meta property="product:price:amount" content="55.00">`);
    expect(extractProductDetails(html, "https://www.shop.com.au/vase").currency).toBe("AUD");
    expect(extractProductDetails(html, "https://shop.example/vase").currency).toBeNull();
    const aud = page(`<title>Vase</title><meta property="product:price:amount" content="55.00">`, `<script>{"currencyCode":"AUD"}</script>`);
    expect(extractProductDetails(aud, "https://shop.example/vase").currency).toBe("AUD");
    const usd = page(`<title>Vase</title><meta property="product:price:amount" content="55.00">`, `<script>{"currencyCode":"USD"}</script>`);
    expect(extractProductDetails(usd, "https://shop.example/vase").currency).toBe("USD");
  });

  it("handles Amazon-style pages", () => {
    const html = page(
      `<title>Dutch oven | Long marketing text: Dutch Ovens: Amazon.com.au</title>`,
      `<span id="productTitle" class="a-size-medium">   Cast iron dutch oven 5L   </span>
       <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/81N.jpg">`,
    );
    expect(extractProductDetails(html, "https://www.amazon.com.au/dp/B0")).toMatchObject({
      name: "Cast iron dutch oven 5L",
      storeName: "Amazon.com.au",
      imageUrl: "https://m.media-amazon.com/images/I/81N.jpg",
    });
  });

  it("returns nothing it can't find, and never a non-web image link", () => {
    const html = page(`<meta property="og:image" content="javascript:alert(1)">`);
    expect(extractProductDetails(html, "https://shop.example/x")).toEqual({
      name: null,
      storeName: "shop.example",
      priceCents: null,
      currency: null,
      imageUrl: null,
    });
  });
});

describe("looksLikeBlockedPage", () => {
  it("spots bot checks but not real pages", () => {
    expect(looksLikeBlockedPage(page("<title>Pardon Our Interruption</title>"))).toBe(true);
    expect(looksLikeBlockedPage(page("<title>Just a moment...</title>"))).toBe(true);
    expect(looksLikeBlockedPage(page("", "<script>window.KPSDK={};</script>"))).toBe(true);
    expect(looksLikeBlockedPage(page("<title>Le Creuset Casserole | Myer</title>"))).toBe(false);
  });
});

describe("helpers", () => {
  it("decodes entities and parses prices", () => {
    expect(decodeEntities("Salt &amp; Pepper &#8211; set&#x27;s")).toBe("Salt & Pepper – set's");
    expect(toCents("1,299.00")).toBe(129900);
    expect(toCents("$49.5")).toBe(4950);
    expect(toCents("0")).toBeNull();
    expect(toCents("free")).toBeNull();
  });
});
