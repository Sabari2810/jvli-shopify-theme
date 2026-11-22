/* ==========================================================================
   நல்வரவு loading screen (snippets/jvli-intro.liquid)
   Under a woven coconut-frond panthal with its thoranam, a painted marquee
   board drops from the panthal on two jute threads, bounces as the threads
   catch, sways to rest, and its bulbs come on letter by letter: each
   filament warms from orange to warm white, a few loose bulbs stutter, and
   the light blooms around the bulbs, brightens the painted letters and
   spills onto the wall. Everything is drawn on one canvas so the glow can be
   added up like real light. The snippet decides whether to show it.
   ========================================================================== */
(function () {
  var intro = document.getElementById('JvliIntro');
  if (!intro || intro.hidden || intro.dataset.jvliBoard) return;
  intro.dataset.jvliBoard = 'true';
  var canvas = intro.querySelector('canvas');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  var WORD = ['ந', 'ல்', 'வ', 'ர', 'வு'];
  var PAINT = ['#ecc33a', '#ecc33a', '#ecc33a', '#ecc33a', '#ecc33a'];
  var FONT = '"Baloo Thambi 2", "Noto Sans Tamil", "Tamil Sangam MN", "Latha", sans-serif';
  var WEIGHT = '600 ';

  // Timeline, in seconds from the start.
  var FALL = 0.42; // the board drops until the threads catch
  var LIGHTS_ON = 0.95; // first letter switches on
  var LETTER_GAP = 0.2; // between letters
  var HOLD_UNTIL = 3.3; // fully lit, then the screen fades

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var vw = 0;
  var vh = 0;
  var board = null; // geometry and cached drawings, rebuilt on resize
  var wall = null;
  var anchorY = -10; // where the threads are tied: the panthal's bamboo stick
  var scene = null; // the panthal photo, when it has loaded

  // The panthal photo: what to show of it, and where its bamboo stick runs.
  var SCENE = {
    top: 0.09, // the top strip is cropped off
    stick: 372 / 941, // the stick, as a share of the photo's height
  };
  var start = 0;
  var done = false;

  // A repeatable random sequence, so a bulb behaves the same every frame.
  function seeded(seed) {
    return function () {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  function layer(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    var g = c.getContext('2d');
    g.scale(dpr, dpr);
    return { canvas: c, ctx: g };
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Soft round light, white-hot in the middle when `core` is set.
  function sprite(radius, stops) {
    var size = radius * 2;
    var l = layer(size, size);
    var grad = l.ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    stops.forEach(function (s) {
      grad.addColorStop(s[0], s[1]);
    });
    l.ctx.fillStyle = grad;
    l.ctx.fillRect(0, 0, size, size);
    return l.canvas;
  }

  /* ---------- The wall behind the board ---------- */

  // The panthal photo in its own colours, covering the screen, dimmed a
  // little so the bulbs read as lit.
  function buildScene() {
    var l = layer(vw, vh);
    var g = l.ctx;
    var sw = scene.naturalWidth;
    var sh = scene.naturalHeight * (1 - SCENE.top);
    var sy = scene.naturalHeight * SCENE.top;
    var k = Math.max(vw / sw, vh / sh);
    var dw = sw * k;
    var dh = sh * k;
    var dx = (vw - dw) / 2;
    var dy = (vh - dh) * 0.35;
    g.drawImage(scene, 0, sy, sw, sh, dx, dy, dw, dh);
    anchorY = dy + (SCENE.stick * scene.naturalHeight - sy) * k;
    g.fillStyle = 'rgba(0, 0, 0, 0.18)';
    g.fillRect(0, 0, vw, vh);
    var vignette = g.createRadialGradient(vw / 2, vh * 0.5, Math.min(vw, vh) * 0.25, vw / 2, vh * 0.5, Math.max(vw, vh) * 0.8);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, vw, vh);
    return l.canvas;
  }

  function buildWall() {
    if (scene) return buildScene();
    anchorY = -10;
    var l = layer(vw, vh);
    var g = l.ctx;
    var grad = g.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, '#1b1a10');
    grad.addColorStop(1, '#12110a');
    g.fillStyle = grad;
    g.fillRect(0, 0, vw, vh);
    // Lime plaster: fine grain and a few blotches.
    var rand = seeded(7);
    for (var i = 0; i < (vw * vh) / 900; i++) {
      g.fillStyle = 'rgba(255, 246, 220, ' + (rand() * 0.035).toFixed(3) + ')';
      g.fillRect(rand() * vw, rand() * vh, 1 + rand() * 1.5, 1 + rand() * 1.5);
    }
    for (var j = 0; j < 14; j++) {
      var r = 40 + rand() * 120;
      var bx = rand() * vw;
      var by = rand() * vh;
      var blot = g.createRadialGradient(bx, by, 0, bx, by, r);
      blot.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
      blot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = blot;
      g.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    var vignette = g.createRadialGradient(vw / 2, vh * 0.45, Math.min(vw, vh) * 0.2, vw / 2, vh * 0.45, Math.max(vw, vh) * 0.8);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, vw, vh);
    return l.canvas;
  }

  /* ---------- The board ---------- */

  function buildBoard() {
    var W = Math.min(vw * (vw < 600 ? 0.78 : 0.5), 600);
    var H = W * 0.36;
    // A chunky raw-wood frame, with a second plank along the bottom.
    var frame = H * 0.075;
    var plank = H * 0.1;
    var innerW = W - frame * 2;
    var innerH = H - frame * 2 - plank;

    // Letter size: tall letters filling the panel's height, as on the
    // painted sign, narrowed sideways if the word would be too wide.
    var m = document.createElement('canvas').getContext('2d');
    var fs = 100;
    m.font = WEIGHT + fs + 'px ' + FONT;
    var metrics = m.measureText(WORD.join(''));
    var ink = (metrics.actualBoundingBoxAscent || 70) + (metrics.actualBoundingBoxDescent || 10);
    var top = metrics.actualBoundingBoxAscent || 70;
    var scale = (innerH * 0.82) / ink;
    fs *= scale;
    var gap = fs * 0.05;
    var widths = WORD.map(function (ch) {
      return m.measureText(ch).width * scale;
    });
    var total = widths.reduce(function (a, b) {
      return a + b;
    }, 0) + gap * (WORD.length - 1);
    var squeeze = Math.min(0.9, (innerW * 0.94) / total); // narrowed, like the painted sign
    var font = WEIGHT + fs + 'px ' + FONT;
    var baseline = frame + (innerH - ink * scale) / 2 + top * scale;
    var x0 = frame + (innerW - total * squeeze) / 2;
    var letters = [];
    var x = x0;
    WORD.forEach(function (ch, i) {
      letters.push({ ch: ch, x: x, w: widths[i] * squeeze, paint: PAINT[i] });
      x += (widths[i] + gap) * squeeze;
    });
    gap *= squeeze;

    // Draws a letter, narrowed by `squeeze`, with its left edge at x.
    function text(g, ch, lx, ly, how) {
      g.save();
      g.translate(lx, ly);
      g.scale(squeeze, 1);
      if (how === 'stroke') g.strokeText(ch, 0, 0);
      else g.fillText(ch, 0, 0);
      g.restore();
    }

    function drawLetters(g, style) {
      g.font = font;
      g.textBaseline = 'alphabetic';
      letters.forEach(function (L) {
        if (style === 'mask') {
          g.fillStyle = '#fff';
          text(g, L.ch, L.x, baseline);
          return;
        }
        // Raised, hand-painted letters: a dark edge to the lower right, a
        // thin dark line, then mustard yellow.
        g.lineJoin = 'round';
        g.fillStyle = 'rgba(10, 16, 52, 0.85)';
        text(g, L.ch, L.x + fs * 0.03, baseline + fs * 0.035);
        g.strokeStyle = '#2d220f';
        g.lineWidth = fs * 0.035;
        text(g, L.ch, L.x, baseline, 'stroke');
        g.fillStyle = L.paint;
        text(g, L.ch, L.x, baseline);
        // Paint dulled where the bulbs are off.
        g.fillStyle = 'rgba(30, 24, 20, 0.16)';
        text(g, L.ch, L.x, baseline);
      });
    }

    // Bulbs follow the middle of each stroke: sample points inside the
    // letters, keep the ones farthest from an edge, spaced evenly.
    var spacing = fs * 0.2;
    var bulbR = spacing * 0.26;
    var mask = layer(W, H);
    drawLetters(mask.ctx, 'mask');
    var mw = mask.canvas.width;
    var mh = mask.canvas.height;
    var data = mask.ctx.getImageData(0, 0, mw, mh).data;
    function inside(px, py) {
      var ix = Math.round(px * dpr);
      var iy = Math.round(py * dpr);
      if (ix < 0 || iy < 0 || ix >= mw || iy >= mh) return false;
      return data[(iy * mw + ix) * 4 + 3] > 140;
    }
    function depth(px, py) {
      var best = Infinity;
      for (var a = 0; a < 16; a++) {
        var ang = (a / 16) * Math.PI * 2;
        var dx = Math.cos(ang);
        var dy = Math.sin(ang);
        var d = 0;
        while (d < fs * 0.3 && inside(px + dx * d, py + dy * d)) d += 0.75;
        if (d < best) best = d;
      }
      return best;
    }
    var candidates = [];
    var step = spacing * 0.2;
    for (var cy = frame; cy < H - frame; cy += step) {
      for (var cx = frame; cx < W - frame; cx += step) {
        if (!inside(cx, cy)) continue;
        var d = depth(cx, cy);
        if (d >= bulbR * 0.95) candidates.push({ x: cx, y: cy, d: d });
      }
    }
    candidates.sort(function (a, b) {
      return b.d - a.d;
    });
    var bulbs = [];
    var min2 = spacing * spacing * 0.92;
    candidates.forEach(function (c) {
      for (var k = 0; k < bulbs.length; k++) {
        var dx = bulbs[k].x - c.x;
        var dy = bulbs[k].y - c.y;
        if (dx * dx + dy * dy < min2) return;
      }
      bulbs.push(c);
    });

    // Which letter each bulb belongs to, when it switches on, and how it behaves.
    var rand = seeded(11);
    bulbs.forEach(function (b) {
      var li = 0;
      letters.forEach(function (L, i) {
        if (b.x >= L.x - gap / 2) li = i;
      });
      b.letter = li;
      var L = letters[li];
      b.on = LIGHTS_ON + li * LETTER_GAP + ((b.x - L.x) / Math.max(L.w, 1)) * 0.12 + rand() * 0.04;
      b.loose = rand() < 0.12;
      b.phase = rand() * Math.PI * 2;
    });
    // One tired bulb keeps flickering now and then, as real ones do.
    if (bulbs.length) bulbs[Math.floor(bulbs.length * 0.37)].tired = true;

    // The painted board, bulbs off.
    var body = layer(W, H);
    var g = body.ctx;
    // Plain wooden frame: pale timber with a little grain.
    var frameGrad = g.createLinearGradient(0, 0, 0, H);
    frameGrad.addColorStop(0, '#c9a476');
    frameGrad.addColorStop(1, '#b38a5c');
    g.fillStyle = frameGrad;
    g.fillRect(0, 0, W, H);
    var plankGrad = g.createLinearGradient(0, H - plank, 0, H);
    plankGrad.addColorStop(0, '#e6d4b2');
    plankGrad.addColorStop(1, '#d2ba92');
    g.fillStyle = plankGrad;
    g.fillRect(0, H - plank, W, plank);
    var grain = seeded(19);
    g.lineWidth = 0.7;
    for (var gi = 0; gi < 70; gi++) {
      g.strokeStyle = 'rgba(110, 76, 40, ' + (0.08 + grain() * 0.14).toFixed(2) + ')';
      var gy = grain() * H;
      g.beginPath();
      g.moveTo(0, gy);
      g.bezierCurveTo(W * 0.3, gy + (grain() - 0.5) * 3, W * 0.7, gy + (grain() - 0.5) * 3, W, gy + (grain() - 0.5) * 2);
      g.stroke();
    }
    // Plank edges: the frame's mitred corners and the extra bottom plank.
    g.strokeStyle = 'rgba(96, 70, 38, 0.55)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
    g.beginPath();
    g.moveTo(0, H - plank);
    g.lineTo(W, H - plank);
    [[0, 0, frame, frame], [W, 0, W - frame, frame], [0, H - plank, frame, H - plank - frame], [W, H - plank, W - frame, H - plank - frame]].forEach(function (c) {
      g.moveTo(c[0], c[1]);
      g.lineTo(c[2], c[3]);
    });
    g.stroke();
    var panelGrad = g.createLinearGradient(0, frame, 0, frame + innerH);
    panelGrad.addColorStop(0, '#2353d4');
    panelGrad.addColorStop(1, '#1d48c0');
    g.fillStyle = panelGrad;
    g.fillRect(frame, frame, innerW, innerH);
    g.strokeStyle = 'rgba(60, 40, 18, 0.6)';
    g.lineWidth = 1.5;
    g.strokeRect(frame, frame, innerW, innerH);
    // Weathered paint: a fine grain.
    var wr = seeded(3);
    for (var p = 0; p < (W * H) / 60; p++) {
      g.fillStyle = wr() < 0.5 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.05)';
      g.fillRect(frame + wr() * innerW, frame + wr() * innerH, 1 + wr() * 2, 1 + wr() * 2);
    }
    drawLetters(g, 'paint');
    // Bulb holders and the bulbs' glass, switched off.
    var glassOff = sprite(bulbR * 1.1, [
      [0, 'rgba(255, 255, 252, 1)'],
      [0.5, 'rgba(226, 226, 222, 1)'],
      [0.82, 'rgba(150, 150, 146, 1)'],
      [1, 'rgba(80, 80, 78, 0)'],
    ]);
    bulbs.forEach(function (b) {
      g.fillStyle = '#8a8478';
      g.beginPath();
      g.arc(b.x, b.y, bulbR * 1.18, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(200, 170, 120, 0.45)';
      g.lineWidth = 0.8;
      g.stroke();
      g.drawImage(glassOff, b.x - bulbR * 1.1, b.y - bulbR * 1.1, bulbR * 2.2, bulbR * 2.2);
    });
    // Brass eyelets for the threads.
    var hooks = [W * 0.15, W * 0.85];
    hooks.forEach(function (hx) {
      g.strokeStyle = '#b8924e';
      g.lineWidth = W * 0.006;
      g.beginPath();
      g.arc(hx, -W * 0.004, W * 0.011, Math.PI * 0.05, Math.PI * 0.95, true);
      g.stroke();
      g.fillStyle = '#d6b36a';
      g.beginPath();
      g.arc(hx, frame * 0.45, W * 0.005, 0, Math.PI * 2);
      g.fill();
    });

    // Lit paint: each letter's colour at full strength, and its glow.
    var lit = letters.map(function (L) {
      var face = layer(W, H);
      face.ctx.font = font;
      face.ctx.fillStyle = '#f6d052';
      text(face.ctx, L.ch, L.x, baseline);
      var glow = layer(W, H);
      glow.ctx.font = font;
      glow.ctx.fillStyle = L.paint;
      glow.ctx.shadowColor = L.paint;
      glow.ctx.shadowBlur = fs * 0.45 * dpr;
      glow.ctx.globalAlpha = 0.9;
      text(glow.ctx, L.ch, L.x, baseline);
      return { face: face.canvas, glow: glow.canvas };
    });

    return {
      W: W,
      H: H,
      bulbs: bulbs,
      bulbR: bulbR,
      hooks: hooks,
      body: body.canvas,
      lit: lit,
      bloom: sprite(bulbR * 5, [
        [0, 'rgba(255, 196, 120, 0.55)'],
        [0.35, 'rgba(255, 170, 90, 0.18)'],
        [1, 'rgba(255, 150, 70, 0)'],
      ]),
      halo: sprite(bulbR * 1.9, [
        [0, 'rgba(255, 228, 170, 1)'],
        [0.32, 'rgba(255, 190, 100, 0.55)'],
        [1, 'rgba(255, 150, 50, 0)'],
      ]),
      core: sprite(bulbR * 0.75, [
        [0, 'rgba(255, 255, 250, 1)'],
        [0.6, 'rgba(255, 246, 214, 0.95)'],
        [1, 'rgba(255, 230, 170, 0)'],
      ]),
    };
  }

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    wall = buildWall();
    board = buildBoard();
  }

  /* ---------- Motion and light ---------- */

  // Where the board hangs at time t: it falls, the threads catch and bounce
  // it, then it sways and settles, turning very slightly.
  function pose(t) {
    var restY = scene ? anchorY + Math.max(34, vh * 0.07) : vh * 0.46 - board.H / 2;
    var from = scene ? anchorY - board.H * 0.9 : -board.H - 60;
    var y;
    if (t < FALL) {
      var k = t / FALL;
      y = from + (restY - from) * k * k;
    } else {
      var a = t - FALL;
      y = restY + vh * 0.035 * Math.exp(-4.2 * a) * Math.sin(2 * Math.PI * 2.1 * a);
    }
    var s = Math.max(0, t - FALL);
    var x = vw / 2 + board.W * 0.028 * Math.exp(-1.5 * s) * Math.sin(2 * Math.PI * 0.85 * s + 0.6) + Math.sin(t * 1.3) * 0.6;
    var turn = (2.2 * Math.PI) / 180 * Math.exp(-2 * s) * Math.sin(2 * Math.PI * 1.25 * s);
    return { x: x, y: y, turn: turn };
  }

  // How bright a bulb is at time t, 0 to 1.
  function brightness(b, t) {
    var since = t - b.on;
    if (since <= 0) return 0;
    var v = 1 - Math.exp(-since / 0.07); // filament warming up
    if (b.loose && since < 0.4) {
      var beat = Math.floor(since / 0.065);
      v *= [1, 0.05, 0.9, 0, 0.6, 1][beat % 6];
    }
    if (b.tired && since > 0.6) {
      var w = (t * 3.1) % 2.2;
      if (w < 0.18) v *= w < 0.06 || (w > 0.11 && w < 0.14) ? 0.15 : 0.7;
    }
    return v * (0.97 + 0.03 * Math.sin(t * 47 + b.phase)); // mains hum
  }

  // Draws the scene as it is t seconds in.
  function render(t) {
    var B = board;
    var P = pose(t);
    var left = P.x - B.W / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(wall, 0, 0, vw, vh);

    var levels = B.lit.map(function () {
      return 0;
    });
    var counts = levels.slice();
    var total = 0;
    var values = B.bulbs.map(function (b) {
      var v = brightness(b, t);
      levels[b.letter] += v;
      counts[b.letter] += 1;
      total += v;
      return v;
    });
    levels = levels.map(function (sum, i) {
      return counts[i] ? sum / counts[i] : 0;
    });
    var overall = B.bulbs.length ? total / B.bulbs.length : 0;

    // Light thrown onto the wall around the board.
    if (overall > 0.01) {
      var cx = P.x;
      var cy = P.y + B.H / 2;
      var spill = ctx.createRadialGradient(cx, cy, B.W * 0.1, cx, cy, Math.max(vw, vh) * 0.75);
      spill.addColorStop(0, 'rgba(255, 186, 110, ' + (0.32 * overall).toFixed(3) + ')');
      spill.addColorStop(0.4, 'rgba(255, 160, 80, ' + (0.1 * overall).toFixed(3) + ')');
      spill.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = spill;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
    }

    // The two threads, from somewhere above to the eyelets.
    B.hooks.forEach(function (hx) {
      var dx = hx - B.W / 2;
      var ex = P.x + dx * Math.cos(P.turn);
      var ey = P.y + dx * Math.sin(P.turn) - B.W * 0.01;
      var ax = vw / 2 + dx;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#7a5f3a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ax, anchorY);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232, 200, 150, ' + (0.35 + 0.4 * overall).toFixed(2) + ')';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 2.5]);
      ctx.beginPath();
      ctx.moveTo(ax + 0.5, anchorY);
      ctx.lineTo(ex + 0.5, ey);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Soft shadow on the wall below the board. The shape is drawn far off
    // to the left and only its shadow is shifted into place.
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 36 * dpr;
    ctx.shadowOffsetX = 10000 * dpr;
    ctx.shadowOffsetY = 26 * dpr;
    ctx.fillStyle = '#000';
    ctx.fillRect(left - 10000, P.y + 6, B.W, B.H);
    ctx.restore();

    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.rotate(P.turn);
    ctx.translate(-B.W / 2, 0);

    ctx.drawImage(B.body, 0, 0, B.W, B.H);

    // Letters come alive as their bulbs light.
    B.lit.forEach(function (L, i) {
      if (levels[i] < 0.01) return;
      ctx.globalAlpha = 0.6 * Math.min(1, levels[i]);
      ctx.drawImage(L.face, 0, 0, B.W, B.H);
    });
    ctx.globalCompositeOperation = 'lighter';
    B.lit.forEach(function (L, i) {
      if (levels[i] < 0.01) return;
      ctx.globalAlpha = 0.12 * levels[i];
      ctx.drawImage(L.glow, 0, 0, B.W, B.H);
    });

    // The bulbs: a wide bloom, a warm halo and a white-hot core, added up.
    var r = B.bulbR;
    B.bulbs.forEach(function (b, i) {
      var v = values[i];
      if (v < 0.01) return;
      ctx.globalAlpha = 0.2 * v;
      ctx.drawImage(B.bloom, b.x - r * 5, b.y - r * 5, r * 10, r * 10);
      ctx.globalAlpha = 0.7 * v;
      ctx.drawImage(B.halo, b.x - r * 2.1, b.y - r * 2.1, r * 4.2, r * 4.2);
      ctx.globalAlpha = v * v; // the core whitens as the filament heats
      ctx.drawImage(B.core, b.x - r, b.y - r, r * 2, r * 2);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function frame(now) {
    if (done) return;
    var t = (now - start) / 1000;
    render(t);
    if (t >= HOLD_UNTIL) return leave();
    window.requestAnimationFrame(frame);
  }

  function leave() {
    if (done) return;
    done = true;
    intro.classList.add('is-leaving');
    setTimeout(function () {
      intro.remove();
    }, 600);
  }

  function begin() {
    resize();
    start = performance.now();
    window.requestAnimationFrame(frame);
  }

  intro.addEventListener('click', leave);
  document.addEventListener('keydown', leave, { once: true });
  window.addEventListener('resize', function () {
    if (!done) resize();
  });
  setTimeout(leave, 8000); // never keep anyone waiting

  // Wait (briefly) for the sign-painter's font before drawing the board.
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('600 100px "Baloo Thambi 2"', 'நல்வரவு') : Promise.resolve();
  var photo = new Promise(function (resolve) {
    var src = intro.getAttribute('data-scene');
    if (!src) return resolve();
    var img = new Image();
    img.onload = function () {
      scene = img;
      resolve();
    };
    img.onerror = resolve;
    img.src = src;
  });
  Promise.race([
    Promise.all([fontReady, photo]),
    new Promise(function (resolve) {
      setTimeout(resolve, 1500);
    }),
  ])
    .catch(function () {})
    .then(begin);

  // For the local preview: stop the clock and draw one moment.
  window.JvliNalvaravu = {
    still: function (seconds) {
      done = true;
      if (!board) resize();
      render(seconds);
    },
  };
})();
