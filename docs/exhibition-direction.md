# JVLI: The Exhibition

Creative direction for the experimental JVLI home page, built as a separate Shopify theme ("JVLI Exhibition"). The live theme is untouched.

**The one thing people remember tomorrow:** *the JVLI name was a piece of cloth, and when I scrolled, it turned over and it was a photograph.*

Everything else supports that one moment. There are only four "big" moments on the whole page: the cloth, the turn, the room and the ink. Everything between them is still.

---

## Step 1. Experience map

| # | World | The visitor sees | What moves | What stays still | They feel | Into the next world |
|---|---|---|---|---|---|---|
| 01 | **The Cloth** (arrival) | Warm cream, nearly empty. "JVLI" set enormous, edge to edge, like lettering printed on a sheet of cotton. Four tiny labels in the corners. No header. | The sheet breathes (a very slow, barely visible swell). Under the cursor or finger the cloth dents and ripples outward, and the ripples carry on after you stop, then settle. | The corner labels. Nothing else on screen. | "Is it moving?" Then: "it's reacting to me." | Scroll: the cloth turns over. |
| 02 | **The Turn** (the impossible moment) | The bottom corner of the sheet lifts and curls. The underside isn't paper, it's a photograph. The sheet rolls over fully, stretches and narrows, and settles as a single print hanging in space. | The whole sheet, driven by scroll: curl, roll over, compress, straighten. Light rakes across the curl so it reads as real material. | The cream room behind it. The labels fade out. | "Wait, the name was a photo?" | The print that lands *is* the first photograph of the Exhibition. |
| 03 | **The Exhibition** (editorial) | Three large photographs hung at different depths in a quiet space. Giant words ("ORDINARY", "DAYS") stand behind and between them like architecture, partly hidden by the prints. Tiny museum-style captions. | Scroll walks the camera forward through the depths, very slowly. The mouse turns the camera by a few degrees. Near prints pass faster than far ones. | The captions, the giant words (they only move with depth, never animate on their own). | Walking through a gallery at night. | The camera passes the last print and the floor appears: we are in a room. |
| 04 | **The Studio** (physical world) | A minimal room: a floor with a pool of window light, one back wall. A garment print hanging from a rail, a standing letter "J" as a sculpture with a real shadow, a folded fabric swatch on the floor, a small photograph leaning against the wall. | The hanging garment sways, the swatch floats a finger's width above the floor, the light pool drifts with the mouse. The camera dollies along the room with scroll. | The "J", the leaning photograph, the wall. Stillness is half of this scene. | Standing inside a studio. | The camera turns toward the rail: the clothes are here. |
| 05 | **Found Objects** (collection) | Real products, one at a time, each hanging on a fine thread in open space. As one reaches the centre it sharpens and straightens, and its label appears: JVLI / name / price. Sizes and Add to bag appear quietly under it. | Each garment drifts in, sharpens and settles as it reaches the centre, then drifts on. | The label and the buy controls once shown. | Discovering clothes, not browsing a grid. | Past the last product, the space empties out. |
| 06 | **The Ink** (the unnecessary moment) | A tall, empty cream space. Nothing to read. | If the cursor moves (or a finger drags) here, a tiny madder-red ink dot appears. Keep moving and it feeds: it blooms into an enormous block-print flower bleeding into the cotton, filling the screen, then dries and fades to a faint stain. | Everything else. There is no text, no button. | "What the hell was that?" | Scroll on and it's gone. |
| 07 | **Quiet End** | Almost nothing. A small JVLI, one line: MADE FOR ORDINARY DAYS. Four tiny links: Shop, Instagram, About, Contact. | Nothing. | Everything. | Silence after the noise. | The end. |

**The header:** hidden during the Cloth and the Turn. It slides in, small and quiet, once the Exhibition starts, and it works exactly as today (Shop, New In, Kurtis, Collections, Our Story, Search, Account, Bag, the phone menu). All other pages keep the current JVLI design.

---

## Step 2. Screen designs

### 01 The Cloth
- **Viewport:** 100% of the screen height. Background `#F1EBE1` with fine paper grain.
- **Wordmark:** "JVLI" in Newsreader, light weight, tight letter spacing, about 88% of the viewport width. Set slightly below centre, so the empty space above feels deliberate. Ink colour `#1F1814`.
- **Corner labels** (Jost, 10px, 0.2em letter spacing, uppercase):
  - top left: JVLI / Tamil Nadu
  - top right: Ordinary days
  - bottom left: Clothes for real life
  - bottom right: Scroll
- **Render:** the wordmark and the sheet are one WebGL cloth (a 96 × 54 grid of springs). The text is drawn into the cloth's texture, so the letters bend with the fabric. Light comes from the top left, so dents and ripples show as soft shading.
- **Interaction:** the cursor presses into the cloth within about 12% of the viewport. The dent spreads as a damped wave. When the cursor stops, the waves keep running briefly, then calm.
- **Phones:** the same, with the finger. The wordmark is rotated to read upward along the left edge, so it can stay enormous.

