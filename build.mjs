/**
 * Pawgo Mobile Grooming — static site builder.
 *
 * Assembles src/layout.html + src/pages/*.html into fully-rendered HTML
 * pages with unique titles, meta descriptions, canonicals, breadcrumbs,
 * Open Graph tags and JSON-LD structured data. Also emits sitemap.xml.
 *
 * Usage: node build.mjs
 *
 * ─────────────────────────────────────────────────────────────────────
 * OWNER INPUTS REQUIRED BEFORE LAUNCH (fill in below; site adapts):
 *   1. SITE_URL          — final production domain (NOT confirmed yet)
 *   2. BUSINESS.hours    — days of week for the confirmed 9:00 AM–7:00 PM
 *                          window (value confirmed; days drive schema only)
 *   3. BOOKING.*         — booking provider + URLs (see BOOKING block)
 *   4. POLICIES.*        — late arrival, owner presence, second person
 *                          (null = omitted from the site entirely)
 * ALREADY CONFIRMED BY OWNER (2026-10-07 final update):
 *   • phone: +1 236-888-1559 (display 236-888-1559)
 *   • hours: 9:00 AM – 7:00 PM
 *   • full price list (PRICES), $30 deposit + cancellation policy,
 *     travel-fee policy, senior-pet policy, temperament/aggression policy,
 *     pricing policy (see POLICIES / PRICE_POLICY)
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/* CONFIG                                                              */
/* ------------------------------------------------------------------ */

/** ⚠ UNCONFIRMED — placeholder domain. Replace with the final domain
 *  before launch; it feeds canonicals, OG URLs, JSON-LD and the sitemap. */
const SITE_URL = "https://pawgomobilegrooming.com";

/** The old/placeholder domain, used to normalise any absolute URLs that
 *  hard-code it inside page frontmatter schemas. */
const LEGACY_URL = "https://pawgomobilegrooming.com";

const BUSINESS = {
    name: "Pawgo Mobile Grooming",
    owner: "Susan",
    logo: SITE_URL + "/images/susan-holding-groomed-pomeranian-pawgo-mobile-grooming-768w.webp",
    email: "Susan.ebrahimi55@gmail.com",
    instagram: "https://www.instagram.com/pawgo_mobile_grooming",
    instagramHandle: "@pawgo_mobile_grooming",
    /** Confirmed by the owner — E.164; shown as 236-888-1559. */
    phone: "+12368881559",
    /** Mobile business — no public storefront address. */
    address: null,
    /** Confirmed by the owner (2026-10-07) — days of week not specified,
     *  so openingHoursSpecification stays out of the schema until they are. */
    hours: { text: "9:00 AM – 7:00 PM", opens: "09:00", closes: "19:00" },
    areaServed: [
        "Vancouver",
        "Burnaby",
        "Coquitlam",
        "Port Coquitlam",
        "Port Moody",
        "New Westminster",
        "Surrey",
        "Langley",
        "North Vancouver",
        "West Vancouver",
        "Richmond",
        "Delta",
        "Maple Ridge",
        "Pitt Meadows",
        "White Rock",
    ],
    priceRange: "CA$10–CA$210",
};

/**
 * BOOKING INTEGRATION LAYER
 * ──────────────────────────
 * The booking provider is NOT yet chosen (Fresha vs Groomer.io).
 * When the owner decides, fill this in using the provider's OFFICIAL
 * integration method only — do not invent iframes, widgets or APIs.
 *
 *   provider      "fresha" | "groomerio" | …   (informational)
 *   mainUrl       main booking URL
 *   dogUrl        dog-grooming booking URL (optional)
 *   catUrl        cat-grooming booking URL (optional)
 *   serviceUrls   per-service URLs, e.g. { "nail-trim": "https://…" }
 *   embed         official embed config ONLY if the provider supports it,
 *                 e.g. { src: "https://…", height: "820" }
 *   scripts       official external scripts the embed needs
 *                 (loaded only on /book/)
 *   ctaDestination
 *       "hub"     (default) every “Book Now” button goes to /book/,
 *                 which renders the integration from this config
 *       "direct" buttons go straight to the provider URLs above
 */
