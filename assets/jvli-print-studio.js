/* Make Your Own Print: the studio (sections/jvli-print.liquid).
   Uses the engine in jvli-print.js. One print lives in `print`; every
   change that should be undoable goes through commit(). The cloth is only
   redrawn when something changed or an animation is running. */
(function () {
  if (window.JvliPrintStudio) return;
  window.JvliPrintStudio = true;

  function start() {
    var E = window.JvliPrintEngine;
    if (!E) return;
    document.querySelectorAll('[data-jvli-print]').forEach(function (el) {
      init(el, E);
    });
  }

  function init(root, E) {
    if (root.dataset.ready) return;
    root.dataset.ready = 'true';

    var $ = function (sel) {
      return root.querySelector(sel);
    };
    var $$ = function (sel) {
      return Array.prototype.slice.call(root.querySelectorAll(sel));
    };
    var clamp = E.clamp;
    var mix = E.mix;

    var intro = $('[data-print-intro]');
    var received = $('[data-print-received]');
    var studio = $('[data-print-studio]');
    var stage = $('[data-print-stage]');
    var canvas = $('[data-print-cloth]');
    var ctx = canvas.getContext('2d');
    var handle = $('[data-print-handle]');
    var ui = $('[data-print-ui]');
    var hint = $('[data-print-hint]');
    var library = $('[data-print-library]');
    var selectionBar = $('[data-print-selection]');
    var wearPanel = $('[data-print-wear-panel]');
    var garment = $('[data-print-garment]');
    var result = $('[data-print-result]');
    var sharePanel = $('[data-print-share-panel]');

    var tile = document.createElement('canvas');
    tile.width = tile.height = E.TILE;

    function blank() {
      return { items: [], ground: 0, mode: 'single', sym: 0, tile: 0.3, angle: 0, seed: 1 + Math.floor(Math.random() * 999), period: 1, ox: 0.5, oy: 0.5 };
    }

    var print = blank();
    var ink = 2;
    var tool = 'draw';
    var sel = -1; // selected item index
    var selTile = { i: 0, j: 0 };
    var selMirror = { x: 1, y: 1 };
    var history = [];
    var W = 0;
    var H = 0;
    var tileDirty = true;
    var dirty = true;
    var frame = 0;
    var reveal = null;
    var fade = null;
    var sheen = null;
    var hinted = { drew: false, repeated: false };

    /* ---------- Undo ---------- */

    function snapshot() {
      return JSON.stringify(print);
    }
    function commit() {
      history.push(lastSaved);
      if (history.length > 60) history.shift();
      lastSaved = snapshot();
      tileDirty = true;
      invalidate();
    }
    var lastSaved = snapshot();
    function undo() {
      if (!history.length) return;
      var prev = history.pop();
      crossfadeFrom();
      print = JSON.parse(prev);
      lastSaved = prev;
      select(-1);
      tileDirty = true;
      syncUi();
      invalidate();
    }

    /* ---------- Layout and drawing ---------- */

    function size() {
      var r = stage.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      invalidate();
    }

    function invalidate() {
      dirty = true;
      if (!frame) frame = requestAnimationFrame(draw);
    }

    function pxPerUnit() {
      var single = print.mode === 'single';
      return E.tilePx(print, W, H, single) / (single ? 1 : print.period || 1);
    }

    function draw(now) {
      frame = 0;
      now = now || performance.now();
      if (tileDirty) {
        E.renderTile(tile, print, print.mode !== 'single');
        tileDirty = false;
      }
      var animating = false;
      var rv = null;
      if (reveal) {
        rv = { t0: reveal.t0, now: now, fromPx: reveal.fromPx };
        if (now - reveal.t0 > reveal.duration) reveal = null;
        else animating = true;
      }
      E.renderCloth(ctx, W, H, print, { tileCanvas: tile, reveal: rv, sheen: sheen });
      if (fade) {
        var t = clamp((now - fade.t0) / 620, 0, 1);
        if (t < 1) {
          ctx.save();
          ctx.globalAlpha = 1 - E.easeOut(t);
          ctx.translate(W / 2, H / 2);
          ctx.rotate(fade.turn * t);
          var k = 1 + fade.grow * t;
          ctx.scale(k, k);
          ctx.drawImage(fade.canvas, -W / 2, -H / 2, W, H);
          ctx.restore();
          animating = true;
        } else fade = null;
      }
      drawOverlay();
      dirty = false;
      if (animating) frame = requestAnimationFrame(draw);
    }

    // The unit's corners (before repeating) and the selected motif's ring.
    function drawOverlay() {
      ctx.save();
      var dark = print.ground !== 0 && print.ground !== 4;
      ctx.strokeStyle = dark ? 'rgba(244, 238, 228, 0.5)' : 'rgba(29, 26, 23, 0.35)';
      ctx.lineWidth = 1;
      if (print.mode === 'single') {
        var P = E.tilePx(print, W, H, true);
        var x0 = W / 2 - P / 2;
        var y0 = H / 2 - P / 2;
        var L = 14;
        [[x0, y0, 1, 1], [x0 + P, y0, -1, 1], [x0, y0 + P, 1, -1], [x0 + P, y0 + P, -1, -1]].forEach(function (c) {
          ctx.beginPath();
          ctx.moveTo(c[0] + L * c[2], c[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.lineTo(c[0], c[1] + L * c[3]);
          ctx.stroke();
        });
      }
      if (sel >= 0 && print.items[sel]) {
        var it = print.items[sel];
        var pos = E.unitToScreen(print, W, H, it.x, it.y, selTile.i, selTile.j);
        var r = it.s * 0.62 * pos.scale;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // The corner handle sits on the ring.
        var a = Math.PI / 4;
        handle.hidden = false;
        handle.style.transform = 'translate(' + (pos.x + Math.cos(a) * r - 11).toFixed(1) + 'px, ' + (pos.y + Math.sin(a) * r - 11).toFixed(1) + 'px)';
      } else {
        handle.hidden = true;
      }
      ctx.restore();
    }

    function crossfadeFrom(turn, grow) {
      if (E.still || !W) return;
      var snap = document.createElement('canvas');
      snap.width = canvas.width;
      snap.height = canvas.height;
      snap.getContext('2d').drawImage(canvas, 0, 0);
      fade = { canvas: snap, t0: performance.now(), turn: turn || 0, grow: grow || 0 };
    }

    /* ---------- Hints: a few words, only when useful ---------- */

    var hintTimer = 0;
    function say(text, ms) {
      hint.textContent = text;
      hint.classList.toggle('is-on', !!text);
      clearTimeout(hintTimer);
      if (text && ms) hintTimer = setTimeout(function () {
        say('');
      }, ms);
    }

    /* ---------- Pointer: draw, pick, move, pinch ---------- */

    var pointers = {};
    var stroke = null;
    var drag = null;
    var pinch = null;

    function local(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function hit(pt) {
      var u = E.screenToUnit(print, W, H, pt.x, pt.y);
      var repeat = print.mode !== 'single';
      var p = repeat ? print.period || 1 : 1;
      var ox = repeat ? print.ox : 0.5;
      var oy = repeat ? print.oy : 0.5;
      var candidates = [{ x: u.x, y: u.y, mx: 1, my: 1 }];
      var sym = print.sym || 0;
      if (sym === 1 || sym === 3) candidates.push({ x: 2 * ox - u.x, y: u.y, mx: -1, my: 1 });
      if (sym === 2 || sym === 3) candidates.push({ x: u.x, y: 2 * oy - u.y, mx: 1, my: -1 });
      if (sym === 3) candidates.push({ x: 2 * ox - u.x, y: 2 * oy - u.y, mx: -1, my: -1 });
      for (var n = print.items.length - 1; n >= 0; n--) {
        var it = print.items[n];
        if (it.k !== 'm') continue;
        for (var c = 0; c < candidates.length; c++) {
          var dx = candidates[c].x - it.x;
          var dy = candidates[c].y - it.y;
          if (repeat) {
            dx -= p * Math.round(dx / p);
            dy -= p * Math.round(dy / p);
          }
          if (Math.hypot(dx, dy) < Math.max(it.s * 0.55, 18 / pxPerUnit())) {
            return { index: n, tile: { i: u.i, j: u.j }, mirror: { x: candidates[c].mx, y: candidates[c].my }, dx: dx, dy: dy };
          }
        }
      }
      return null;
    }

    function select(n, tileRef, mirror) {
      sel = n;
      if (tileRef) selTile = tileRef;
      if (mirror) selMirror = mirror;
      selectionBar.hidden = sel < 0;
      invalidate();
    }

    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      var pt = local(e);
      pointers[e.pointerId] = pt;
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        // Second finger: stop drawing, start a pinch.
        if (stroke) {
          if (stroke.item.p.length < 4) print.items.pop();
          stroke = null;
          tileDirty = true;
        }
        drag = null;
        var a = pointers[ids[0]];
        var b = pointers[ids[1]];
        var it = print.items[sel];
        pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
          s: it ? it.s : 0,
          r: it ? it.r || 0 : 0,
          tile: print.tile
        };
        return;
      }
      if (ids.length > 2) return;
      wake();
      if (tool === 'draw') {
        var u = E.screenToUnit(print, W, H, pt.x, pt.y);
        stroke = {
          tile: { i: u.i, j: u.j },
          last: pt,
          lastT: e.timeStamp,
          w: 0,
          item: { k: 's', c: ink, p: [[u.x, u.y, baseWidth()]] }
        };
        print.items.push(stroke.item);
        tileDirty = true;
        invalidate();
      } else {
        var h = hit(pt);
        if (h) {
          select(h.index, h.tile, h.mirror);
          var target = print.items[h.index];
          drag = { index: h.index, start: pt, x: target.x, y: target.y, moved: false };
        } else {
          select(-1);
        }
      }
    });

    function baseWidth() {
      return 5.5 / pxPerUnit();
    }

    canvas.addEventListener('pointermove', function (e) {
      var pt = local(e);
      if (pointers[e.pointerId]) pointers[e.pointerId] = pt;
      if (e.pointerType === 'mouse') {
        sheen = pt;
        stage.style.setProperty('--tilt-x', ((pt.x / W - 0.5) * 1.2).toFixed(3) + 'deg');
        stage.style.setProperty('--tilt-y', ((0.5 - pt.y / H) * 1.2).toFixed(3) + 'deg');
        if (!stroke && !drag) invalidate();
        wake();
      }
      if (pinch) {
        var ids = Object.keys(pointers);
        if (ids.length < 2) return;
        var a = pointers[ids[0]];
        var b = pointers[ids[1]];
        var ratio = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.dist);
        var turn = Math.atan2(b.y - a.y, b.x - a.x) - pinch.angle;
        var it = print.items[sel];
        if (it) {
          it.s = clamp(pinch.s * ratio, 0.02, 1.4);
          it.r = pinch.r + turn * (selMirror.x * selMirror.y);
        } else if (print.mode !== 'single') {
          print.tile = clamp(pinch.tile * ratio, 0.1, 0.8);
        }
        tileDirty = true;
        invalidate();
        return;
      }
      if (stroke) {
        var dist = Math.hypot(pt.x - stroke.last.x, pt.y - stroke.last.y);
        if (dist < 1.6) return;
        var dt = Math.max(1, e.timeStamp - stroke.lastT);
        var speed = dist / dt; // px per ms
        // Slow lines are fuller, quick ones thinner, like a brush.
        var target = baseWidth() * clamp(1.35 - speed * 0.55, 0.45, 1.35);
        stroke.w = stroke.w ? stroke.w + (target - stroke.w) * 0.35 : target;
        var u = E.screenToUnit(print, W, H, pt.x, pt.y, stroke.tile);
        stroke.item.p.push([u.x, u.y, stroke.w]);
        stroke.last = pt;
        stroke.lastT = e.timeStamp;
        tileDirty = true;
        invalidate();
        return;
      }
      if (drag) {
        var it2 = print.items[drag.index];
        var a0 = E.screenToUnit(print, W, H, drag.start.x, drag.start.y, selTile);
        var a1 = E.screenToUnit(print, W, H, pt.x, pt.y, selTile);
        it2.x = drag.x + (a1.x - a0.x) * selMirror.x;
        it2.y = drag.y + (a1.y - a0.y) * selMirror.y;
        drag.moved = true;
        tileDirty = true;
        invalidate();
      }
    });

    function up(e) {
      delete pointers[e.pointerId];
      if (pinch) {
        if (Object.keys(pointers).length < 2) {
          pinch = null;
          commit();
        }
        return;
      }
      if (stroke) {
        // Simplify: drop points that add nothing, to keep links short.
        var pts = stroke.item.p;
        var kept = [pts[0]];
        for (var n = 1; n < pts.length; n++) {
          var q = kept[kept.length - 1];
          if (Math.hypot(pts[n][0] - q[0], pts[n][1] - q[1]) > 0.0035 || n === pts.length - 1) kept.push(pts[n]);
        }
        stroke.item.p = kept;
        stroke = null;
        commit();
        if (!hinted.drew && print.mode === 'single') {
          hinted.drew = true;
          say('Now press Repeat.', 0);
          $$('[data-print-repeat]').forEach(function (b) {
            b.classList.add('is-ready');
          });
        }
        return;
      }
      if (drag) {
        if (drag.moved) commit();
        drag = null;
      }
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') {
        sheen = null;
        invalidate();
      }
    });

    // Desktop: wheel scales the picked motif (shift turns it); with nothing
    // picked it changes the size of the repeat.
    canvas.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        var it = print.items[sel];
        var k = Math.exp(-e.deltaY * 0.0015);
        if (it) {
          if (e.shiftKey) it.r = (it.r || 0) + e.deltaY * 0.004;
          else it.s = clamp(it.s * k, 0.02, 1.4);
        } else if (print.mode !== 'single') {
          print.tile = clamp(print.tile * k, 0.1, 0.8);
        } else return;
        tileDirty = true;
        invalidate();
        clearTimeout(wheelCommit);
        wheelCommit = setTimeout(commit, 300);
      },
      { passive: false }
    );
    var wheelCommit = 0;

    // The corner handle: drag to scale and turn the picked motif together.
    handle.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      var it = print.items[sel];
      if (!it) return;
      var pos = E.unitToScreen(print, W, H, it.x, it.y, selTile.i, selTile.j);
      var pt = local(e);
      handle.drag = { cx: pos.x, cy: pos.y, d: Math.hypot(pt.x - pos.x, pt.y - pos.y), a: Math.atan2(pt.y - pos.y, pt.x - pos.x), s: it.s, r: it.r || 0, flip: pos.flip * selMirror.x * selMirror.y };
    });
    handle.addEventListener('pointermove', function (e) {
      var d = handle.drag;
      var it = print.items[sel];
      if (!d || !it) return;
      var pt = local(e);
      it.s = clamp((d.s * Math.hypot(pt.x - d.cx, pt.y - d.cy)) / Math.max(1, d.d), 0.02, 1.4);
      it.r = d.r + (Math.atan2(pt.y - d.cy, pt.x - d.cx) - d.a) * d.flip;
      tileDirty = true;
      invalidate();
    });
    handle.addEventListener('pointerup', function () {
      if (handle.drag) {
        handle.drag = null;
        commit();
      }
    });

    /* ---------- Tools ---------- */

    function setTool(next) {
      tool = next;
      $$('[data-print-tool]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.printTool === tool));
      });
      library.hidden = tool !== 'add';
      studio.classList.toggle('is-adding', tool === 'add');
      if (tool !== 'add') select(-1);
      canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
    }
    $$('[data-print-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        setTool(b.dataset.printTool);
        showPanel(null);
      });
    });

    // Motif library.
    E.MOTIFS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jvli-print__motif';
      b.setAttribute('aria-label', m.id);
      var c = document.createElement('canvas');
      c.width = c.height = 88;
      b.appendChild(c);
      b.addEventListener('click', function () {
        addMotif(m.id);
      });
      library.appendChild(b);
      m.thumb = c;
    });
    function paintLibrary() {
      E.MOTIFS.forEach(function (m) {
        var g = m.thumb.getContext('2d');
        g.clearRect(0, 0, 88, 88);
        E.drawMotif(g, { id: m.id, x: 0.5, y: 0.5, s: 0.72, r: 0, c: ink }, 88);
      });
    }

    function addMotif(id) {
      var u = E.screenToUnit(print, W, H, W / 2, H / 2);
      var repeat = print.mode !== 'single';
      var s = repeat ? (print.period || 1) * 0.34 : 0.18;
      // Scatter new motifs a little so repeated adds don't stack.
      var jitter = (repeat ? print.period || 1 : 1) * 0.22;
      var it = {
        k: 'm',
        id: id,
        c: ink,
        x: u.x + (Math.random() - 0.5) * jitter,
        y: u.y + (Math.random() - 0.5) * jitter,
        s: s,
        r: (Math.random() - 0.5) * 0.5,
        f: false
      };
      print.items.push(it);
      select(print.items.length - 1, { i: u.i, j: u.j }, { x: 1, y: 1 });
      commit();
      if (!hinted.drew && print.mode === 'single') {
        hinted.drew = true;
        say('Now press Repeat.', 0);
        $$('[data-print-repeat]').forEach(function (b) {
          b.classList.add('is-ready');
        });
      }
    }

    $('[data-print-flip]').addEventListener('click', function () {
      var it = print.items[sel];
      if (!it) return;
      it.f = !it.f;
      commit();
    });
    $('[data-print-dup]').addEventListener('click', function () {
      var it = print.items[sel];
      if (!it) return;
      var copy = JSON.parse(JSON.stringify(it));
      var off = (print.mode !== 'single' ? print.period || 1 : 1) * 0.12;
      copy.x += off;
      copy.y += off * 0.6;
      print.items.push(copy);
      select(print.items.length - 1);
      commit();
    });
    $('[data-print-remove]').addEventListener('click', function () {
      if (sel < 0) return;
      print.items.splice(sel, 1);
      select(-1);
      commit();
    });

    // Colours.
    var inkButtons = E.INKS.map(function (hex, n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', E.INK_NAMES[n]);
      b.style.setProperty('--swatch', hex);
      b.addEventListener('click', function () {
        ink = n;
        var it = print.items[sel];
        if (it) {
          it.c = n;
          commit();
        }
        syncUi();
      });
      $('[data-print-inks]').appendChild(b);
      return b;
    });
    var groundButtons = E.GROUNDS.map(function (hex, n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', E.GROUND_NAMES[n] + ' ground');
      b.style.setProperty('--swatch', hex);
      b.addEventListener('click', function () {
        if (print.ground === n) return;
        crossfadeFrom();
        print.ground = n;
        // A dark ground wants a light ink to start with.
        if (n !== 0 && n !== 4 && [0, 1, 7, 8].indexOf(ink) !== -1) ink = 10;
        commit();
        syncUi();
      });
      $('[data-print-grounds]').appendChild(b);
      return b;
    });

    // Mirror within the unit: off, sides, top, all four.
    $('[data-print-mirror]').addEventListener('click', function () {
      crossfadeFrom();
      print.sym = ((print.sym || 0) + 1) % 4;
      commit();
      syncUi();
    });

    /* ---------- Repeat: the magic moment ---------- */

    function repeatTo(mode) {
      if (mode === print.mode) return;
      var fromSingle = print.mode === 'single';
      if (mode === 'single') {
        crossfadeFrom(0, 0.02);
        print.mode = 'single';
        commit();
        syncUi();
        return;
      }
      if (fromSingle) {
        var fit = E.fitWindow(print);
        // The unit shrinks from its full size to the tile, then copies
        // spread outward ring by ring.
        var fromPx = E.tilePx(print, W, H, true) * fit.period;
        print.mode = mode;
        print.period = fit.period;
        print.ox = fit.ox;
        print.oy = fit.oy;
        var reach = Math.ceil(Math.hypot(W, H) / 2 / E.tilePx(print, W, H, false)) + 1;
        if (!E.still) reveal = { t0: performance.now(), fromPx: fromPx, duration: 380 + reach * 125 + 700 };
        select(-1);
      } else {
        crossfadeFrom(0, 0.015);
        print.mode = mode;
      }
      commit();
      syncUi();
      if (!hinted.repeated) {
        hinted.repeated = true;
        $$('[data-print-repeat]').forEach(function (b) {
          b.classList.remove('is-ready');
        });
        say('Draw on any copy.', 3200);
      }
    }
    $$('[data-print-repeat]').forEach(function (b) {
      b.addEventListener('click', function () {
        repeatTo(print.mode === 'single' ? 'grid' : print.mode === 'grid' ? 'half' : 'grid');
      });
    });
    $$('[data-print-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        repeatTo(b.dataset.printMode);
      });
    });

    /* ---------- Make it weird ---------- */

    $('[data-print-weird]').addEventListener('click', function () {
      if (!print.items.length) {
        say('Make something first.', 2200);
        return;
      }
      var R = Math.random;
      var modes = ['grid', 'half', 'mirror', 'random'];
      var fit = E.fitWindow(print);
      crossfadeFrom((R() - 0.5) * 0.35, 0.06 + R() * 0.08);
      print.mode = modes[Math.floor(R() * modes.length)];
      print.period = clamp(fit.period * (0.55 + R() * 1.1), 0.12, 1);
      print.ox = fit.ox + (R() - 0.5) * 0.1;
      print.oy = fit.oy + (R() - 0.5) * 0.1;
      print.tile = [0.12, 0.18, 0.26, 0.36, 0.5][Math.floor(R() * 5)];
      print.angle = [0, 0, 0, 12, -18, 45, 90][Math.floor(R() * 7)];
      print.sym = Math.floor(R() * 4);
      print.seed = 1 + Math.floor(R() * 999);
      print.items.forEach(function (it) {
        if (it.k !== 'm') return;
        it.r = (it.r || 0) + (R() - 0.5) * 2.4;
        it.s = clamp(it.s * (0.6 + R() * 0.9), 0.02, 1.2);
        if (R() < 0.3) it.f = !it.f;
      });
      select(-1);
      commit();
      syncUi();
      var wb = $('[data-print-weird]');
      wb.classList.remove('is-wobble');
      void wb.offsetWidth;
      wb.classList.add('is-wobble');
    });

    /* ---------- Undo, clear ---------- */

    $('[data-print-undo]').addEventListener('click', undo);
    $('[data-print-clear]').addEventListener('click', function () {
      if (!print.items.length && print.mode === 'single') return;
      crossfadeFrom(0, -0.02);
      var ground = print.ground;
      print = blank();
      print.ground = ground;
      select(-1);
      commit();
      hinted = { drew: false, repeated: false };
      syncUi();
      say('Draw something small.', 3000);
    });

    /* ---------- Panels (phones) ---------- */

    function showPanel(name) {
      studio.dataset.panel = name || '';
      $$('[data-print-panel]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.printPanel === name));
      });
    }
    $$('[data-print-panel]').forEach(function (b) {
      b.addEventListener('click', function () {
        showPanel(studio.dataset.panel === b.dataset.printPanel ? null : b.dataset.printPanel);
      });
    });

    function syncUi() {
      inkButtons.forEach(function (b, n) {
        b.setAttribute('aria-checked', String(n === ink));
      });
      groundButtons.forEach(function (b, n) {
        b.setAttribute('aria-checked', String(n === print.ground));
      });
      $$('[data-print-mode]').forEach(function (b) {
        b.setAttribute('aria-checked', String(b.dataset.printMode === print.mode));
      });
      $('[data-print-mirror-state]').textContent = E.SYM_NAMES[print.sym || 0];
      studio.classList.toggle('is-repeating', print.mode !== 'single');
      studio.classList.toggle('is-dark', print.ground !== 0 && print.ground !== 4);
      paintLibrary();
      if (!wearPanel.hidden) paintGarment(garment);
    }

    /* ---------- The interface fades while you work ---------- */

    var idleTimer = 0;
    function wake() {
      studio.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (!stroke && !drag && !pinch) studio.classList.add('is-idle');
      }, 1800);
    }
    ui.addEventListener('pointermove', wake);

    /* ---------- Wear it: the print as a kurti ---------- */

    function kurtiPath(w, h) {
      // A simple A-line kurti, front view: V neck, three-quarter sleeves,
      // side slits, curved hem. Proportions of a 1 x 1.3 box.
      var p = new Path2D();
      var X = function (v) {
        return v * w;
      };
      var Y = function (v) {
        return (v / 1.3) * h;
      };
      p.moveTo(X(0.4), Y(0.02));
      p.quadraticCurveTo(X(0.5), Y(0.2), X(0.6), Y(0.02));
      p.lineTo(X(0.73), Y(0.06));
      p.quadraticCurveTo(X(0.86), Y(0.1), X(0.93), Y(0.26));
      p.lineTo(X(0.99), Y(0.47));
      p.lineTo(X(0.86), Y(0.51));
      p.lineTo(X(0.78), Y(0.3));
      p.lineTo(X(0.8), Y(0.86));
      p.lineTo(X(0.84), Y(1.28));
      p.quadraticCurveTo(X(0.5), Y(1.31), X(0.16), Y(1.28));
      p.lineTo(X(0.2), Y(0.86));
      p.lineTo(X(0.22), Y(0.3));
      p.lineTo(X(0.14), Y(0.51));
      p.lineTo(X(0.01), Y(0.47));
      p.lineTo(X(0.07), Y(0.26));
      p.quadraticCurveTo(X(0.14), Y(0.1), X(0.27), Y(0.06));
      p.closePath();
      return p;
    }

    function paintGarment(target) {
      var r = target.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = r.width || 280;
      var h = r.height || 364;
      target.width = Math.round(w * dpr);
      target.height = Math.round(h * dpr);
      var g = target.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      var gw = w * 0.86;
      var gh = gw * 1.3;
      if (gh > h * 0.94) {
        gh = h * 0.94;
        gw = gh / 1.3;
      }
      var ox = (w - gw) / 2;
      var oy = (h - gh) / 2;
      g.save();
      g.translate(ox, oy);
      var path = kurtiPath(gw, gh);
      // A soft floor shadow.
      g.save();
      g.filter = 'blur(10px)';
      g.fillStyle = 'rgba(40, 26, 16, 0.25)';
      g.translate(8, 14);
      g.fill(path);
      g.restore();
      g.clip(path);
      // The print at garment scale: a real repeat, never the single unit.
      var cloth = document.createElement('canvas');
      cloth.width = Math.round(gw * dpr);
      cloth.height = Math.round(gh * dpr);
      var cg = cloth.getContext('2d');
      cg.scale(dpr, dpr);
      var wearPrint = Object.assign({}, print, {
        mode: print.mode === 'single' ? 'grid' : print.mode,
        tile: clamp((print.tile || 0.3) * 0.62, 0.08, 0.4)
      });
      if (print.mode === 'single') Object.assign(wearPrint, E.fitWindow(print));
      var wt = document.createElement('canvas');
      wt.width = wt.height = 360;
      E.renderTile(wt, wearPrint, true);
      E.renderCloth(cg, gw, gh, wearPrint, { tileCanvas: wt });
      g.drawImage(cloth, 0, 0, gw, gh);
      // Folds and light: the cloth falls in soft vertical folds.
      var folds = g.createLinearGradient(0, 0, gw, 0);
      [0, 0.18, 0.3, 0.42, 0.5, 0.6, 0.72, 0.84, 1].forEach(function (t, n) {
        folds.addColorStop(t, n % 2 ? 'rgba(255, 250, 240, 0.08)' : 'rgba(30, 18, 10, 0.16)');
      });
      g.fillStyle = folds;
      g.fillRect(0, 0, gw, gh);
      var shade = g.createLinearGradient(0, 0, 0, gh);
      shade.addColorStop(0, 'rgba(255, 250, 240, 0.08)');
      shade.addColorStop(1, 'rgba(30, 18, 10, 0.18)');
      g.fillStyle = shade;
      g.fillRect(0, 0, gw, gh);
      g.restore();
      // Stitch line at the neck and hem.
      g.save();
      g.translate(ox, oy);
      g.strokeStyle = 'rgba(30, 20, 12, 0.35)';
      g.lineWidth = 1;
      g.stroke(path);
      g.restore();
    }

    $('[data-print-wear]').addEventListener('click', function () {
      wearPanel.hidden = !wearPanel.hidden;
      $('[data-print-wear]').setAttribute('aria-pressed', String(!wearPanel.hidden));
      if (!wearPanel.hidden) paintGarment(garment);
    });
    wearPanel.addEventListener('click', function () {
      wearPanel.hidden = true;
      $('[data-print-wear]').setAttribute('aria-pressed', 'false');
    });

    /* ---------- 03 Your print ---------- */

    function renderInto(target, w, h, overrides) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.round(w * dpr);
      target.height = Math.round(h * dpr);
      var g = target.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var p = Object.assign({}, print, overrides || {});
      if (p.mode === 'single' && p.items.length) Object.assign(p, E.fitWindow(print), { mode: 'grid' });
      var t = document.createElement('canvas');
      t.width = t.height = E.TILE;
      E.renderTile(t, p, p.mode !== 'single');
      E.renderCloth(g, w, h, p, { tileCanvas: t });
      return g;
    }

    function openResult() {
      select(-1);
      result.hidden = false;
      studio.classList.add('is-result');
      var art = result.querySelector('.jvli-print__result-art');
      var r = art.getBoundingClientRect();
      var side = Math.min(r.width, r.height);
      var cloth = $('[data-print-result-cloth]');
      cloth.style.width = side + 'px';
      cloth.style.height = side + 'px';
      renderInto(cloth, side, side, { tile: (print.tile || 0.3) * (W ? Math.min(W, H) / side : 1) * 0.9 });
      $('[data-print-number]').textContent = 'No. ' + E.printNumber(print);
      paintGarment($('[data-print-result-garment]'));
    }
    $('[data-print-done]').addEventListener('click', function () {
      if (!print.items.length) {
        say('Make something first.', 2200);
        return;
      }
      openResult();
    });
    $('[data-print-back]').addEventListener('click', function () {
      result.hidden = true;
      studio.classList.remove('is-result');
    });
    $('[data-print-again]').addEventListener('click', function () {
      result.hidden = true;
      studio.classList.remove('is-result');
      print = blank();
      history = [];
      lastSaved = snapshot();
      hinted = { drew: false, repeated: false };
      tileDirty = true;
      syncUi();
      invalidate();
      say('Draw something small.', 3000);
    });

    function download(blob, name) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1500);
    }

    $('[data-print-save]').addEventListener('click', function () {
      var c = document.createElement('canvas');
      var t = document.createElement('canvas');
      t.width = t.height = E.TILE;
      var p = Object.assign({}, print);
      if (p.mode === 'single') Object.assign(p, E.fitWindow(print), { mode: 'grid' });
      c.width = c.height = 2048;
      E.renderTile(t, p, true);
      E.renderCloth(c.getContext('2d'), 2048, 2048, p, { tileCanvas: t });
      c.toBlob(function (blob) {
        download(blob, 'my-print-' + E.printNumber(print) + '.png');
      }, 'image/png');
    });

    /* ---------- Share ---------- */

    var FORMATS = { story: [1080, 1920], post: [1080, 1080], wa: [1080, 1350] };
    var format = 'story';
    var shareBlob = null;

    function spaced(g, text, x, y, spacing, align) {
      var chars = text.split('');
      var width = chars.reduce(function (sum, ch) {
        return sum + g.measureText(ch).width + spacing;
      }, -spacing);
      var cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
      chars.forEach(function (ch) {
        g.fillText(ch, cx, y);
        cx += g.measureText(ch).width + spacing;
      });
    }

    // An editorial page: mostly the fabric, a lot of paper, very little type.
    function composeShare(fmt) {
      var size = FORMATS[fmt];
      var w = size[0];
      var h = size[1];
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var g = c.getContext('2d');
      g.fillStyle = '#efe7da';
      g.fillRect(0, 0, w, h);
      var box =
        fmt === 'story' ? [96, 168, 888, 1300] : fmt === 'post' ? [96, 96, 888, 740] : [96, 110, 888, 960];
      // The fabric, with a soft shadow as if laid on paper.
      g.save();
      g.shadowColor = 'rgba(40, 26, 16, 0.22)';
      g.shadowBlur = 40;
      g.shadowOffsetY = 18;
      g.fillStyle = '#e8dfd1';
      g.fillRect(box[0], box[1], box[2], box[3]);
      g.restore();
      var cloth = document.createElement('canvas');
      cloth.width = box[2];
      cloth.height = box[3];
      var p = Object.assign({}, print);
      if (p.mode === 'single') Object.assign(p, E.fitWindow(print), { mode: 'grid' });
      var t = document.createElement('canvas');
      t.width = t.height = E.TILE;
      E.renderTile(t, p, true);
      E.renderCloth(cloth.getContext('2d'), box[2], box[3], p, { tileCanvas: t });
      g.drawImage(cloth, box[0], box[1]);
      // Paper grain over the page, but not over the fabric.
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.35;
      g.fillStyle = g.createPattern(weaveTexture(), 'repeat');
      g.fillRect(0, 0, w, box[1]);
      g.fillRect(0, box[1] + box[3], w, h);
      g.restore();
      var below = box[1] + box[3];
      g.fillStyle = '#1d1a17';
      g.textBaseline = 'alphabetic';
      g.font = '500 26px Jost, Futura, sans-serif';
      spaced(g, 'MY PRINT', box[0], below + (fmt === 'post' ? 76 : 96), 7.5, 'left');
      g.fillStyle = 'rgba(29, 26, 23, 0.55)';
      g.font = '400 20px Jost, Futura, sans-serif';
      spaced(g, 'NO. ' + E.printNumber(print), box[0], below + (fmt === 'post' ? 112 : 136), 5, 'left');
      g.fillStyle = '#1d1a17';
      g.font = '300 34px Newsreader, Georgia, serif';
      g.textAlign = 'right';
      g.fillText('JVLI', box[0] + box[2], h - (fmt === 'post' ? 70 : 96));
      return c;
    }

    function weaveTexture() {
      return E.weave();
    }

    function fontsReady() {
      if (!document.fonts || !document.fonts.load) return Promise.resolve();
      return Promise.all([document.fonts.load('500 26px Jost'), document.fonts.load('400 20px Jost'), document.fonts.load('300 34px Newsreader')]).catch(function () {});
    }

    function makeShare() {
      $$('[data-print-format]').forEach(function (b) {
        b.setAttribute('aria-checked', String(b.dataset.printFormat === format));
      });
      return fontsReady().then(function () {
        return new Promise(function (resolve) {
          composeShare(format).toBlob(function (blob) {
            shareBlob = blob;
            var img = $('[data-print-share-preview]');
            if (img.src) URL.revokeObjectURL(img.src);
            img.src = URL.createObjectURL(blob);
            img.dataset.format = format;
            resolve(blob);
          }, 'image/png');
        });
      });
    }

    function shareLink() {
      return E.encodePrint(print).then(function (code) {
        return (root.dataset.pageUrl || location.origin + location.pathname) + '#p=' + code;
      });
    }

    $('[data-print-share]').addEventListener('click', function () {
      sharePanel.hidden = false;
      $('[data-print-share-note]').textContent = '';
      makeShare();
    });
    $$('[data-print-format]').forEach(function (b) {
      b.addEventListener('click', function () {
        format = b.dataset.printFormat;
        makeShare();
      });
    });
    $('[data-print-share-close]').addEventListener('click', function () {
      sharePanel.hidden = true;
    });
    $('[data-print-share-save]').addEventListener('click', function () {
      if (shareBlob) download(shareBlob, 'my-print-' + E.printNumber(print) + '-' + format + '.png');
    });
    $('[data-print-share-link]').addEventListener('click', function () {
      shareLink().then(function (url) {
        var note = $('[data-print-share-note]');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(
            function () {
              note.textContent = 'Link copied. Whoever opens it sees your print.';
            },
            function () {
              note.textContent = url;
            }
          );
        } else note.textContent = url;
      });
    });
    $('[data-print-share-send]').addEventListener('click', function () {
      var note = $('[data-print-share-note]');
      Promise.all([shareBlob ? Promise.resolve(shareBlob) : makeShare(), shareLink()]).then(function (res) {
        var file = new File([res[0]], 'my-print-' + E.printNumber(print) + '.png', { type: 'image/png' });
        var data = { files: [file], text: 'I made this print. Make your own: ' + res[1] };
        if (navigator.canShare && navigator.canShare(data)) {
          navigator.share(data).catch(function () {});
        } else if (navigator.share) {
          navigator.share({ title: 'My print', text: 'I made this print.', url: res[1] }).catch(function () {});
        } else {
          download(res[0], file.name);
          note.textContent = 'Saved. Post it anywhere, and here is its link: ' + res[1];
        }
      });
    });

    /* ---------- Opening and closing ---------- */

    function open() {
      received.hidden = true;
      intro.hidden = false;
      studio.hidden = false;
      document.documentElement.classList.add('jvli-print-open');
      size();
      syncUi();
      setTool('draw');
      wake();
      if (!print.items.length) say('Draw something small.', 3200);
    }
    function close() {
      studio.hidden = true;
      result.hidden = true;
      sharePanel.hidden = true;
      studio.classList.remove('is-result');
      document.documentElement.classList.remove('jvli-print-open');
    }
    $$('[data-print-start]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (location.hash.indexOf('#p=') === 0) {
          history_replace();
          print = blank();
          history = [];
          lastSaved = snapshot();
          tileDirty = true;
        }
        open();
      });
    });
    function history_replace() {
      try {
        window.history.replaceState(null, '', location.pathname + location.search);
      } catch (e) {}
    }
    $('[data-print-close]').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (studio.hidden) return;
      if (e.key === 'Escape') {
        if (!sharePanel.hidden) sharePanel.hidden = true;
        else if (!result.hidden) $('[data-print-back]').click();
        else close();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && sel >= 0) {
        print.items.splice(sel, 1);
        select(-1);
        commit();
      }
    });
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      if (studio.hidden) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(size, 120);
    });

    /* ---------- A print someone shared ---------- */

    function showReceived(p) {
      intro.hidden = true;
      received.hidden = false;
      var c = received.querySelector('canvas');
      var r = c.getBoundingClientRect();
      var w = r.width;
      var h = r.height;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      var g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var shown = Object.assign({}, p);
      if (shown.mode === 'single') Object.assign(shown, E.fitWindow(p), { mode: 'grid' });
      var t = document.createElement('canvas');
      t.width = t.height = E.TILE;
      E.renderTile(t, shown, true);
      var reach = Math.ceil(Math.hypot(w, h) / 2 / E.tilePx(shown, w, h, false)) + 1;
      var duration = 380 + reach * 125 + 700;
      var t0 = performance.now();
      var fromPx = E.tilePx(shown, w, h, false) * 2.4;
      function step(now) {
        E.renderCloth(g, w, h, shown, { tileCanvas: t, reveal: E.still ? null : { t0: t0, now: now, fromPx: fromPx } });
        if (!E.still && now - t0 < duration) requestAnimationFrame(step);
        else received.classList.add('is-revealed');
      }
      requestAnimationFrame(step);
    }

    function openShared() {
      if (location.hash.indexOf('#p=') !== 0) return;
      E.decodePrint(location.hash.slice(3)).then(
        function (p) {
          close();
          received.classList.remove('is-revealed');
          window.scrollTo(0, 0);
          showReceived(p);
        },
        function () {
          history_replace();
        }
      );
    }
    openShared();
    // A shared link opened while this page is already open.
    window.addEventListener('hashchange', openShared);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
