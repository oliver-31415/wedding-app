import { describe, expect, it } from "vitest";
import { decodeEntities, extractProductDetails, toCents } from "./product-page";

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

describe("helpers", () => {
  it("decodes entities and parses prices", () => {
    expect(decodeEntities("Salt &amp; Pepper &#8211; set&#x27;s")).toBe("Salt & Pepper – set's");
    expect(toCents("1,299.00")).toBe(129900);
    expect(toCents("$49.5")).toBe(4950);
    expect(toCents("0")).toBeNull();
    expect(toCents("free")).toBeNull();
  });
});