### 02 The Turn
- **Pinned** for 1.6 screen heights of scrolling.
- **0 to 25%:** the bottom-right corner lifts into a curl. The underside shows the hero photograph (the woman at the doorway).
- **25 to 70%:** the curl rolls across the sheet diagonally until the photo side faces us. The name is now on the back.
- **70 to 100%:** the sheet narrows to the proportions of a print and eases into the first Exhibition position (60% of the viewport height, left of centre). It leaves a soft shadow.
- **Hand-off:** at 100%, the WebGL print is swapped for the real image element in exactly the same place, so there's no seam.

### 03 The Exhibition
- **Pinned** for 3 screen heights. The CSS 3D scene has a 1400px perspective.
- **Prints:**
  - A: 60% height, left, 0 depth.
  - B: 42% height, right, 900px deep.
  - C: 70% height, centre, 1900px deep.
- **Giant words:** "ORDINARY" at 22vw, 500px deep, sits behind A. "DAYS" at 30vw, 1500px deep, sits behind C. Their colour is `#E6DDCF`, only a shade darker than the paper, so they read as walls rather than text.
- **Captions** (9px caps) sit under each print, museum style:
  - "No. 01 / Doorway, Kanchipuram / Cotton"
- **Camera:** scroll moves it from 0 to 2200px deep. The mouse turns it up to 3° either way.

### 04 The Studio
- **Pinned** for 2.5 screen heights. The room is a floor plane tilted 80° and a back wall.
- **Objects:**
  - Hanging garment print on a thin rail, swaying 1.5° over a 7s period.
  - Standing "J" 40vh tall, with a shadow skewed across the floor.
  - Fabric swatch floating 6px up and down over 9s, with a contact shadow that tightens as it lowers.
  - Leaning photograph, still.
- **Light:** a soft elliptical pool on the floor that follows the mouse slowly.
- **Camera:** scroll dollies from left to right, with a slight yaw.

### 05 Found Objects
- **Products** come from a collection you choose in the editor (default: New In).
- **Desktop:** each product occupies one screen height. The print hangs from a hairline thread coming down from the top edge.
- **Entering the centre:** blur goes from 8px to 0, saturation from 60% to 100%, rotation from 3° to 0.
- **Label:** JVLI (9px caps) / name (Newsreader 40px) / price (Jost 13px). The sizes and Add to bag use the site's existing add-to-bag, so buying works exactly as it does now, with the photo flying into the bag.
- **Click the photo:** opens the product page, with the page-turn fade.
- **Phones:** the same one-at-a-time rhythm, scrolling vertically.

### 06 The Ink
- **Space:** 120% of the screen height, empty.
- **Drawing:** a canvas draws a procedural block-print flower (eight petals, an inner ring, stamens) in madder red `#8E2F26`. It's stamped as ink with slightly bled edges and textured with cotton grain.
- **Growth:** the flower grows with how far the cursor or finger has moved (not with time), up to 160% of the viewport, then dries over 3s to 12% opacity.
- **Once:** it happens once per visit. The stain stays.

### 07 Quiet End
- **Space:** 70% of the screen height, content centred.
- **Content:**
  - JVLI in Newsreader, 28px.
  - "MADE FOR ORDINARY DAYS." in Jost, 11px, 0.3em letter spacing.
  - Links 40px below: Shop · Instagram · About · Contact.
- **Footer:** the usual footer is not shown on this page.

---

## Step 3. Motion system

- **Durations:**
  - interface: 180ms (hover), 320ms (reveal)
  - ambient loops: 7 to 14s
  - scenes: no fixed duration, because scroll drives them
- **Easing:**
  - reveals: `cubic-bezier(0.22, 1, 0.36, 1)` (a long, soft settle)
  - scroll-scrubbed mappings: `cubic-bezier(0.65, 0, 0.35, 1)`
  - none of it overshoots or bounces
- **Inertia:** every value driven by the pointer or scroll is smoothed toward its target each frame, at 0.06 to 0.1 of the gap. Scene progress is smoothed at 0.1. The cloth uses real spring physics with damping.
- **Scroll:** native scrolling, never hijacked. Scenes are sticky and pinned for a set height, and progress is read from their position.
- **Mouse:** normalised to -1 to 1, smoothed. It turns the camera at most 3°. There's no custom cursor.
- **Stillness rule:** in any scene at most two things move at once, and at least one large element is perfectly still.
- **Page to page:** the existing page-turn fade.
- **Reduced motion:**
  - no WebGL
  - the Cloth is a still typographic poster
  - the Turn becomes a simple crossfade to the photo
  - scenes aren't pinned
  - the Ink shows a finished, faded flower
  - everything stays usable
- **Performance:**
  - one WebGL context, only for the Cloth and the Turn, paused off-screen, pixel density capped at 1.75
  - everything else is CSS transforms on the graphics card
  - images come from Shopify's resized versions and load lazily
  - no libraries: the WebGL is about 7KB of our own code
  - every animation pauses when its scene is off-screen
