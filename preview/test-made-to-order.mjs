// End-to-end check of the made-to-order flow, run after any design change:
//   node test-made-to-order.mjs   (or: npm test)
// Renders the product page (MTO=1, stock 3, dupatta add-on with stock 2)
// and the bag page (a kurti paired with its dupatta) with
// render.mjs, then drives them in Chromium at desktop and phone widths.
// Requests to /cart/add.js are caught so nothing reaches a store. Prints
// PASS/FAIL per check and exits 1 if anything failed.
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require(join(execSync("npm root -g").toString().trim(), "playwright"));

const here = new URL(".", import.meta.url).pathname;
const out = join(here, "out");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

let failed = 0;
function check(name, ok, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (got: ${detail})` : ""}`);
}

function render(env) {
  execSync("node render.mjs", { cwd: here, env: { ...process.env, ...env }, stdio: "ignore" });
}

async function open(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const state = { errors: [], adds: [], updates: [] };
  page.on("pageerror", (e) => state.errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/cart/add.js")) {
      state.adds.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (url.pathname.endsWith("/cart.js")) return route.fulfill({ status: 200, contentType: "application/json", body: '{"item_count":1}' });
    if (url.pathname.endsWith("/cart/update.js")) {
      state.updates.push(JSON.parse(route.request().postData()).updates);
      // No re-rendered section in the reply, so the page reloads itself.
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"item_count":1,"sections":{}}' });
    }
    if (url.pathname === "/checkout") return route.fulfill({ status: 200, contentType: "text/html", body: "checkout" });
    if (url.host !== "jvli-preview.test") return route.abort();
    const file = join(out, url.pathname);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: types[extname(file)] }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto("https://jvli-preview.test/index.html");
  await page.waitForTimeout(800);
  return { page, state };
}

// The photos showing, by their alt text ("untagged" for none), and the one in front.
const photos = (page) =>
  page.evaluate(() => {
    const slides = [...document.querySelectorAll(".jvli-product__slide")];
    const shown = slides.filter((s) => !s.classList.contains("is-filtered"));
    const g = document.querySelector("[data-jvli-slides]");
    const scrolled = g.scrollWidth > g.clientWidth + 1;
    const front = scrolled ? shown[Math.round(g.scrollLeft / g.clientWidth)] : slides.find((s) => s.classList.contains("is-active"));
    const name = (s) => (s && s.dataset.jvliAlt) || "untagged";
    return { shown: shown.map(name), front: name(front) };
  });

const browser = await chromium.launch();