const BOOKING = {
    provider: null,
    mainUrl: null,
    dogUrl: null,
    catUrl: null,
    serviceUrls: {},
    embed: null,
    scripts: [],
    ctaDestination: "hub",
};

/**
 * BUSINESS POLICIES — each value is the owner-confirmed answer text.
 * While null, the matching FAQ/content block is omitted from the site
 * entirely; once set, it appears automatically (no page edits needed).
 */
const POLICIES = {
    /** Confirmed by the owner (2026-10-07). Deposit is non-refundable —
     *  never describe it as refundable. */
    cancellation:
        "A $30 deposit secures your appointment and is applied toward the total cost of the grooming service. Cancellations or rescheduling made at least 24 hours in advance can have the deposit transferred to a new appointment. Deposits are non-refundable for cancellations with less than 24 hours' notice and for no-shows.",
    lateArrival: null, // late / missed appointment FAQ
    noShow: null,
    /** Confirmed by the owner (2026-10-07). */
    seniorPet:
        "Senior pets are always welcome, with no additional fee. Their comfort and safety come first — rest breaks are provided as needed throughout the grooming session, and grooming is performed at a pace that is comfortable for your pet.",
    ownerPresence: null, // “can I stay / do I need to be home?” FAQ
    secondPerson: null, // “can someone accompany the pet?” FAQ
    /** Confirmed by the owner (2026-10-07). */
    travelFee:
        "No travel fee in Coquitlam, Port Coquitlam and Port Moody. For locations outside these areas, a small travel fee may apply depending on distance. Any additional fee will be confirmed before booking.",
};

/** De-matting pricing — owner-confirmed (2026-10-07): charged by time,
 *  never shown as a flat $20 service price. */
const DEMATTING = {
    amount: "20",
    minutes: 15,
    rateText: "CA$20 per 15 minutes",
    policy:
        "De-matting is charged by time at CA$20 per 15 minutes, depending on the severity of the matting and the actual time required — 15 minutes is CA$20, 30 minutes is CA$40, 45 minutes is CA$60 and 60 minutes is CA$80.",
};

/** Confirmed pricing policy (2026-10-07) — shown as a partial wherever
 *  starting prices are listed. */
const PRICE_POLICY =
    "All prices are starting prices and may vary depending on your pet's breed, size, coat condition, temperament, and the time required for grooming. Any additional charges will always be discussed with you before they are applied.";

/** Confirmed temperament policy (2026-10-07) — safety decides; case-by-case. */
const TEMPERAMENT_POLICY =
    "Anxious, nervous, reactive, and difficult-to-groom dogs are welcome. Dogs with a history of aggression may also be accepted on a case-by-case basis, as long as grooming can be performed safely — safety is always the deciding factor. Please tell us about any history of aggression or biting before booking.";

/** Canonical price list (CAD). Source of truth for schema offers;
 *  visible price copy lives on the pages and must match these. */
const PRICES = {
    dogFullGroom: {
        small: "110.00", // up to 25 lbs
        medium: "130.00", // 26–40 lbs
        large: "155.00", // 41–65 lbs
        xl: "185.00", // 66–90 lbs
        xxl: "210.00", // over 90 lbs
    },
    bathTidy: {
        small: "85.00",
        medium: "105.00",
        large: "130.00",
        xl: "160.00",
        xxl: "185.00",
    },
    doodlePoodle: { small: "125.00", medium: "150.00", large: "180.00", xl: "210.00" },
    cat: {
        bathBrushBlowDry: "100.00",
        bathBrushSanitary: "120.00",
        lionCutNoBath: "140.00",
        lionCutBath: "160.00",
        nailTrim: "20.00",
        dematting: "20.00", // rate only — CA$20 per 15 minutes, not a flat price
    },
    addOns: {
        dogNailTrim: "20.00",
        teethBrushing: "10.00",
        desheddingTreatment: "20.00",
        dematting: "20.00", // rate only — CA$20 per 15 minutes, not a flat price
        fleaTreatment: "20.00",
    },
    deposit: "30.00",
};

