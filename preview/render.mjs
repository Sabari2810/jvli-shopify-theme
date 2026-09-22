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

const globals = {
  routes: {
    root_url: "/",
    search_url: "/search",
    account_url: "/account",
    account_login_url: "/account/login",
    cart_url: "/cart",
    cart_add_url: "/cart/add",
    all_products_collection_url: "/collections/all",
    collections_url: "/collections",
  },
  shop: { name: "JVLI", customer_accounts_enabled: true },
  customer: process.env.LOGGED_IN ? { id: 1, first_name: "Test" } : null,
  cart: { item_count: 0 },
  request: { page_type: (process.env.TEMPLATE || "index").split(".")[0] },
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

// Product card views, as /products/<handle>?view=jvli-card returns them.
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
<body class="gradient">
${header}
<main id="MainContent" class="content-for-layout" role="main">
${main}
</main>
<div class="shopify-section shopify-section-group-footer-group"><footer class="footer" style="padding-top:60px;padding-inline:20px;background:#2b2320;color:#fff;font:14px sans-serif">Sense footer (unchanged)</footer></div>
</body>
</html>
`,
);
console.log(`Rendered ${join(out, "index.html")}`);
