// End-to-end check of the made-to-order flow, run after any design change:
//   node test-made-to-order.mjs   (or: npm test)
// Renders the product page (MTO=1, stock 3, set add-ons: a pant with stock 4
// and a dupatta with stock 2) and the bag page (a kurti with its pant and
// dupatta) with
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

async function open(browser, width, height, query = "") {
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
    if (url.pathname.endsWith("/search/suggest.json")) {
      const product = (id, title, tags) => ({ id, title, tags, url: `/products/p${id}`, price: "999.00", available: true });
      const body = { resources: { results: { products: [product(1, "Kaveri Kurti", ["cotton"]), product(901, "Dupatta for Kaveri Kurti", ["Dupatta"]), product(902, "Pant for Kaveri Kurti", ["pant"])], collections: [], pages: [] } } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (url.pathname === "/checkout") return route.fulfill({ status: 200, contentType: "text/html", body: "checkout" });
    if (url.host !== "jvli-preview.test") return route.abort();
    const file = join(out, url.pathname);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: types[extname(file)] }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto("https://jvli-preview.test/index.html" + query);
  await page.waitForTimeout(800);
  return { page, state };
}

// Whether the page is pointing at the Size choice: the note under the sizes
// shows and the boxes are outlined.
const askingForSize = (page) =>
  page.evaluate(() => {
    const set = document.querySelector('[data-jvli-property="Size"]');
    const note = set.querySelector("[data-jvli-property-note]");
    const box = set.getBoundingClientRect();
    return !note.hidden && note.textContent === "Please choose a size" && set.classList.contains("is-missing") && box.top >= 0 && box.bottom <= window.innerHeight;
  });

// Which photo (1, 2, 3...) is in front: the active one, or on phones the one scrolled to.
const frontPhoto = (page) =>
  page.evaluate(() => {
    const slides = [...document.querySelectorAll(".jvli-product__slide")];
    const g = document.querySelector("[data-jvli-slides]");
    const scrolled = g.scrollWidth > g.clientWidth + 1;
    const front = scrolled ? slides[Math.round(g.scrollLeft / g.clientWidth)] : slides.find((s) => s.classList.contains("is-active"));
    return slides.indexOf(front) + 1;
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
    size: document.querySelector('[data-jvli-property="Size"] input:checked')?.value ?? null,
    otherChoices: document.querySelectorAll("[data-jvli-property]").length - 1,
  }));
  check("Size choices come from the product's sizes field", start.sizes.join() === "XS,S,M,L,XL", start.sizes.join());
  check("Size is the only made-to-order choice", start.otherChoices === 0, start.otherChoices);
  check("No size chosen to start with", start.size === null, start.size);

  check("Buy it now waits until a size is chosen", await waiting());
  await page.locator(".shopify-payment-button .shopify-payment-button__button").click({ force: true });
  await page.waitForTimeout(700);
  check("Tapping the waiting Buy it now points at the sizes", await askingForSize(page));

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click("[data-jvli-add-button]");
  await page.waitForTimeout(900);
  check("Add to bag without a size scrolls to the sizes and points at them", await askingForSize(page));
  check("No message under Add to bag", (await message.textContent()) === "", await message.textContent());
  check("Nothing is sent to the bag without a size", state.adds.length === 0, state.adds.length);

  const arrows = await page.evaluate(() => [...document.querySelectorAll("[data-jvli-step]")].filter((a) => !a.hidden && a.offsetParent).length);
  check("Both photo arrows show", arrows === 2, arrows);
  const seen = [await frontPhoto(page)];
  for (let k = 0; k < 3; k++) {
    await page.click('[data-jvli-step="1"]');
    await page.waitForTimeout(450);
    seen.push(await frontPhoto(page));
  }
  await page.click('[data-jvli-step="-1"]');
  await page.waitForTimeout(450);
  seen.push(await frontPhoto(page));
  check("Arrows step through all photos and wrap around", seen.join(">") === "1>2>3>1>3", seen.join(">"));

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
    "Add to bag sends the variant, quantity 2 and Size L",
    sent && sent.id > 0 && sent.quantity === 2 && JSON.stringify(sent.properties) === JSON.stringify({ Size: "L" }),
    JSON.stringify(sent),
  );
  check("No page errors", state.errors.length === 0, state.errors.join("; "));
  await page.close();

  console.log(`\nSets, ${label}`);
  const look = (page) =>
    page.evaluate(() => {
      const box = document.querySelector("[data-jvli-set]");
      const shown = (el) => !!el && !el.closest("[hidden]") && getComputedStyle(el).display !== "none";
      return {
        label: box.querySelector("[data-jvli-set-value]").textContent,
        options: [...box.querySelectorAll("label")].map((l) => l.innerText.trim()),
        price: document.querySelector("[data-jvli-price] .jvli-product__price-now").textContent.trim(),
        max: document.querySelector('input[name="quantity"]').max,
        shopifyBuy: shown(document.querySelector(".shopify-payment-button .shopify-payment-button__button")),
        ourBuy: shown(document.querySelector("[data-jvli-buy-both]")),
      };
    });
  const rupees = (text) => Number(text.replace(/[^\d.]/g, ""));
  const pickSet = (page, n) => page.locator("[data-jvli-set] label").nth(n).click();
  {
    const { page, state } = await open(browser, width, height);
    let d = await look(page);
    check("Set choices show their prices", d.options.join(" | ") === "Kurti only | + Pant +₹600 | + Dupatta +₹300 | Full set +₹900", d.options.join(" | "));
    const plainPrice = d.price;
    check("Kurti only to start with", d.label === "Kurti only" && d.max === "3", JSON.stringify(d));
    check("Kurti only: Shopify's Buy it now shows", d.shopifyBuy && !d.ourBuy, JSON.stringify(d));

    await pickSet(page, 1);
    await page.waitForTimeout(100);
    d = await look(page);
    check("Kurti + pant: price up by ₹600, counter stays 3", d.label === "Kurti + pant" && rupees(d.price) === rupees(plainPrice) + 600 && d.max === "3", `${plainPrice} -> ${d.price}, max ${d.max}`);

    await pickSet(page, 3);
    await page.waitForTimeout(100);
    d = await look(page);
    check("Full set: price up by ₹900", d.label === "Full set" && rupees(d.price) === rupees(plainPrice) + 900, `${plainPrice} -> ${d.price}`);
    check("Full set: counter stops at the lowest stock (dupatta, 2)", d.max === "2", d.max);
    check("Full set: our Buy it now shows instead of Shopify's", d.ourBuy && !d.shopifyBuy, JSON.stringify(d));

    await page.click("[data-jvli-buy-both]");
    await page.waitForTimeout(700);
    check("Our Buy it now points at the sizes first", (await askingForSize(page)) && state.adds.length === 0);

    await page.locator('[data-jvli-property="Size"] label').filter({ has: page.locator('input[value="L"]') }).click();
    const cleared = await page.evaluate(() => {
      const set = document.querySelector('[data-jvli-property="Size"]');
      return set.querySelector("[data-jvli-property-note]").hidden && !set.classList.contains("is-missing");
    });
    check("Picking a size clears the note and outline", cleared);
    for (let k = 0; k < 3; k++) await page.click('[data-jvli-qty="1"]');
    await page.click("[data-jvli-add-button]");
    await page.waitForTimeout(300);
    const items = state.adds[0]?.items || [];
    check(
      "Add to bag sends the kurti, its pant (with Size) and its dupatta, 2 each",
      items.length === 3 &&
        items[0].quantity === 2 && JSON.stringify(items[0].properties) === JSON.stringify({ Size: "L" }) &&
        items[1].id === 9020 && items[1].quantity === 2 &&
        JSON.stringify(items[1].properties) === JSON.stringify({ Size: "L", For: "Kaveri Kurti (L)" }) &&
        items[2].id === 9010 && items[2].quantity === 2 &&
        JSON.stringify(items[2].properties) === JSON.stringify({ For: "Kaveri Kurti (L)" }),
      JSON.stringify(items),
    );

    await page.waitForTimeout(1700);
    await page.click("[data-jvli-buy-both]");
    await page.waitForURL("**/checkout", { timeout: 3000 }).catch(() => {});
    check("Our Buy it now adds every piece, then goes to checkout", state.adds.length === 2 && state.adds[1].items.length === 3 && page.url().endsWith("/checkout"), page.url());
    check("No page errors", state.errors.length === 0, state.errors.join("; "));
    await page.close();
  }
  {
    const { page } = await open(browser, width, height);
    await pickSet(page, 3);
    await pickSet(page, 0);
    await page.waitForTimeout(100);
    const back = await page.evaluate(() => ({
      price: document.querySelector("[data-jvli-price]").innerHTML.trim(),
      plain: JSON.parse(document.querySelector("[data-jvli-variants]").textContent)[0].price,
      max: document.querySelector('input[name="quantity"]').max,
      ours: !!document.querySelector("[data-jvli-buy-both-wrap]").hidden,
    }));
    check("Back to Kurti only: price, counter (3) and Shopify's Buy it now back", back.price === back.plain && back.max === "3" && back.ours, JSON.stringify(back));
    await page.close();
  }
  {
    const { page } = await open(browser, width, height, "?set=full");
    const d = await look(page);
    check("?set=full arrives with the full set chosen", d.label === "Full set" && d.ourBuy, JSON.stringify(d));
    await page.close();
  }
}