const bookingReady = Boolean(BOOKING.provider && BOOKING.mainUrl);
const bookingEmbedReady = bookingReady && Boolean(BOOKING.embed);

/** Central target for booking CTAs — see BOOKING.ctaDestination.
 *  key: "main" | "dog" | "cat" | a serviceUrls slug */
function bookingHref(root, key = "main") {
    if (BOOKING.ctaDestination !== "direct") return root + "book/";
    const url =
        key === "main"
            ? BOOKING.mainUrl
            : key === "dog"
              ? BOOKING.dogUrl
              : key === "cat"
                ? BOOKING.catUrl
                : BOOKING.serviceUrls[key];
    return url || root + "book/";
}

const BLOG_DATES = {
    "/blog/how-often-should-you-groom-your-dog/": "2026-09-10",
    "/blog/how-to-prepare-your-dog-for-grooming/": "2026-09-24",
    "/blog/how-to-prepare-your-cat-for-grooming/": "2026-10-01",
    "/blog/between-groom-coat-care-for-dogs/": "2026-10-07",
};

/** lastmod overrides for posts edited after publication. */
const BLOG_LASTMOD = {
    "/blog/how-often-should-you-groom-your-dog/": "2026-10-07",
    "/blog/how-to-prepare-your-cat-for-grooming/": "2026-10-07",
    "/blog/between-groom-coat-care-for-dogs/": "2026-10-07",
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const read = (p) => readFileSync(p, "utf8");
const abs = (p) => resolve(ROOT, p);

/** Escape values used inside HTML attributes / text nodes. */
function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function urlFor(path) {
    return SITE_URL + (path === "/" ? "/" : path);
}

/** Relative root prefix so pages work from any depth (and file://). */
function rootPrefix(path) {
    const depth = path.split("/").filter(Boolean).length;
    return depth === 0 ? "./" : "../".repeat(depth);
}

/** Extract JSON frontmatter + body from a page source file. */
function parsePage(src) {
    const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) throw new Error("Missing frontmatter block");
    const meta = JSON.parse(m[1]);
    // Keep schema URLs in sync with SITE_URL even if frontmatter hard-codes it.
    return { meta: normalizeUrls(meta), body: m[2].trim() };
}

/** Deep-replace any hard-coded legacy/placeholder domain with SITE_URL. */
function normalizeUrls(value) {
    if (typeof value === "string") {
        return value.startsWith(LEGACY_URL) ? SITE_URL + value.slice(LEGACY_URL.length) : value;
    }
    if (Array.isArray(value)) return value.map(normalizeUrls);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeUrls(v)]));
    }
    return value;
}

/** Format an E.164 North American number for display: +12368881559 → 236-888-1559 */
function formatPhone(e164) {
    const digits = String(e164).replace(/\D/g, "");
    const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    return national.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
}

/** Gate template blocks on config values: {{#if key}}…{{/if}} (non-nested). */
function applyConditionals(html, vars) {
    let out = html;
    let guard = 0;
    while (/\{\{#if (\w+)\}\}/.test(out) && guard++ < 20) {
        out = out.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) =>
            vars[key] ? inner : "",
        );
    }
    return out;
}

/** Replace config-driven {{tokens}}. Contact/scalar values are escaped;
 *  policy values are owner-supplied HTML and pass through as-is. */
function applyTokens(html, vars) {
    let out = html;
    for (const [key, value] of Object.entries(vars)) {
        if (typeof value === "string" && value !== "") {
            out = out.replaceAll(`{{${key}}}`, key.startsWith("policy") ? value : esc(value));
        }
    }
    // Remove empty config tokens (value not configured yet).
    return out.replace(
        /\{\{(?:businessName|email|instagramUrl|instagramHandle|phone|phoneHref|hoursText|deposit|demattingPrice|demattingRate|demattingPolicy|pricePolicy|temperamentPolicy|bookingMainUrl|bookingEmbedSrc|bookingEmbedHeight|bookingHrefMain|bookingHrefDog|bookingHrefCat|policy[A-Za-z]+)\}\}/g,
        "",
    );
}

