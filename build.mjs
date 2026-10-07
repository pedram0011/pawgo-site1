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
 *   1. SITE_URL        — final production domain (NOT confirmed yet)
 *   2. BUSINESS.phone  — phone number (null = omitted everywhere)
 *   3. BUSINESS.hours  — opening hours (null = omitted everywhere)
 *   4. BOOKING.*       — booking provider + URLs (see BOOKING block)
 *   5. POLICIES.*      — cancellation, late/no-show, owner presence,
 *                        second person, travel fee, senior pets
 *                        (null = omitted from the site entirely)
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
    /** Not published on the original site — leave null until the owner confirms. */
    phone: null, // e.g. "+1 604 555 0123"
    /** Mobile business — no public storefront address. */
    address: null,
    /** Opening hours are not published — leave null until confirmed. */
    hours: null, // e.g. [{ days: "Monday–Friday", time: "9:00–17:00" }]
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
    priceRange: "CA$42–CA$210",
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
 * UNCONFIRMED BUSINESS POLICIES — all null.
 * Each one, once set to answer text supplied by the owner, automatically
 * appears in the matching FAQ/content block (no page edits needed).
 */
const POLICIES = {
    cancellation: null, // full answer text for the cancellation FAQ
    lateArrival: null, // late / missed appointment FAQ
    noShow: null,
    seniorPet: null, // age-related guidance FAQ
    ownerPresence: null, // “can I stay / do I need to be home?” FAQ
    secondPerson: null, // “can someone accompany the pet?” FAQ
    travelFee: null, // travel surcharge FAQ + service-area note
};

/** Canonical price list (CAD). Source of truth for schema offers;
 *  visible price copy lives on the pages and must match these. */
const PRICES = {
    fullGroom: { small: "150.00", medium: "170.00", large: "190.00", xl: "210.00" },
    deshed: { small: "130.00", medium: "150.00", large: "170.00", xl: "190.00" },
    cat: { shortHair: "150.00", longHair: "170.00", lionCut: "190.00" },
    matRemovalFrom: "120.00",
    nailTrim: "42.00",
    nailTrimX2: "65.00",
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
        /\{\{(?:businessName|email|instagramUrl|instagramHandle|phone|hoursText|bookingMainUrl|bookingEmbedSrc|bookingEmbedHeight|bookingHrefMain|bookingHrefDog|bookingHrefCat|policy[A-Za-z]+)\}\}/g,
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
        phone: BUSINESS.phone || "",
        hoursText: BUSINESS.hours
            ? BUSINESS.hours.map((h) => `${h.days}: ${h.time}`).join(", ")
            : "",
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
    const F = PRICES.fullGroom;
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
        // Omitted while unknown: telephone, address, openingHoursSpecification
        ...(BUSINESS.phone ? { telephone: BUSINESS.phone } : {}),
        ...(BUSINESS.address ? { address: BUSINESS.address } : {}),
        ...(BUSINESS.hours
            ? {
                  openingHoursSpecification: BUSINESS.hours.map((h) => ({
                      "@type": "OpeningHoursSpecification",
                      dayOfWeek: h.days,
                      opens: h.opens,
                      closes: h.closes,
                  })),
              }
            : {}),
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
            offer("Full Groom Package — Small Dog", F.small),
            offer("Full Groom Package — Medium Dog", F.medium),
            offer("Full Groom Package — Large Dog", F.large),
            offer("Full Groom Package — XL Dog", F.xl),
            offer("Cat Groom — Short Hair", C.shortHair),
            offer("Cat Groom — Long Hair", C.longHair),
            offer("Lion Cut", C.lionCut),
            offer("Nail Trim Only", PRICES.nailTrim),
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
    rendered.push({ path, canonical, meta, lastmod: BLOG_DATES[path] || null });
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