/* ---------- Sold-out dupatta ---------- */
render({ MTO: "1", TEMPLATE: "product", DUPATTA_SOLD_OUT: "1" });
console.log("\nSold-out dupatta");
{
  const { page, state } = await open(browser, 1440, 900, "?set=full");
  const out = await page.evaluate(() =>
    [...document.querySelectorAll("[data-jvli-set] label")].map((label) => ({
      text: label.innerText.trim(),
      disabled: label.querySelector("input").disabled,
      marked: label.classList.contains("is-unavailable"),
      checked: label.querySelector("input").checked,
    })),
  );
  check("Sold-out dupatta says so and can't be picked", out[2].text === "+ Dupatta (sold out)" && out[2].disabled && out[2].marked, JSON.stringify(out[2]));
  check("The full set is sold out too", out[3].text === "Full set (sold out)" && out[3].disabled, JSON.stringify(out[3]));
  check("?set=full falls back to the pant set when the full set is sold out", out[1].checked, JSON.stringify(out));
  check("The pant can still be picked", !out[1].disabled, JSON.stringify(out[1]));
  await page.locator("[data-jvli-set] label").nth(0).click();
  await page.locator('[data-jvli-property="Size"] label').filter({ has: page.locator('input[value="M"]') }).click();
  await page.click("[data-jvli-add-button]");
  await page.waitForTimeout(300);
  const items = state.adds[0]?.items || [];
  check("The kurti can still be bought on its own", items.length === 1 && items[0].properties.Size === "M", JSON.stringify(items));
  await page.close();
}

