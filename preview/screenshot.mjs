// Screenshots out/index.html at desktop and phone widths, and reports which
// web fonts loaded and each section's height. Preview files are served by
// request interception (no local server). Google Fonts files are fetched with
// curl and cached in out/font-cache, so screenshots are repeatable and work
// behind proxies Chromium can't use reliably.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const globalRoot = execSync("npm root -g").toString().trim();
const { chromium } = require(join(globalRoot, "playwright"));

const out = new URL("./out/", import.meta.url).pathname;
const origin = "https://jvli-preview.test/";
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

const fontCache = join(out, "font-cache");
mkdirSync(fontCache, { recursive: true });
const chromeUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function cachedFont(url) {
  const file = join(fontCache, createHash("sha1").update(url).digest("hex"));
  if (!existsSync(file)) {
    execSync(`curl -sSf --retry 3 -A ${JSON.stringify(chromeUA)} -o ${JSON.stringify(file)} ${JSON.stringify(url)}`);
  }
  return readFileSync(file);
}

const browser = await chromium.launch();

for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await page.route(`${origin}**`, (route) => {
    const path = join(out, decodeURIComponent(new URL(route.request().url()).pathname).replace(/\/$/, "/index.html"));
    if (!existsSync(path)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[extname(path)] ?? "application/octet-stream", body: readFileSync(path) });
  });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => {
    const url = route.request().url();
    try {
      const body = cachedFont(url);
      return route.fulfill({ status: 200, contentType: url.includes("googleapis") ? "text/css" : "font/woff2", body, headers: { "Access-Control-Allow-Origin": "*" } });
    } catch {
      return route.abort();
    }
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url().slice(0, 80)} (${r.failure()?.errorText})`));

  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });

  const report = await page.evaluate(() => ({
    fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")),
    sections: [...document.querySelectorAll(".shopify-section")].map((el) => [el.id.replace("shopify-section-", ""), Math.round(el.getBoundingClientRect().height)]),
  }));
  console.log(`${name}: ${join(out, `${name}.png`)}`);
  console.log(`  fonts loaded: ${[...new Set(report.fonts)].join(", ") || "none"}`);
  console.log(`  section heights: ${report.sections.map(([id, h]) => `${id}=${h}`).join("  ")}`);
  if (errors.length) console.log(`  errors: ${errors.join(" | ")}`);
  await page.close();
}
await browser.close();