/** Flat template-variable map for one page (conditionals + tokens). */
function templateVars(root) {
    const p = POLICIES;
    return {
        businessName: BUSINESS.name,
        email: BUSINESS.email,
        instagramUrl: BUSINESS.instagram,
        instagramHandle: BUSINESS.instagramHandle,
        phone: BUSINESS.phone ? formatPhone(BUSINESS.phone) : "",
        phoneHref: BUSINESS.phone || "",
        hoursText: BUSINESS.hours ? BUSINESS.hours.text : "",
        deposit: "$" + PRICES.deposit.split(".")[0],
        demattingPrice: "CA$" + DEMATTING.amount + " / " + DEMATTING.minutes + " min",
        demattingRate: DEMATTING.rateText,
        demattingPolicy: DEMATTING.policy,
        pricePolicy: PRICE_POLICY,
        temperamentPolicy: TEMPERAMENT_POLICY,
        // booking states
        bookingReady,
        bookingEmbedReady,
        bookingLinkReady: bookingReady && !BOOKING.embed,
        bookingPending: !bookingReady,
        bookingMainUrl: BOOKING.mainUrl || "",
        bookingEmbedSrc: (BOOKING.embed && BOOKING.embed.src) || "",
        bookingEmbedHeight: (BOOKING.embed && BOOKING.embed.height) || "820",
        bookingHrefMain: bookingHref(root, "main"),
        bookingHrefDog: bookingHref(root, "dog"),
        bookingHrefCat: bookingHref(root, "cat"),
        // policies (null until the owner supplies answer text)
        policyCancellation: p.cancellation || "",
        policyLateArrival: p.lateArrival || "",
        policyNoShow: p.noShow || "",
        policySeniorPet: p.seniorPet || "",
        policyOwnerPresence: p.ownerPresence || "",
        policySecondPerson: p.secondPerson || "",
        policyTravelFee: p.travelFee || "",
        hasCancellation: Boolean(p.cancellation),
        hasLateArrival: Boolean(p.lateArrival),
        hasNoShow: Boolean(p.noShow),
        hasSeniorPet: Boolean(p.seniorPet),
        hasOwnerPresence: Boolean(p.ownerPresence),
        hasSecondPerson: Boolean(p.secondPerson),
        hasTravelFee: Boolean(p.travelFee),
        hasPhone: Boolean(BUSINESS.phone),
        hasHours: Boolean(BUSINESS.hours),
    };
}

/** Guard: every price used in page schemas must come from PRICES. */
function assertSchemaPrices(meta, file) {
    const allowed = new Set(
        Object.values(PRICES)
            .flatMap((v) => (typeof v === "object" ? Object.values(v) : [v]))
            .map(String),
    );
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === "object") {
            if (node["@type"] === "Offer" && node.price && !allowed.has(String(node.price))) {
                throw new Error(
                    `${file}: schema offer price ${node.price} not found in PRICES config — update PRICES instead of the page.`,
                );
            }
            Object.values(node).forEach(walk);
        }
    };
    (meta.schemas || []).forEach(walk);
}

/** Expand {{> partial}} includes (one level, recursively). */
function expandIncludes(content) {
    let out = content;
    let guard = 0;
    while (out.includes("{{>") && guard++ < 10) {
        out = out.replace(/\{\{>\s*([\w.-]+)\s*\}\}/g, (_, name) =>
            read(join(ROOT, "src", "partials", name)),
        );
    }
    return out;
}

/* ------------------------------------------------------------------ */
/* BREADCRUMBS                                                         */
/* ------------------------------------------------------------------ */