/* ---------- Bag page ---------- */
render({ MTO: "1", TEMPLATE: "cart" });
console.log("\nBag page");
{
  const { page, state } = await open(browser, 1440, 900);
  const text = await page.locator("[data-jvli-cart-line]").first().innerText();
  check("Bag line shows the chosen Size", text.includes("Size: M"), text.replace(/\s+/g, " "));
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
  const pantRow = rows[1];
  const dupattaRow = rows[2];
  check("Pant and dupatta sit right under their kurti", rows.map((r) => r.line).join() === "1,5,4,2,3" && pantRow.name.startsWith("Pant for") && dupattaRow.name.startsWith("Dupatta for"), rows.map((r) => r.line + " " + r.name).join(" | "));
  check("Pant line shows its Size and which kurti it's for", pantRow.text.includes("Size: M") && pantRow.text.includes("For: ") && pantRow.text.includes("(M)"), pantRow.text);
  check("Dupatta line says which kurti it's for", dupattaRow.text.includes("For: ") && dupattaRow.text.includes("(M)"), dupattaRow.text);
  check("Add-on lines have no counter, show their quantity", !pantRow.counter && !dupattaRow.counter && dupattaRow.text.includes("Qty 1"), dupattaRow.text);
  check("Add-on lines link to their kurti", pantRow.href === kurtiRow.href && dupattaRow.href === kurtiRow.href, `${pantRow.href} vs ${kurtiRow.href}`);
  check("Kurti counter stops where the lowest add-on stock runs out (pant, 2)", kurtiRow.max === "2", kurtiRow.max);
  await page.close();

  const step = async (selector) => {
    const { page, state } = await open(browser, 1440, 900);
    await page.click(selector);
    await page.waitForTimeout(700);
    await page.close();
    return state.updates[0] || null;
  };
  let sent = await step('[data-jvli-cart-line="1"] [data-jvli-cart-step="1"]');
  check("Kurti + also adds one to its pant and dupatta", JSON.stringify(sent) === JSON.stringify({ [kurtiRow.key]: 2, [pantRow.key]: 2, [dupattaRow.key]: 2 }), JSON.stringify(sent));
  sent = await step('[data-jvli-cart-line="1"] [data-jvli-cart-remove]');
  check("Removing the kurti removes its pant and dupatta", JSON.stringify(sent) === JSON.stringify({ [kurtiRow.key]: 0, [pantRow.key]: 0, [dupattaRow.key]: 0 }), JSON.stringify(sent));
  sent = await step('[data-jvli-cart-line="4"] [data-jvli-cart-remove]');
  check("Removing the dupatta keeps the kurti", JSON.stringify(sent) === JSON.stringify({ [dupattaRow.key]: 0 }), JSON.stringify(sent));
  sent = await step('[data-jvli-cart-line="2"] [data-jvli-cart-step="-1"]');
  check("Other lines change on their own", sent && Object.keys(sent).length === 1 && Object.values(sent)[0] === 1, JSON.stringify(sent));
}

