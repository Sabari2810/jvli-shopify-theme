// Screenshots the home page with the kolam thread fully drawn (scrolled to
// the bottom) at desktop and phone widths, plus one mid-scroll frame.
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync("npm root -g").toString().trim(), "playwright"));
const out = new URL("./out/", import.meta.url).pathname;
const origin = "https://jvli-preview.test/";
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const browser = await chromium.launch();
for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin + "/" !== origin) return route.abort();
    const path = join(out, decodeURIComponent(url.pathname).replace(/\/$/, "/index.html"));
    if (!existsSync(path)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[extname(path)] ?? "application/octet-stream", body: readFileSync(path) });
  });
  await page.goto(origin + "index.html");
  await page.waitForTimeout(800);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * 0.4));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `thread-${name}-mid.png`) });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const p = document.querySelector(".jvli-thread__line");
    return p ? { off: p.style.strokeDashoffset, dash: p.style.strokeDasharray, dots: document.querySelectorAll(".jvli-thread__dots circle").length } : null;
  });
  console.log(name, info);
  // Full drawing, captured one screen at a time (a full-page capture resizes
  // the window, which moves the line after the shot is taken).
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let i = 0, y = 0; y < total; i++, y += height) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(out, `thread-${name}-${i}.png`) });
  }
}
await browser.close();