function crumbsFor(path) {
    if (path === "/") return null;
    const segments = path.split("/").filter(Boolean);
    const crumbs = [{ name: "Home", url: urlFor("/") }];
    let acc = "/";
    segments.forEach((seg, i) => {
        acc += seg + "/";
        const isLast = i === segments.length - 1;
        crumbs.push({
            name: segToTitle(acc, seg),
            url: isLast ? null : urlFor(acc),
        });
    });
    return crumbs;
}

function segToTitle(path, seg) {
    const titles = {
        services: "Services",
        "dog-grooming": "Dog Grooming",
        "cat-grooming": "Cat Grooming",
        pricing: "Pricing",
        about: "About",
        faq: "FAQ",
        contact: "Contact",
        book: "Book Online",
        blog: "Journal",
        "service-areas": "Service Areas",
        "before-your-visit": "Before Your Visit",
    };
    if (titles[seg]) return titles[seg];
    if (path.startsWith("/blog/") && path !== "/blog/") {
        return blogTitleFor(path);
    }
    return seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

let BLOG_TITLES = {};

function blogTitleFor(path) {
    return BLOG_TITLES[path] || "Journal article";
}

function breadcrumbsHtml(crumbs) {
    if (!crumbs) return "";
    const items = crumbs
        .map((c) => {
            if (!c.url) return `<li><span aria-current="page">${c.name}</span></li>`;
            const trimmed = c.url.replace(SITE_URL, "") || "/";
            const href =
                trimmed === "/" ? "{{root}}" : "{{root}}" + trimmed.replace(/^\//, "");
            return `<li><a href="${href}">${c.name}</a></li>`;
        })
        .join("");
    return `<nav class="crumbs container" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

/** Build an FAQPage schema from the visible <details> blocks so schema
 *  and page content can never drift apart. */
function faqSchemaFrom(body) {
    const text = (s) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const pairs = [];
    const block = /<details[^>]*>([\s\S]*?)<\/details>/g;
    let d;
    while ((d = block.exec(body))) {
        const inner = d[1];
        const q = inner.match(/<summary>([\s\S]*?)<\/summary>/);
        const a = inner.match(/<div class="faq__answer">([\s\S]*?)<\/div>/);
        if (!q || !a) continue;
        pairs.push({
            "@type": "Question",
            name: text(q[1]),
            acceptedAnswer: { "@type": "Answer", text: text(a[1]) },
        });
    }
    if (!pairs.length) return null;
    return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: pairs };
}

function breadcrumbsSchema(crumbs) {
    if (!crumbs) return null;
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: c.url || urlFor(""),
        })),
    };
}

/* ------------------------------------------------------------------ */
/* SHARED SCHEMA                                                       */
/* ------------------------------------------------------------------ */

/** Offer entry built from the PRICES config (single source of truth). */
function offer(name, price) {
    return {
        "@type": "Offer",
        name,
        price,
        priceCurrency: "CAD",
        url: urlFor("/book/"),
    };
}

function localBusinessSchema() {
    const D = PRICES.dogFullGroom;
    const B = PRICES.bathTidy;
    const P = PRICES.doodlePoodle;
    const C = PRICES.cat;
    return {
        "@context": "https://schema.org",
        "@type": ["LocalBusiness", "PetGrooming"],
        "@id": urlFor("/") + "#business",
        name: BUSINESS.name,
        description:
            "Mobile pet grooming for dogs and cats in Greater Vancouver. Cage-free, one-on-one grooming that comes to your door.",
        url: urlFor("/"),
        email: BUSINESS.email,
        // Omitted while unknown: address, openingHoursSpecification (hours
        // window is confirmed but its days of week are not yet).
        ...(BUSINESS.phone ? { telephone: BUSINESS.phone } : {}),
        ...(BUSINESS.address ? { address: BUSINESS.address } : {}),
        image: BUSINESS.logo,
        logo: BUSINESS.logo,
        priceRange: BUSINESS.priceRange,
        currency: "CAD",
        areaServed: BUSINESS.areaServed.map((c) => ({
            "@type": "City",
            name: c,
        })),
        sameAs: [BUSINESS.instagram],
        founder: {
            "@type": "Person",
            name: BUSINESS.owner,
            jobTitle: "Pet groomer",
            worksFor: { "@id": urlFor("/") + "#business" },
        },
        makesOffer: [
            offer("Dog Full Groom — Small (up to 25 lbs)", D.small),
            offer("Dog Full Groom — Medium (26–40 lbs)", D.medium),
            offer("Dog Full Groom — Large (41–65 lbs)", D.large),
            offer("Dog Full Groom — XL (66–90 lbs)", D.xl),
            offer("Dog Full Groom — XXL (over 90 lbs)", D.xxl),
            offer("Bath & Tidy — Small (up to 25 lbs)", B.small),
            offer("Bath & Tidy — Medium (26–40 lbs)", B.medium),
            offer("Bath & Tidy — Large (41–65 lbs)", B.large),
            offer("Bath & Tidy — XL (66–90 lbs)", B.xl),
            offer("Bath & Tidy — XXL (over 90 lbs)", B.xxl),
            offer("Doodle & Poodle Full Groom — Small", P.small),
            offer("Doodle & Poodle Full Groom — Medium", P.medium),
            offer("Doodle & Poodle Full Groom — Large", P.large),
            offer("Doodle & Poodle Full Groom — XL", P.xl),
            offer("Cat Bath + Brush + Blow Dry", C.bathBrushBlowDry),
            offer("Cat Bath + Brush + Sanitary Trim", C.bathBrushSanitary),
            offer("Cat Haircut / Lion Cut — No Bath", C.lionCutNoBath),
            offer("Cat Haircut / Lion Cut + Bath", C.lionCutBath),
            offer("Cat Nail Trim", C.nailTrim),
            offer("De-matting — charged per 15 minutes", PRICES.addOns.dematting),
        ],
    };
}

function serviceSchema({ name, description, path, offers = [] }) {
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: name,
        name,
        description,
        url: urlFor(path),
        provider: { "@id": urlFor("/") + "#business" },
        areaServed: BUSINESS.areaServed.join(", "),
        ...(offers.length
            ? {
                  offers: offers.map((o) => ({
                      "@type": "Offer",
                      price: o.price,
                      priceCurrency: "CAD",
                      url: urlFor("/book/"),
                  })),
              }
            : {}),
    };
}

function personSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": urlFor("/about/") + "#susan",
        name: BUSINESS.owner,
        jobTitle: "Pet groomer",
        description:
            "Founder and groomer at Pawgo Mobile Grooming, a cage-free, one-on-one mobile pet grooming service in Greater Vancouver.",
        worksFor: { "@id": urlFor("/") + "#business" },
        sameAs: [BUSINESS.instagram],
    };
}

/* ------------------------------------------------------------------ */
/* BUILD                                                               */
/* ------------------------------------------------------------------ */

const pagesDir = join(ROOT, "src", "pages");
const files = readdirSync(pagesDir).filter((f) => f.endsWith(".html"));

// Pass 1: collect blog titles so breadcrumbs can resolve article names.
for (const f of files) {
    const { meta } = parsePage(read(join(pagesDir, f)));
    if (meta.path && meta.path.startsWith("/blog/") && meta.title) {
        BLOG_TITLES[meta.path] = meta.crumbTitle || meta.title;
    }
}

const layout = read(join(ROOT, "src", "layout.html"));
const rendered = [];

if (SITE_URL.includes("pawgomobilegrooming.com")) {
    console.warn(
        "⚠ SITE_URL is still the unconfirmed placeholder (" +
            SITE_URL +
            ") — set the final domain before launch.",
    );
}
if (!bookingReady) {
    console.warn(
        "⚠ Booking provider not configured yet — /book/ shows the pending state; " +
            "fill BOOKING in build.mjs once the owner picks Fresha or Groomer.io.",
    );
}

for (const f of files) {
    const { meta, body } = parsePage(read(join(pagesDir, f)));
    const path = meta.path;
    if (!path) throw new Error(`Page ${f} has no path`);
    assertSchemaPrices(meta, f);

    const root = rootPrefix(path);
    const canonical = urlFor(path);
    const crumbs = meta.noBreadcrumbs ? null : crumbsFor(path);
    const vars = templateVars(root);

    // Gate policy/config blocks in the page body first, then resolve config
    // tokens, so visible content and FAQ schema always describe the same thing.
    const content = applyTokens(applyConditionals(expandIncludes(body), vars), vars);

    const schemas = [];
    if (path === "/") schemas.push(localBusinessSchema());
    if (path === "/about/") schemas.push(personSchema());
    if (meta.schemas) schemas.push(...meta.schemas);
    const faqSchema = faqSchemaFrom(content);
    if (faqSchema) schemas.push(faqSchema);
    const bcSchema = breadcrumbsSchema(crumbs);
    if (bcSchema) schemas.push(bcSchema);

    const jsonld = schemas
        .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
        .join("\n        ");

    const bookingScripts =
        path === "/book/"
            ? BOOKING.scripts.map((s) => `<script src="${esc(s)}" defer></script>`).join("\n        ")
            : "";

    let html = layout;
    html = expandIncludes(html);
    html = html
        .replaceAll("{{title}}", esc(meta.title))
        .replaceAll("{{description}}", esc(meta.description))
        .replaceAll("{{canonical}}", esc(canonical))
        .replaceAll("{{robots}}", esc(meta.robots || "index, follow"))
        .replaceAll("{{ogType}}", esc(meta.ogType || "website"))
        .replaceAll("{{ogTitle}}", esc(meta.ogTitle || meta.title))
        .replaceAll(
            "{{ogImage}}",
            meta.ogImage ||
                SITE_URL + "/images/susan-holding-groomed-pomeranian-pawgo-mobile-grooming-768w.webp",
        )
        .replaceAll("{{breadcrumbs}}", breadcrumbsHtml(crumbs) || "")
        .replaceAll("{{content}}", content)
        .replaceAll("{{jsonld}}", jsonld)
        .replaceAll("{{headExtra}}", meta.headExtra || "")
        .replaceAll("{{bookingScripts}}", bookingScripts);

    // Layout-level conditional blocks (phone, policies, booking states),
    // then config tokens for the layout chrome.
    html = applyTokens(applyConditionals(html, vars), vars);

    html = html.replaceAll("{{root}}", root); // last: page bodies/partials use {{root}} too

    if (/\{\{[a-zA-Z]/.test(html)) {
        const leftover = html.match(/\{\{[^}]+\}\}/g);
        throw new Error(`${f}: unresolved template token(s): ${[...new Set(leftover)].join(", ")}`);
    }

    // Mark the active nav item.
    if (meta.nav) {
        html = html.replace(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
    }

    const outPath =
        path === "/" ? join(ROOT, "index.html") : join(ROOT, path.replace(/^\//, ""), "index.html");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, "utf8");
    rendered.push({ path, canonical, meta, lastmod: BLOG_LASTMOD[path] || BLOG_DATES[path] || null });
    console.log(`built  ${path}`);
}

/* ------------------------------------------------------------------ */
/* SITEMAP                                                             */
/* ------------------------------------------------------------------ */

const today = new Date().toISOString().slice(0, 10);
const urls = rendered
    .filter((p) => !p.meta.noindex)
    .map((p) => {
        const lastmod = p.lastmod || today;
        const priority =
            p.path === "/"
                ? "1.0"
                : ["/dog-grooming/", "/cat-grooming/", "/services/"].includes(p.path)
                  ? "0.9"
                  : ["/pricing/", "/book/", "/about/", "/contact/"].includes(p.path)
                    ? "0.8"
                    : p.path.startsWith("/blog/")
                      ? "0.7"
                      : "0.6";
        return `  <url>
    <loc>${p.canonical}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.path.startsWith("/blog/") ? "monthly" : "monthly"}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

writeFileSync(
    join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    "utf8",
);
console.log(`built  sitemap.xml (${rendered.length} urls)`);

writeFileSync(
    join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    "utf8",
);
console.log("built  robots.txt");