/* ---------- Product page ---------- */
render({ MTO: "1", TEMPLATE: "product" });
for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  console.log(`\nProduct page, ${label}`);
  const { page, state } = await open(browser, width, height);
  const message = page.locator("[data-jvli-add-message]").first();
  const waiting = () => page.evaluate(() => document.querySelector("[data-jvli-buy-now-wait]")?.classList.contains("is-waiting"));

  const start = await page.evaluate(() => ({
    sizes: [...document.querySelectorAll('[data-jvli-property="Size"] input')].map((i) => i.value),
    sleeves: [...document.querySelectorAll('[data-jvli-property="Sleeve"] input')].map((i) => i.value),
    size: document.querySelector('[data-jvli-property="Size"] input:checked')?.value ?? null,
    sleeve: document.querySelector('[data-jvli-property="Sleeve"] input:checked')?.value ?? null,
    sleeveLabel: document.querySelector('[data-jvli-property="Sleeve"] [data-jvli-property-value]')?.textContent,
  }));
  check("Size choices come from the product's sizes field", start.sizes.join() === "XS,S,M,L,XL", start.sizes.join());
  check("Sleeve choices come from the product's sleeves field", start.sleeves.join() === "Short,3/4,Full", start.sleeves.join());
  check("No size chosen to start with", start.size === null, start.size);
  check("First sleeve chosen to start with, and named", start.sleeve === "Short" && start.sleeveLabel === "Short", `${start.sleeve} / ${start.sleeveLabel}`);

  check("Buy it now waits until a size is chosen", await waiting());
  await page.locator(".shopify-payment-button .shopify-payment-button__button").click({ force: true });
  await page.waitForTimeout(150);
  check("Tapping the waiting Buy it now asks for a size", (await message.textContent()) === "Please choose a size.", await message.textContent());

  await message.evaluate((el) => (el.textContent = ""));
  await page.click("[data-jvli-add-button]");
  await page.waitForTimeout(200);
  check("Add to bag without a size asks for one", (await message.textContent()) === "Please choose a size.", await message.textContent());
  check("Nothing is sent to the bag without a size", state.adds.length === 0, state.adds.length);

  // Photos: Short shows its own photo and the untagged one; 3/4 has none of
  // its own, so all show; Full shows its own and the untagged one.
  let p = await photos(page);
  check("Short sleeve: only Short and untagged photos", p.shown.join("|") === "Short sleeve|untagged", p.shown.join("|"));
  check("Short sleeve: a Short photo is in front", p.front === "Short sleeve", p.front);
  const arrows = await page.evaluate(() => [...document.querySelectorAll("[data-jvli-step]")].filter((a) => !a.hidden && a.offsetParent).length);
  check("Both photo arrows show", arrows === 2, arrows);
  const seen = [];
  for (let k = 0; k < 2; k++) {
    await page.click('[data-jvli-step="1"]');
    await page.waitForTimeout(450);
    seen.push((await photos(page)).front);
  }
  check("Next arrow steps through the shown photos and wraps", seen.join(">") === "untagged>Short sleeve", seen.join(">"));
  await page.locator('[data-jvli-property="Sleeve"] label', { hasText: "3/4" }).click();
  await page.waitForTimeout(450);
  p = await photos(page);
  check("3/4 sleeve (no own photos): all photos show", p.shown.length === 3, p.shown.join("|"));
  await page.locator('[data-jvli-property="Sleeve"] label', { hasText: "Full" }).click();
  await page.waitForTimeout(450);
  p = await photos(page);
  check("Full sleeve: only Full and untagged photos", p.shown.join("|") === "Model in a full sleeve kurti|untagged", p.shown.join("|"));
  check("Full sleeve: a Full photo is in front", p.front === "Model in a full sleeve kurti", p.front);

  // The sample product has placeholders, not photos, so try a photo in a slide.
  const fit = await page.evaluate(() => {
    const img = document.createElement("img");
    document.querySelector(".jvli-product__slide").appendChild(img);
    const value = getComputedStyle(img).objectFit;
    img.remove();
    return value;
  });
  check("Photos are shown whole, never cropped", fit === "contain", fit);

  // Counter: stock is 3.
  const qty = page.locator('input[name="quantity"]');
  for (let k = 0; k < 5; k++) await page.click('[data-jvli-qty="1"]');
  check("Counter + stops at the stock count (3)", (await qty.inputValue()) === "3", await qty.inputValue());
  await qty.fill("50");
  await qty.press("Tab");
  check("Typing more than the stock drops back to it", (await qty.inputValue()) === "3", await qty.inputValue());
  await qty.fill("0");
  await qty.press("Tab");
  check("Typing 0 goes back to 1", (await qty.inputValue()) === "1", await qty.inputValue());
  await page.click('[data-jvli-qty="1"]');

  await page.locator('[data-jvli-property="Size"] label').filter({ has: page.locator('input[value="L"]') }).click();
  await page.waitForTimeout(100);
  check("Choosing a size names it", (await page.locator('[data-jvli-property="Size"] [data-jvli-property-value]').textContent()) === "L");
  check("Buy it now opens once a size is chosen", !(await waiting()));

  await page.click("[data-jvli-add-button]");
  await page.waitForTimeout(300);
  const sent = state.adds[0]?.items?.[0];
  check(
    "Add to bag sends the variant, quantity 2, Size L and Sleeve Full",
    sent && sent.id > 0 && sent.quantity === 2 && sent.properties?.Size === "L" && sent.properties?.Sleeve === "Full" && Object.keys(sent.properties).length === 2,
    JSON.stringify(sent),
  );
  check("No page errors", state.errors.length === 0, state.errors.join("; "));
  await page.close();

  console.log(`\nDupatta add-on, ${label}`);
  {
    const { page, state } = await open(browser, width, height);
    const message = page.locator("[data-jvli-add-message]").first();
    const look = () =>
      page.evaluate(() => {
        const box = document.querySelector("[data-jvli-dupatta]");
        const total = box.querySelector("[data-jvli-dupatta-total]");
        const shown = (el) => !!el && !el.closest("[hidden]") && getComputedStyle(el).display !== "none";
        return {
          label: box.querySelector("[data-jvli-dupatta-value]").textContent,
          withText: box.querySelectorAll("label")[1].innerText.trim(),
          total: shown(total) ? total.textContent : null,
          max: document.querySelector('input[name="quantity"]').max,
          shopifyBuy: shown(document.querySelector(".shopify-payment-button .shopify-payment-button__button")),
          ourBuy: shown(document.querySelector("[data-jvli-buy-both]")),
          cents: JSON.parse(document.querySelector("[data-jvli-variants]").textContent)[0].cents,
        };
      });
    let d = await look();
    check("Dupatta choice shows its price", d.withText === "With dupatta +₹300", d.withText);
    check("Without dupatta to start with", d.label === "Without" && d.total === null && d.max === "3", JSON.stringify(d));
    check("Without dupatta: Shopify's Buy it now shows", d.shopifyBuy && !d.ourBuy, JSON.stringify(d));

    await page.locator('[data-jvli-dupatta] label').nth(1).click();
    await page.waitForTimeout(100);
    d = await look();
    const expected = "With dupatta: ₹" + ((d.cents + 30000) / 100).toLocaleString("en-IN");
    check("With dupatta: the total shows", d.label === "With" && d.total === expected, `${d.label} / ${d.total} (want ${expected})`);
    check("With dupatta: counter stops at the dupatta's stock (2)", d.max === "2", d.max);
    check("With dupatta: our Buy it now shows instead of Shopify's", d.ourBuy && !d.shopifyBuy, JSON.stringify(d));

    await page.click("[data-jvli-buy-both]");
    await page.waitForTimeout(200);
    check("Our Buy it now asks for a size first", (await message.textContent()) === "Please choose a size." && state.adds.length === 0, await message.textContent());

    await page.locator('[data-jvli-property="Size"] label').filter({ has: page.locator('input[value="L"]') }).click();
    for (let k = 0; k < 3; k++) await page.click('[data-jvli-qty="1"]');
    await page.click("[data-jvli-add-button]");
    await page.waitForTimeout(300);
    const items = state.adds[0]?.items || [];
    check(
      "Add to bag sends the kurti and its dupatta, 2 each",
      items.length === 2 &&
        items[0].quantity === 2 && items[0].properties.Size === "L" && items[0].properties.Sleeve === "Short" &&
        items[1].id === 9010 && items[1].quantity === 2 &&
        JSON.stringify(items[1].properties) === JSON.stringify({ For: "Kaveri Kurti (L, Short)" }),
      JSON.stringify(items),
    );

    await page.waitForTimeout(1700);
    await page.click("[data-jvli-buy-both]");
    await page.waitForURL("**/checkout", { timeout: 3000 }).catch(() => {});
    check("Our Buy it now adds both, then goes to checkout", state.adds.length === 2 && state.adds[1].items.length === 2 && page.url().endsWith("/checkout"), page.url());
    check("No page errors", state.errors.length === 0, state.errors.join("; "));
    await page.close();
  }
  {
    const { page } = await open(browser, width, height);
    await page.locator('[data-jvli-dupatta] label').nth(1).click();
    await page.locator('[data-jvli-dupatta] label').nth(0).click();
    await page.waitForTimeout(100);
    const back = await page.evaluate(() => ({
      max: document.querySelector('input[name="quantity"]').max,
      ours: !!document.querySelector("[data-jvli-buy-both-wrap]").hidden,
    }));
    check("Back to Without: counter back to 3, Shopify's Buy it now back", back.max === "3" && back.ours, JSON.stringify(back));
    await page.close();
  }
}

