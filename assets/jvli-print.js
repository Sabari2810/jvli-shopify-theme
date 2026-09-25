/* Make Your Own Print (sections/jvli-print.liquid).
   A small textile studio: draw or place motifs on a unit tile, then repeat it
   across a piece of cloth. The whole print is plain data (items + settings),
   so it can be undone, saved as an image, and packed into a link.

   Coordinates: everything in the tile lives in "unit" space, 0..1 across the
   tile. Strokes may run past the edges; in repeat modes the tile wraps, so
   lines carry on seamlessly into the next copy. */
(function () {
  if (window.JvliPrint) return;
  window.JvliPrint = true;

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Palette ---------- */

  var INKS = ['#1d1a17', '#5a3a2a', '#8e2f26', '#b4583b', '#d6a39a', '#c99a3b', '#7d8a68', '#2f4a3a', '#243552', '#9db3c4', '#f4eee4'];
  var INK_NAMES = ['Black', 'Brown', 'Madder', 'Terracotta', 'Dusty pink', 'Mustard', 'Sage', 'Bottle green', 'Indigo', 'Sky', 'Cream'];
  var GROUNDS = ['#efe7da', '#1d1a17', '#243552', '#a45136', '#c99a3b'];
  var GROUND_NAMES = ['Cotton', 'Ink', 'Indigo', 'Terracotta', 'Mustard'];
  var MODES = ['single', 'grid', 'half', 'mirror', 'random'];
  var MODE_NAMES = { single: 'Single', grid: 'Grid', half: 'Half drop', mirror: 'Mirror', random: 'Random' };
  var SYM_NAMES = ['Off', 'Sides', 'Top', 'Four'];

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function mix(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function rand(seed) {
    // Small, stable hash to 0..1 for per-tile decisions.
    var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ---------- Motifs ----------
     Each is a Path2D in a unit box centred on 0 (about -0.5..0.5), drawn a
     little unevenly so it reads as hand-cut, not clip art. `line` motifs are
     stroked, the rest filled. */

  function wobble(i, amt) {
    return (rand(i * 7.1) - 0.5) * amt;
  }

  function petalPath(p, len, wid, rot, seed) {
    var c = Math.cos(rot);
    var s = Math.sin(rot);
    function pt(x, y) {
      return [x * c - y * s, x * s + y * c];
    }
    var a = pt(0, -len * 0.12);
    var b1 = pt(wid + wobble(seed, 0.02), -len * 0.45);
    var b2 = pt(wid * 0.8, -len * 0.95);
    var t = pt(wobble(seed + 1, 0.02), -len);
    var b3 = pt(-wid * 0.8, -len * 0.95);
    var b4 = pt(-wid + wobble(seed + 2, 0.02), -len * 0.45);
    p.moveTo(a[0], a[1]);
    p.bezierCurveTo(b1[0], b1[1], b2[0], b2[1], t[0], t[1]);
    p.bezierCurveTo(b3[0], b3[1], b4[0], b4[1], a[0], a[1]);
  }

  function blob(p, cx, cy, r, n, seed, amt) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r * (1 + wobble(seed + i, amt));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    p.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (i = 0; i < n; i++) {
      var q = pts[i];
      var r2 = pts[(i + 1) % n];
      p.quadraticCurveTo(q[0], q[1], (q[0] + r2[0]) / 2, (q[1] + r2[1]) / 2);
    }
    p.closePath();
  }

  var MOTIFS = [
    {
      id: 'bloom',
      make: function () {
        var p = new Path2D();
        for (var i = 0; i < 5; i++) petalPath(p, 0.46, 0.2, (i * Math.PI * 2) / 5, i + 1);
        blob(p, 0, 0, 0.07, 8, 40, 0.1);
        return p;
      },
      rule: 'evenodd'
    },
    {
      id: 'daisy',
      make: function () {
        var p = new Path2D();
        for (var i = 0; i < 11; i++) petalPath(p, 0.48, 0.07, (i * Math.PI * 2) / 11, i + 3);
        blob(p, 0, 0, 0.1, 9, 12, 0.08);
        return p;
      }
    },
    {
      id: 'leaf',
      make: function () {
        var p = new Path2D();
        p.moveTo(-0.02, 0.48);
        p.bezierCurveTo(-0.34, 0.2, -0.3, -0.28, 0.02, -0.48);
        p.bezierCurveTo(0.3, -0.24, 0.3, 0.2, -0.02, 0.48);
        p.closePath();
        // The vein is cut out of the leaf.
        p.moveTo(0, 0.4);
        p.quadraticCurveTo(0.03, 0, 0.01, -0.38);
        p.lineTo(-0.01, -0.38);
        p.quadraticCurveTo(0.01, 0, -0.02, 0.4);
        p.closePath();
        return p;
      },
      rule: 'evenodd'
    },
    {
      id: 'sprig',
      make: function () {
        var p = new Path2D();
        p.moveTo(-0.01, 0.5);
        p.quadraticCurveTo(0.06, 0, -0.02, -0.5);
        p.lineTo(0.02, -0.5);
        p.quadraticCurveTo(0.1, 0, 0.03, 0.5);
        p.closePath();
        for (var i = 0; i < 4; i++) {
          var y = 0.3 - i * 0.2;
          var side = i % 2 ? 1 : -1;
          var q = new Path2D();
          petalPath(q, 0.22, 0.07, side * 1.05, i + 20);
          p.addPath(q, new DOMMatrix().translate(0.02, y));
        }
        return p;
      }
    },
    {
      id: 'dot',
      make: function () {
        var p = new Path2D();
        blob(p, 0, 0, 0.26, 10, 5, 0.06);
        return p;
      }
    },
    {
      id: 'ring',
      line: 0.08,
      make: function () {
        var p = new Path2D();
        blob(p, 0, 0, 0.36, 12, 9, 0.05);
        return p;
      }
    },
    {
      id: 'spark',
      make: function () {
        var p = new Path2D();
        p.moveTo(0, -0.5);
        p.quadraticCurveTo(0.05, -0.05, 0.5, 0);
        p.quadraticCurveTo(0.05, 0.05, 0, 0.5);
        p.quadraticCurveTo(-0.05, 0.05, -0.5, 0);
        p.quadraticCurveTo(-0.05, -0.05, 0, -0.5);
        p.closePath();
        return p;
      }
    },
    {
      id: 'crescent',
      make: function () {
        var p = new Path2D();
        p.arc(0, 0, 0.42, Math.PI * 0.35, Math.PI * 1.65, false);
        p.bezierCurveTo(-0.05, -0.36, -0.05, 0.36, Math.cos(Math.PI * 0.35) * 0.42, Math.sin(Math.PI * 0.35) * 0.42);
        p.closePath();
        return p;
      }
    },
    {
      id: 'squiggle',
      line: 0.07,
      make: function () {
        var p = new Path2D();
        p.moveTo(-0.46, 0.05);
        for (var i = 0; i < 4; i++) {
          var x = -0.46 + (i + 0.5) * 0.23;
          p.quadraticCurveTo(x, i % 2 ? 0.28 : -0.2, x + 0.115, 0.04 + wobble(i + 30, 0.04));
        }
        return p;
      }
    },
    {
      id: 'arch',
      line: 0.09,
      make: function () {
        var p = new Path2D();
        p.moveTo(-0.34, 0.4);
        p.lineTo(-0.34, -0.02);
        p.bezierCurveTo(-0.34, -0.5, 0.34, -0.5, 0.34, -0.02);
        p.lineTo(0.34, 0.4);
        return p;
      }
    },
    {
      id: 'pebble',
      make: function () {
        var p = new Path2D();
        blob(p, 0, 0, 0.36, 7, 71, 0.22);
        return p;
      }
    },
    {
      id: 'stitch',
      line: 0.09,
      make: function () {
        var p = new Path2D();
        p.moveTo(-0.3, -0.32);
        p.lineTo(0.31, 0.3);
        p.moveTo(0.3, -0.31);
        p.lineTo(-0.31, 0.32);
        return p;
      }
    },
    {
      id: 'spiral',
      line: 0.065,
      make: function () {
        var p = new Path2D();
        for (var i = 0; i <= 64; i++) {
          var a = (i / 64) * Math.PI * 5;
          var r = 0.03 + (i / 64) * 0.42;
          var x = Math.cos(a) * r;
          var y = Math.sin(a) * r;
          if (i) p.lineTo(x, y);
          else p.moveTo(x, y);
        }
        return p;
      }
    },
    {
      id: 'seed',
      make: function () {
        var p = new Path2D();
        p.moveTo(0, -0.46);
        p.bezierCurveTo(0.3, -0.12, 0.26, 0.42, 0, 0.44);
        p.bezierCurveTo(-0.26, 0.42, -0.3, -0.12, 0, -0.46);
        p.closePath();
        return p;
      }
    },
    {
      id: 'fan',
      make: function () {
        var p = new Path2D();
        p.moveTo(0, 0.38);
        p.arc(0, 0.38, 0.72, -Math.PI * 0.78, -Math.PI * 0.22);
        p.closePath();
        // Ribs cut through the fan.
        for (var i = 1; i < 6; i++) {
          var a = -Math.PI * 0.78 + (i / 6) * Math.PI * 0.56;
          var w = 0.012;
          p.moveTo(Math.cos(a - w) * 0.16, 0.38 + Math.sin(a - w) * 0.16);
          p.lineTo(Math.cos(a - w) * 0.66, 0.38 + Math.sin(a - w) * 0.66);
          p.lineTo(Math.cos(a + w) * 0.66, 0.38 + Math.sin(a + w) * 0.66);
          p.lineTo(Math.cos(a + w) * 0.16, 0.38 + Math.sin(a + w) * 0.16);
          p.closePath();
        }
        return p;
      },
      rule: 'evenodd'
    },
    {
      id: 'sun',
      make: function () {
        var p = new Path2D();
        blob(p, 0, 0, 0.2, 10, 3, 0.05);
        for (var i = 0; i < 12; i++) {
          var a = (i / 12) * Math.PI * 2;
          var q = new Path2D();
          petalPath(q, 0.2, 0.035, 0, i + 50);
          p.addPath(q, new DOMMatrix().rotate((a * 180) / Math.PI).translate(0, -0.27));
        }
        return p;
      }
    }
  ];
  var MOTIF_BY_ID = {};
  MOTIFS.forEach(function (m) {
    m.path = m.make();
    MOTIF_BY_ID[m.id] = m;
  });

  /* ---------- Cloth texture ----------
     A woven ground: fine warp and weft threads with uneven density and the
     odd slub, tiled over the whole print with multiply. */

  var weaveCanvas = null;
  function weave() {
    if (weaveCanvas) return weaveCanvas;
    var S = 256;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, S, S);
    for (var y = 0; y < S; y += 2) {
      g.fillStyle = 'rgba(70, 52, 34, ' + (0.035 + rand(y) * 0.035).toFixed(3) + ')';
      g.fillRect(0, y, S, 1);
    }
    for (var x = 0; x < S; x += 2) {
      g.fillStyle = 'rgba(70, 52, 34, ' + (0.03 + rand(x + 999) * 0.03).toFixed(3) + ')';
      g.fillRect(x, 0, 1, S);
    }
    // A few soft slubs: slightly thicker stretches of thread.
    for (var i = 0; i < 10; i++) {
      var sx = rand(i * 3.3) * S;
      var sy = Math.floor(rand(i * 5.1) * (S / 2)) * 2;
      g.fillStyle = 'rgba(60, 44, 28, 0.045)';
      g.fillRect(sx, sy, 10 + rand(i) * 20, 1);
    }
    // Grain.
    var data = g.getImageData(0, 0, S, S);
    for (var k = 0; k < data.data.length; k += 4) {
      var n = (Math.random() - 0.5) * 14;
      data.data[k] += n;
      data.data[k + 1] += n;
      data.data[k + 2] += n;
    }
    g.putImageData(data, 0, 0);
    weaveCanvas = c;
    return c;
  }

  /* ---------- The tile ---------- */

  var TILE = 720; // px, the tile's own resolution

  function drawStroke(g, st, size) {
    var pts = st.p;
    if (!pts.length) return;
    g.strokeStyle = INKS[st.c];
    g.fillStyle = INKS[st.c];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // A soft bleed first, then the ink.
    for (var pass = 0; pass < 2; pass++) {
      g.globalAlpha = pass ? 0.94 : 0.22;
      var grow = pass ? 1 : 1.5;
      if (pts.length === 1) {
        g.beginPath();
        g.arc(pts[0][0] * size, pts[0][1] * size, (pts[0][2] * size * grow) / 2, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1];
        var b = pts[i];
        g.lineWidth = ((a[2] + b[2]) / 2) * size * grow;
        g.beginPath();
        g.moveTo(a[0] * size, a[1] * size);
        g.lineTo(b[0] * size, b[1] * size);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  function drawMotif(g, it, size) {
    var m = MOTIF_BY_ID[it.id];
    if (!m) return;
    g.save();
    g.translate(it.x * size, it.y * size);
    g.rotate(it.r || 0);
    g.scale((it.f ? -1 : 1) * it.s * size, it.s * size);
    g.fillStyle = g.strokeStyle = INKS[it.c];
    if (m.line) {
      g.lineWidth = m.line;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalAlpha = 0.22;
      g.lineWidth = m.line * 1.4;
      g.stroke(m.path);
      g.globalAlpha = 0.94;
      g.lineWidth = m.line;
      g.stroke(m.path);
    } else {
      g.globalAlpha = 0.22;
      g.lineWidth = 0.035;
      g.lineJoin = 'round';
      g.stroke(m.path);
      g.globalAlpha = 0.94;
      g.fill(m.path, m.rule || 'nonzero');
    }
    g.restore();
  }

  function bounds(it) {
    if (it.k === 'm') {
      var r = it.s * 0.75;
      return [it.x - r, it.y - r, it.x + r, it.y + r];
    }
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    it.p.forEach(function (p) {
      b[0] = Math.min(b[0], p[0] - p[2]);
      b[1] = Math.min(b[1], p[1] - p[2]);
      b[2] = Math.max(b[2], p[0] + p[2]);
      b[3] = Math.max(b[3], p[1] + p[2]);
    });
    return b;
  }

  // The repeat window: `period` units wide, centred on (ox, oy). Before
  // repeating (single) it is the whole unit.
  function windowOf(print, wrap) {
    if (!wrap) return { p: 1, ox: 0.5, oy: 0.5 };
    return { p: print.period || 1, ox: print.ox == null ? 0.5 : print.ox, oy: print.oy == null ? 0.5 : print.oy };
  }

  // Renders the tile (with wrapping and mirroring) into a canvas.
  function renderTile(target, print, wrap) {
    var size = target.width;
    var g = target.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    var base = document.createElement('canvas');
    base.width = base.height = size;
    var b = base.getContext('2d');
    var w = windowOf(print, wrap);
    var x0 = w.ox - w.p / 2;
    var y0 = w.oy - w.p / 2;
    var k = size / w.p;
    print.items.forEach(function (it) {
      var bb = bounds(it);
      var xs = [0];
      var ys = [0];
      if (wrap) {
        // Every whole-period shift that brings part of the item into view.
        xs = [];
        ys = [];
        for (var kx = Math.ceil((x0 - bb[2]) / w.p); kx <= Math.floor((x0 + w.p - bb[0]) / w.p); kx++) xs.push(kx);
        for (var ky = Math.ceil((y0 - bb[3]) / w.p); ky <= Math.floor((y0 + w.p - bb[1]) / w.p); ky++) ys.push(ky);
      }
      xs.forEach(function (sx) {
        ys.forEach(function (sy) {
          b.save();
          b.setTransform(k, 0, 0, k, (sx * w.p - x0) * k, (sy * w.p - y0) * k);
          if (it.k === 'm') drawMotif(b, it, 1);
          else drawStroke(b, it, 1);
          b.restore();
        });
      });
    });
    var sym = print.sym || 0;
    g.drawImage(base, 0, 0);
    if (sym === 1 || sym === 3) {
      g.save();
      g.translate(size, 0);
      g.scale(-1, 1);
      g.drawImage(base, 0, 0);
      g.restore();
    }
    if (sym === 2 || sym === 3) {
      g.save();
      g.translate(0, size);
      g.scale(1, -1);
      g.drawImage(base, 0, 0);
      if (sym === 3) {
        g.translate(size, 0);
        g.scale(-1, 1);
        g.drawImage(base, 0, 0);
      }
      g.restore();
    }
  }

  /* ---------- The cloth ----------
     Lays the tile out across a canvas according to the repeat mode, then the
     weave and the light. `reveal` (optional) animates the repeat spreading
     outward from the centre. */

  function tileTransform(print, i, j) {
    var m = print.mode;
    var t = { dx: i, dy: j, fx: 1, fy: 1, rot: 0 };
    if (m === 'half' && Math.abs(i) % 2 === 1) t.dy += 0.5;
    if (m === 'mirror') {
      if (Math.abs(i) % 2 === 1) t.fx = -1;
      if (Math.abs(j) % 2 === 1) t.fy = -1;
    }
    if (m === 'random') {
      var r = rand(i * 131.7 + j * 17.3 + (print.seed || 1) * 3.1);
      t.rot = Math.floor(r * 4) * (Math.PI / 2);
      if (rand(i * 7.7 + j * 91.1 + (print.seed || 1)) > 0.5) t.fx = -1;
    }
    return t;
  }

  function tilePx(print, W, H, single) {
    var base = Math.min(W, H);
    return single ? base * 0.8 : base * (print.tile || 0.3);
  }

  // Draws the cloth. opts: { tileCanvas, reveal: {t0, now, fromPx}, sheen: {x, y} }
  function renderCloth(ctx, W, H, print, opts) {
    opts = opts || {};
    var tile = opts.tileCanvas;
    ctx.save();
    ctx.fillStyle = GROUNDS[print.ground || 0];
    ctx.fillRect(0, 0, W, H);
    var single = print.mode === 'single';
    var P = tilePx(print, W, H, single);
    var reveal = opts.reveal;
    var shrink = 1;
    if (reveal) {
      shrink = easeInOut(clamp((reveal.now - reveal.t0) / 520, 0, 1));
      P = mix(reveal.fromPx, P, shrink);
    }
    ctx.translate(W / 2, H / 2);
    ctx.rotate(((print.angle || 0) * Math.PI) / 180);
    if (single) {
      drawTileAt(ctx, tile, P, 0, 0, { dx: 0, dy: 0, fx: 1, fy: 1, rot: 0 }, 1, 1);
    } else {
      var reach = Math.ceil(Math.hypot(W, H) / 2 / P) + 1;
      for (var j = -reach; j <= reach; j++) {
        for (var i = -reach; i <= reach; i++) {
          var tf = tileTransform(print, i, j);
          var alpha = 1;
          var grow = 1;
          if (reveal) {
            var ring = Math.max(Math.abs(i), Math.abs(j));
            var local = ring === 0 ? 1 : clamp((reveal.now - reveal.t0 - 380 - ring * 125) / 620, 0, 1);
            if (local <= 0) continue;
            alpha = easeOut(local);
            grow = mix(0.82, 1, easeOut(local));
          }
          drawTileAt(ctx, tile, P, i, j, tf, alpha, grow);
        }
      }
    }
    ctx.restore();

    // Weave and light over everything, so ink sits in the cloth.
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = print.ground ? 0.55 : 0.8;
    var pat = ctx.createPattern(weave(), 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.save();
    var light = ctx.createRadialGradient(W * 0.22, H * 0.12, 0, W * 0.4, H * 0.4, Math.hypot(W, H) * 0.8);
    light.addColorStop(0, 'rgba(255, 250, 240, 0.12)');
    light.addColorStop(1, 'rgba(40, 26, 14, 0.1)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
    if (opts.sheen) {
      var sheen = ctx.createRadialGradient(opts.sheen.x, opts.sheen.y, 0, opts.sheen.x, opts.sheen.y, Math.min(W, H) * 0.5);
      sheen.addColorStop(0, 'rgba(255, 252, 244, 0.1)');
      sheen.addColorStop(1, 'rgba(255, 252, 244, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawTileAt(ctx, tile, P, i, j, tf, alpha, grow) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(tf.dx * P, tf.dy * P);
    if (grow !== 1 || alpha < 1) {
      // Ink spreading: a soft circle opening from the tile's centre.
      ctx.beginPath();
      ctx.arc(0, 0, P * 0.74 * grow * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
      ctx.clip();
      ctx.scale(grow, grow);
    }
    ctx.rotate(tf.rot);
    ctx.scale(tf.fx, tf.fy);
    ctx.drawImage(tile, -P / 2, -P / 2, P, P);
    ctx.restore();
  }

  // Screen point to unit coordinates in the tile under it (inverting that
  // copy's flips and turns), plus which copy it was.
  function screenToUnit(print, W, H, x, y, fixedTile) {
    var single = print.mode === 'single';
    var P = tilePx(print, W, H, single);
    var a = (-(print.angle || 0) * Math.PI) / 180;
    var dx = x - W / 2;
    var dy = y - H / 2;
    var rx = dx * Math.cos(a) - dy * Math.sin(a);
    var ry = dx * Math.sin(a) + dy * Math.cos(a);
    var u = rx / P;
    var v = ry / P;
    if (single) return { x: u + 0.5, y: v + 0.5, i: 0, j: 0 };
    var w = windowOf(print, true);
    var i = fixedTile ? fixedTile.i : Math.round(u);
    var tfi = tileTransform(print, i, 0);
    var j = fixedTile ? fixedTile.j : Math.round(v - (tfi.dy - 0));
    var tf = tileTransform(print, i, j);
    var lx = u - tf.dx;
    var ly = v - tf.dy;
    // Undo the copy's turn and flips.
    var cr = Math.cos(-tf.rot);
    var sr = Math.sin(-tf.rot);
    var qx = lx * cr - ly * sr;
    var qy = lx * sr + ly * cr;
    qx *= tf.fx;
    qy *= tf.fy;
    return { x: w.ox + qx * w.p, y: w.oy + qy * w.p, i: i, j: j, p: w.p };
  }

  // The unit-space position of an item as drawn in a given copy, on screen.
  function unitToScreen(print, W, H, ux, uy, ti, tj) {
    var single = print.mode === 'single';
    var P = tilePx(print, W, H, single);
    var tf = single ? { dx: 0, dy: 0, fx: 1, fy: 1, rot: 0 } : tileTransform(print, ti, tj);
    var w = windowOf(print, !single);
    var qx = ((ux - w.ox) / w.p) * tf.fx;
    var qy = ((uy - w.oy) / w.p) * tf.fy;
    var cr = Math.cos(tf.rot);
    var sr = Math.sin(tf.rot);
    var lx = qx * cr - qy * sr + tf.dx;
    var ly = qx * sr + qy * cr + tf.dy;
    var a = ((print.angle || 0) * Math.PI) / 180;
    var sx = lx * P * Math.cos(a) - ly * P * Math.sin(a);
    var sy = lx * P * Math.sin(a) + ly * P * Math.cos(a);
    return { x: sx + W / 2, y: sy + H / 2, P: P, scale: P / w.p, flip: tf.fx * tf.fy, rot: tf.rot };
  }

  // A repeat window that fits the content: its bounding box plus breathing
  // room, so a small drawing becomes a dense print, not scattered dots.
  function fitWindow(print) {
    if (!print.items.length) return { period: 0.5, ox: 0.5, oy: 0.5 };
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    print.items.forEach(function (it) {
      var bb = bounds(it);
      b[0] = Math.min(b[0], bb[0]);
      b[1] = Math.min(b[1], bb[1]);
      b[2] = Math.max(b[2], bb[2]);
      b[3] = Math.max(b[3], bb[3]);
    });
    var extent = Math.max(b[2] - b[0], b[3] - b[1]);
    return { period: clamp(extent * 1.32, 0.16, 1), ox: (b[0] + b[2]) / 2, oy: (b[1] + b[3]) / 2 };
  }

  /* ---------- Packing a print into a link ---------- */

  function toData(print) {
    return {
      v: 1,
      g: print.ground || 0,
      m: MODES.indexOf(print.mode),
      y: print.sym || 0,
      t: Math.round((print.tile || 0.3) * 1000),
      p: Math.round((print.period || 1) * 1000),
      o: [Math.round((print.ox == null ? 0.5 : print.ox) * 1000), Math.round((print.oy == null ? 0.5 : print.oy) * 1000)],
      a: Math.round(print.angle || 0),
      s: print.seed || 1,
      i: print.items.map(function (it) {
        if (it.k === 'm') {
          return [MOTIFS.indexOf(MOTIF_BY_ID[it.id]), it.c, Math.round(it.x * 1000), Math.round(it.y * 1000), Math.round(it.s * 1000), Math.round((it.r || 0) * 1000), it.f ? 1 : 0];
        }
        var flat = [-1, it.c];
        it.p.forEach(function (p) {
          flat.push(Math.round(p[0] * 1000), Math.round(p[1] * 1000), Math.round(p[2] * 10000));
        });
        return flat;
      })
    };
  }

  function fromData(d) {
    return {
      ground: d.g | 0,
      mode: MODES[d.m] || 'grid',
      sym: d.y | 0,
      tile: (d.t || 300) / 1000,
      period: (d.p || 1000) / 1000,
      ox: d.o ? d.o[0] / 1000 : 0.5,
      oy: d.o ? d.o[1] / 1000 : 0.5,
      angle: d.a || 0,
      seed: d.s || 1,
      items: (d.i || []).map(function (a) {
        if (a[0] >= 0) {
          return { k: 'm', id: MOTIFS[a[0]].id, c: a[1], x: a[2] / 1000, y: a[3] / 1000, s: a[4] / 1000, r: a[5] / 1000, f: !!a[6] };
        }
        var p = [];
        for (var n = 2; n + 2 < a.length; n += 3) p.push([a[n] / 1000, a[n + 1] / 1000, a[n + 2] / 10000]);
        return { k: 's', c: a[1], p: p };
      })
    };
  }

  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    var s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  function encodePrint(print) {
    var json = new TextEncoder().encode(JSON.stringify(toData(print)));
    if (window.CompressionStream) {
      return pipe(json, new CompressionStream('deflate-raw')).then(function (z) {
        return 'z' + b64url(z);
      });
    }
    return Promise.resolve('j' + b64url(json));
  }

  function decodePrint(code) {
    try {
      var kind = code.charAt(0);
      var bytes = unb64url(code.slice(1));
      var ready = kind === 'z' ? pipe(bytes, new DecompressionStream('deflate-raw')) : Promise.resolve(bytes);
      return ready.then(function (raw) {
        return fromData(JSON.parse(new TextDecoder().decode(raw)));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function printNumber(print) {
    var s = JSON.stringify(toData(print));
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return ('000' + (h % 10000)).slice(-4);
  }

  window.JvliPrintEngine = {
    INKS: INKS,
    INK_NAMES: INK_NAMES,
    GROUNDS: GROUNDS,
    GROUND_NAMES: GROUND_NAMES,
    MODES: MODES,
    MODE_NAMES: MODE_NAMES,
    SYM_NAMES: SYM_NAMES,
    MOTIFS: MOTIFS,
    MOTIF_BY_ID: MOTIF_BY_ID,
    TILE: TILE,
    weave: weave,
    renderTile: renderTile,
    fitWindow: fitWindow,
    renderCloth: renderCloth,
    screenToUnit: screenToUnit,
    unitToScreen: unitToScreen,
    tilePx: tilePx,
    drawMotif: drawMotif,
    bounds: bounds,
    encodePrint: encodePrint,
    decodePrint: decodePrint,
    printNumber: printNumber,
    clamp: clamp,
    mix: mix,
    easeOut: easeOut,
    easeInOut: easeInOut,
    rand: rand,
    still: still
  };
})();
