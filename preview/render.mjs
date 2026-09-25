// Renders the JVLI home page locally: the real section/snippet Liquid files,
// templates/index.json and sections/header-group.json, with sample Shopify
// data. Output: out/index.html (+ assets). Screenshot with screenshot.mjs.
//
// Environment:
//   SENSE_BASE_CSS  path to Sense's assets/base.css (optional, for realism)
//   STANDINS_DIR    folder of stand-in photos named <section>.<setting>.jpg,
//                   <section>.<block>.jpg or product-<n>.jpg (optional)
//   TEMPLATE        template to render, e.g. page.favorites (default: index)
//   LOGGED_IN       set to render as a signed-in customer
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const here = dirname(fileURLToPath(import.meta.url));
const theme = join(here, "..");
const out = join(here, "out");
const standins = process.env.STANDINS_DIR;
mkdirSync(join(out, "assets"), { recursive: true });
mkdirSync(join(out, "images"), { recursive: true });

const readJson = (file) =>
  JSON.parse(readFileSync(join(theme, file), "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, ""));

/* ---------- Images ---------- */

function imageFromFile(file, alt = "") {
  const name = basename(file);
  cpSync(file, join(out, "images", name));
  // Dimensions are only used for width/height attributes; a rough value is fine.
  return { src: `images/${name}`, width: 1600, height: 1200, aspect_ratio: 1600 / 1200, alt };
}

function standin(key) {
  if (!standins) return null;
  for (const ext of ["jpg", "png"]) {
    const file = join(standins, `${key}.${ext}`);
    if (existsSync(file)) return imageFromFile(file);
  }
  return null;
}

/* ---------- Sample store data ---------- */

const sizes = ["XS", "S", "M", "L", "XL"];
const sampleProducts = [
  ["Mei Short Kurti", 79900],
  ["Thendral Kurti", 89900],
  ["Nilaa Kurti", 89900],
  ["Kaveri Kurti", 89900],
  ["Malar Short Kurti", 79900],
].map(([title, price], i) => {
  const image = standin(`product-${i + 1}`);
  const variants = sizes.map((size, j) => ({
    id: 4000 + i * 10 + j,
    options: [size],
    available: !(i === 3 && size === "XS"),
  }));
  const handle = title.toLowerCase().replace(/ /g, "-");
  return {
    id: 9000 + i,
    title,
    handle,
    url: `/products/${handle}`,
    price,
    compare_at_price: null,
    available: true,
    featured_media: { preview_image: image },
    media: [{ preview_image: image }],
    options_with_values: [{ name: "Size", values: sizes }],
    variants,
    selected_or_first_available_variant: variants[0],
  };
});

const collections = {
  "new-in": {
    title: "New In",
    url: "/collections/new-in",
    products: sampleProducts,
    products_count: sampleProducts.length,
    featured_image: null,
  },
};

const menus = {
  "main-menu": {
    links: [
      { title: "Shop", url: "/collections/all" },
      { title: "New In", url: "/collections/new-in" },
      { title: "Kurtis", url: "/collections/kurtis" },
      { title: "Collections", url: "/collections" },
      { title: "Our Story", url: "/pages/our-story" },
    ],
  },
};

// The product page's product: the first sample, with a gallery, options and
// one sold-out size, as Shopify's product object exposes them.
function sampleProductPage() {
  const base = sampleProducts[3];
  const media = [1, 2, 3].map((n, i) => ({ id: 700 + i, media_type: "image", alt: "", preview_image: standin(`product-${((3 + i) % 5) + 1}`) }));
  const variants = base.variants.map((v, i) => ({
    ...v,
    title: v.options[0],
    price: base.price,
    compare_at_price: i === 0 ? null : 119900,
    featured_media: null,
  }));
  const current = variants.find((v) => v.available);
  return {
    ...base,
    description: "<p>A relaxed straight kurti in soft cotton, hand block printed in madder red. Three-quarter sleeves, side slits and a keyhole neckline.</p>",
    media,
    featured_media: media[0],
    has_only_default_variant: false,
    options_with_values: [{ name: "Size", values: sizes, selected_value: current.options[0] }],
    variants,
    selected_or_first_available_variant: current,
    metafields: { custom: {} },
  };
}

// /collections/all with filters (one active) and sort options.
function sampleCollectionPage() {
  const value = (label, count, active = false) => ({
    label, value: label, count, active, param_name: "filter.v.option.size",
    url_to_remove: "/collections/all",
  });
  const size = sizes.map((label) => value(label, label === "XS" ? 0 : 5, label === "M"));
  return {
    title: "All products",
    url: "/collections/all",
    description: "",
    products: sampleProducts,
    products_count: sampleProducts.length,
    sort_by: "",
    default_sort_by: "manual",
    sort_options: [
      { name: "Featured", value: "manual" },
      { name: "Best selling", value: "best-selling" },
      { name: "Price, low to high", value: "price-ascending" },
      { name: "Price, high to low", value: "price-descending" },
      { name: "Date, new to old", value: "created-descending" },
    ],
    filters: [
      {
        label: "Availability", type: "list", url_to_remove: "/collections/all",
        values: [{ ...value("In stock", 5), param_name: "filter.v.availability" }, { ...value("Out of stock", 1), param_name: "filter.v.availability" }],
        active_values: [],
      },
      {
        label: "Price", type: "price_range", url_to_remove: "/collections/all", range_max: 89900,
        min_value: { param_name: "filter.v.price.gte", value: null },
        max_value: { param_name: "filter.v.price.lte", value: null },
        active_values: [],
      },
      { label: "Size", type: "list", url_to_remove: "/collections/all", values: size, active_values: size.filter((v) => v.active) },
    ],
  };
}

/* ---------- Setting values -> Liquid objects ---------- */

function schemaOf(type) {
  const source = readFileSync(join(theme, "sections", `${type}.liquid`), "utf8");
  const match = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return JSON.parse(match[1]);
}

function resolveSettings(defs, values, standinKey) {
  const settings = {};
  for (const def of defs.filter((d) => d.id)) {
    let value = values[def.id] ?? def.default ?? null;
    if (def.type === "image_picker") {
      value = standin(`${standinKey}.${def.id}`);
    } else if (def.type === "collection") {
      value = value ? collections[value] ?? { title: value, url: `/collections/${value}`, products: [], products_count: 0 } : null;
    } else if (def.type === "link_list") {
      value = menus[value] ?? { links: [] };
    } else if (def.type === "page") {
      // Preview a size chart page so the pop-up can be checked.
      value = def.id === "size_chart_page"
        ? { title: "Size guide", content: '<p class="jvli-size-guide__sub">அளவு வழிகாட்டி</p><table><thead><tr><th>Size</th><th>Chest</th><th>Waist</th><th>Hip</th></tr></thead><tbody><tr><td>XXS</td><td>32</td><td>28</td><td>35</td></tr><tr><td>XS</td><td>34</td><td>30</td><td>37</td></tr><tr><td>S</td><td>36</td><td>32</td><td>39</td></tr><tr><td>M</td><td>38</td><td>34</td><td>41</td></tr><tr><td>L</td><td>40</td><td>36</td><td>43</td></tr></tbody></table><p><em>All measurements are in inches.</em></p><h3>Fit notes</h3><p>If you prefer a relaxed fit, choose one size up.</p><p>For a comfortable fit, refer to the size guide before ordering.</p>' }
        : null;
    } else if (def.type === "url" && typeof value === "string") {
      value = value.replace(/^shopify:\/\/(collections|pages|products)\//, "/$1/");
    }
    settings[def.id] = value;
  }
  return settings;
}

function buildSection(id, config) {
  const schema = schemaOf(config.type);
  const blockDefs = Object.fromEntries((schema.blocks ?? []).map((b) => [b.type, b]));
  const blocks = (config.block_order ?? []).map((blockId) => {
    const block = config.blocks[blockId];
    return {
      id: blockId,
      type: block.type,
      shopify_attributes: "",
      settings: resolveSettings(blockDefs[block.type]?.settings ?? [], block.settings ?? {}, `${id}.${blockId}`),
    };
  });
  return {
    type: config.type,
    wrapperClass: schema.class ?? "",
    section: { id, settings: resolveSettings(schema.settings ?? [], config.settings ?? {}, id), blocks },
  };
}

/* ---------- Liquid engine with the Shopify bits these files use ---------- */

const engine = new Liquid({
  root: [join(theme, "sections"), join(theme, "snippets")],
  partials: join(theme, "snippets"),
  extname: ".liquid",
  strictFilters: true,
});

engine.registerTag("schema", {
  parse(_token, remainTokens) {
    let token;
    while ((token = remainTokens.shift())) {
      if (token.name === "endschema") return;
    }
  },
  render() {
    return "";
  },
});

// {% form 'product', product, class: 'x', data-foo: '' %} ... {% endform %}
engine.registerTag("form", {
  parse(token, remainTokens) {
    this.attrs = [...token.args.matchAll(/([\w-]+):\s*'([^']*)'/g)]
      .map(([, name, value]) => (value === "" ? name : `${name}="${value}"`))
      .join(" ");
    this.templates = [];
    const stream = this.liquid.parser
      .parseStream(remainTokens)
      .on("tag:endform", () => stream.stop())
      .on("template", (tpl) => this.templates.push(tpl))
      .on("end", () => {
        throw new Error("form tag not closed");
      });
    stream.start();
  },
  *render(ctx, emitter) {
    emitter.write(`<form method="post" action="/cart/add" ${this.attrs}>`);
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    emitter.write("</form>");
  },
});
engine.registerFilter("payment_button", () =>
  '<div class="shopify-payment-button"><button type="button" class="shopify-payment-button__button shopify-payment-button__button--unbranded">Buy it now</button><button type="button" class="shopify-payment-button__more-options">More payment options</button></div>',
);
engine.registerFilter("metafield_tag", (value) => value);
engine.registerFilter("money_without_currency", (cents) => String(Number(cents) / 100));
// Shopify's rupee format: "₹1,234.00".
const rupees = (cents) => "₹" + (Number(cents) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
engine.registerFilter("money", rupees);
engine.registerFilter("money_with_currency", (cents) => rupees(cents) + " INR");

// {% paginate collection.products by N %}: exposes a two-page `paginate`.
engine.registerTag("paginate", {
  parse(token, remainTokens) {
    this.templates = [];
    const stream = this.liquid.parser
      .parseStream(remainTokens)
      .on("tag:endpaginate", () => stream.stop())
      .on("template", (tpl) => this.templates.push(tpl))
      .on("end", () => {
        throw new Error("paginate tag not closed");
      });
    stream.start();
  },
  *render(ctx, emitter) {
    ctx.push({
      paginate: {
        pages: 2,
        current_page: 1,
        previous: null,
        next: { url: "?page=2" },
        parts: [
          { title: 1, is_link: false },
          { title: 2, is_link: true, url: "?page=2" },
        ],
      },
    });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
  },
});

engine.registerFilter("asset_url", (name) => `assets/${name}`);
engine.registerFilter("stylesheet_tag", (url) => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter("image_url", (image) => (image && image.src) || "");
engine.registerFilter("placeholder_svg_tag", (_name, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300" fill="#d9cfc3"/><path d="M0 300 140 150l80 80 60-50 120 120Z" fill="#cbbfb1"/></svg>`,
);
engine.registerFilter("money_without_trailing_zeros", (cents) => {
  const value = Number(cents) / 100;
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
});
// Shopify divides as floats when either side is a float (e.g. `divided_by: 100.0`).
engine.registerFilter("divided_by", (a, b) => Number(a) / Number(b));

function sampleCart() {
  const line = (p, size, qty, discount = 0) => ({
    key: `${p.id}:${size}`,
    url: `${p.url}?variant=1`,
    image: p.featured_media && p.featured_media.preview_image,
    title: `${p.title} - ${size}`,
    product: { title: p.title, has_only_default_variant: false },
    options_with_values: [{ name: "Size", value: size }],
    properties: {},
    line_level_discount_allocations: discount ? [{ amount: discount, discount_application: { title: "WELCOME10" } }] : [],
    quantity: qty,
    original_line_price: p.price * qty,
    final_line_price: p.price * qty - discount,
    url_to_remove: "/cart/change?line=1&quantity=0",
    variant: { inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 5 },
  });
  const items = [line(sampleProducts[0], "M", 1), line(sampleProducts[1], "S", 2, 17980), line(sampleProducts[3], "L", 1)];
  const subtotal = items.reduce((sum, item) => sum + item.final_line_price, 0);
  return {
    items,
    item_count: items.reduce((n, item) => n + item.quantity, 0),
    items_subtotal_price: subtotal,
    total_price: subtotal,
    taxes_included: true,
    cart_level_discount_applications: [],
    note: "",
  };
}

function sampleSearch(terms) {
  if (terms === "none") return { performed: false, terms: "", results: [], results_count: 0 };
  if (terms === "empty") return { performed: true, terms: "silk", results: [], results_count: 0 };
  const results = [
    ...sampleProducts.map((p) => ({ ...p, object_type: "product" })),
    { object_type: "page", title: "Our Fabrics", url: "/pages/our-fabrics" },
    { object_type: "article", title: "How we choose our cotton", url: "/blogs/journal/cotton" },
  ];
  return { performed: true, terms, results, results_count: results.length };
}

const globals = {
  routes: {
    root_url: "/",
    search_url: "/search",
    account_url: "/account",
    account_login_url: "/account/login",
    product_recommendations_url: "/recommendations/products",
    cart_url: "/cart",
    cart_add_url: "/cart/add",
    all_products_collection_url: "/collections/all",
    collections_url: "/collections",
  },
  shop: { name: "JVLI", customer_accounts_enabled: true },
  customer: process.env.LOGGED_IN ? { id: 1, first_name: "Test" } : null,
  // /cart: CART=empty for an empty bag; otherwise three sample lines.
  cart: process.env.TEMPLATE === "cart" && process.env.CART !== "empty" ? sampleCart() : { item_count: 0, items: [] },
  settings: { show_cart_note: true },
  request: { page_type: (process.env.TEMPLATE || "index").split(".")[0] },
  product: sampleProductPage(),
  collection: sampleCollectionPage(),
  // /search: SEARCH_TERMS=<words> (default "cotton"), "empty" for no
  // results, or "none" for the page before searching.
  search: sampleSearch(process.env.SEARCH_TERMS || "cotton"),
  linklists: menus,
  // /collections: a few collections, including a tax one that should be hidden.
  collections: [
    { title: "New In", handle: "new-in", url: "/collections/new-in", all_products_count: 5, featured_image: standin("jvli_categories.cat_new.image"), products: sampleProducts, published_at: "2026-09-01" },
    { title: "Sarees", handle: "sarees", url: "/collections/sarees", all_products_count: 1, featured_image: null, products: [sampleProducts[2]], published_at: "2026-08-01" },
    { title: "gst-5", handle: "gst-5", url: "/collections/gst-5", all_products_count: 9, featured_image: null, products: [], published_at: "2026-01-01" },
    { title: "Short Kurtis", handle: "short-kurtis", url: "/collections/short-kurtis", all_products_count: 3, featured_image: standin("jvli_categories.cat_short.image"), products: sampleProducts, published_at: "2026-07-01" },
  ],
  recommendations: { performed: false },
};

async function renderSection(id, config, groupClass = "") {
  if (config.disabled) return "";
  const { type, wrapperClass, section } = buildSection(id, config);
  // Shopify's global objects are visible inside rendered snippets too.
  const html = await engine.renderFile(type, { section }, { globals });
  return `<div id="shopify-section-${id}" class="shopify-section ${groupClass} ${wrapperClass}">${html}</div>`;
}

/* ---------- Page ---------- */

const headerGroup = readJson("sections/header-group.json");
const index = readJson(`templates/${process.env.TEMPLATE || "index"}.json`);

let header = "";
for (const id of headerGroup.order) {
  header += await renderSection(id, headerGroup.sections[id], "shopify-section-group-header-group");
}
let main = "";
for (const id of index.order) {
  main += await renderSection(id, index.sections[id]);
}

// Product card views, as /products/<handle>?view=favorites-internal-do-not-use returns them.
mkdirSync(join(out, "products"), { recursive: true });
for (const product of sampleProducts) {
  writeFileSync(join(out, "products", product.handle), await engine.renderFile("jvli-product-card", { ...globals, product }));
}

for (const file of readdirSync(join(theme, "assets"))) {
  cpSync(join(theme, "assets", file), join(out, "assets", file));
}
let senseCss = "";
if (process.env.SENSE_BASE_CSS && existsSync(process.env.SENSE_BASE_CSS)) {
  cpSync(process.env.SENSE_BASE_CSS, join(out, "assets", "base.css"));
  senseCss = '<link rel="stylesheet" href="assets/base.css">';
}

writeFileSync(
  join(out, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JVLI home preview</title>
<style>
  /* The CSS variables Sense's layout normally prints from theme settings. */
  :root {
    --font-body-family: Assistant, sans-serif; --font-body-style: normal; --font-body-weight: 400;
    --font-heading-family: Assistant, sans-serif; --font-heading-style: normal; --font-heading-weight: 400;
    --font-body-scale: 1; --font-heading-scale: 1;
    --color-foreground: 18, 18, 18; --color-background: 255, 255, 255; --color-link: 18, 18, 18;
    --page-width: 120rem; --buttons-border-width: 1px;
  }
  html { font-size: 62.5%; }
  body { margin: 0; font-size: 1.5rem; letter-spacing: 0.06rem; line-height: 1.8; font-family: var(--font-body-family); color: rgb(var(--color-foreground)); background: rgb(var(--color-background)); }
</style>
${senseCss}
</head>
<body class="gradient"${process.env.NO_WRITE ? "" : " data-jvli-write"}>
${header}
<main id="MainContent" class="content-for-layout" role="main"${process.env.NO_THREAD ? "" : " data-jvli-thread"}>
${main}
</main>
<div class="shopify-section shopify-section-group-footer-group"><footer class="footer" style="padding-top:60px;padding-inline:20px;background:#2b2320;color:#fff;font:14px sans-serif">Sense footer (unchanged)</footer></div>
</body>
</html>
`,
);
console.log(`Rendered ${join(out, "index.html")}`);