/* ---------- Bag page ---------- */
render({ MTO: "1", TEMPLATE: "cart" });
console.log("\nBag page");
{
  const { page, state } = await open(browser, 1440, 900);
  const text = await page.locator("[data-jvli-cart-line]").first().innerText();
  check("Bag line shows the chosen Size and Sleeve", text.includes("Size: M") && text.includes("Sleeve: Short"), text.replace(/\s+/g, " "));
  check("Bag line hides properties starting with _", !text.includes("_hidden"));
  const each = await page.locator("[data-jvli-cart-line] .jvli-cart__each").allInnerTexts();
  check("Price breakup shows only on lines with more than one piece", each.length === 1 && /^₹[\d,.]+ × 2 = ₹[\d,.]+$/.test(each[0]), each.join(" | "));
  const max = await page.locator('[data-jvli-cart-line="2"] [data-jvli-cart-qty]').getAttribute("max");
  check("Bag counter stops at the stock count", max === "5", max);
  check("No page errors", state.errors.length === 0, state.errors.join("; "));

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("[data-jvli-cart-line]")].map((row) => ({
      line: row.dataset.jvliCartLine,
      key: row.dataset.jvliCartKey,
      name: row.querySelector(".jvli-cart__name").textContent.trim(),
      href: row.querySelector(".jvli-cart__name").getAttribute("href"),
      counter: !!row.querySelector("[data-jvli-cart-qty]"),
      max: row.querySelector("[data-jvli-cart-qty]")?.max ?? null,
      text: row.innerText.replace(/\s+/g, " "),
    })),
  );
  const kurtiRow = rows[0];
  const dupattaRow = rows[1];
  check("Dupatta line sits right under its kurti", rows.map((r) => r.line).join() === "1,4,2,3" && dupattaRow.name.startsWith("Dupatta for"), rows.map((r) => r.line + " " + r.name).join(" | "));
  check("Dupatta line says which kurti it's for", dupattaRow.text.includes("For: ") && dupattaRow.text.includes("(M, Short)"), dupattaRow.text);
  check("Dupatta line has no counter, shows its quantity", !dupattaRow.counter && dupattaRow.text.includes("Qty 1"), dupattaRow.text);
  check("Dupatta line links to its kurti", dupattaRow.href === kurtiRow.href, `${dupattaRow.href} vs ${kurtiRow.href}`);
  check("Kurti counter stops where the dupatta's stock runs out (3)", kurtiRow.max === "3", kurtiRow.max);
  await page.close();

  const step = async (selector) => {
    const { page, state } = await open(browser, 1440, 900);
    await page.click(selector);
    await page.waitForTimeout(700);
    await page.close();
    return state.updates[0] || null;
  };
  let sent = await step('[data-jvli-cart-line="1"] [data-jvli-cart-step="1"]');
  check("Kurti + also adds one to its dupatta", JSON.stringify(sent) === JSON.stringify({ [kurtiRow.key]: 2, [dupattaRow.key]: 2 }), JSON.stringify(sent));
  sent = await step('[data-jvli-cart-line="1"] [data-jvli-cart-remove]');
  check("Removing the kurti removes its dupatta", JSON.stringify(sent) === JSON.stringify({ [kurtiRow.key]: 0, [dupattaRow.key]: 0 }), JSON.stringify(sent));
  sent = await step('[data-jvli-cart-line="4"] [data-jvli-cart-remove]');
  check("Removing the dupatta keeps the kurti", JSON.stringify(sent) === JSON.stringify({ [dupattaRow.key]: 0 }), JSON.stringify(sent));
  sent = await step('[data-jvli-cart-line="2"] [data-jvli-cart-step="-1"]');
  check("Other lines change on their own", sent && Object.keys(sent).length === 1 && Object.values(sent)[0] === 1, JSON.stringify(sent));
}

await browser.close();
// Leave the preview showing the home page, as render.mjs does by default.
render({});
console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