/* ---------- Search ---------- */
render({ MTO: "1", TEMPLATE: "search" });
console.log("\nSearch");
{
  const { page, state } = await open(browser, 1440, 900);
  const page_ = await page.evaluate(() => ({
    names: [...document.querySelectorAll(".jvli-collection__grid .jvli-card")].map((c) => c.innerText),
    count: document.querySelector(".jvli-collection__count")?.textContent.trim(),
    total: document.querySelectorAll(".jvli-collection__grid .jvli-card").length,
  }));
  check("Search page leaves dupattas and pants out", page_.total > 0 && !page_.names.some((n) => n.includes("Dupatta") || n.includes("Pant for")), page_.names.length + " cards");
  check("Search page doesn't count them", page_.count === `${page_.total + 2} results`, page_.count);

  await page.click("[data-jvli-search-open]");
  await page.fill("[data-jvli-search-input]", "kaveri");
  await page.waitForTimeout(800);
  const typed = await page.evaluate(() => [...document.querySelectorAll("[data-jvli-search-results] .jvli-search__product-title")].map((t) => t.textContent));
  check("Type-ahead search leaves dupattas and pants out", typed.join() === "Kaveri Kurti", typed.join(" | "));
  check("No page errors", state.errors.length === 0, state.errors.join("; "));
  await page.close();
}

await browser.close();
// Leave the preview showing the home page, as render.mjs does by default.
render({});
console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
