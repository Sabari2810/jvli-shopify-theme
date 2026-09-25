/* JVLI Exhibition (the experimental home page). One file for all worlds:
   journey (cloth, turn, exhibition), studio, found objects, ink, and the
   header reveal. Native scrolling throughout: pinned scenes read their
   progress from their position; every pointer or scroll driven value is
   eased toward its target each frame. Everything pauses off-screen, and
   with reduced motion (or no WebGL) the worlds fall back to still layouts. */
(function () {
  if (window.JvliX) return;
  window.JvliX = true;

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function smooth(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  // A stable "vh" (phones change innerHeight as the address bar moves).
  function setVh() {
    root.style.setProperty('--jvli-x-vh', window.innerHeight / 100 + 'px');
  }
  setVh();
  var lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth !== lastWidth) {
      lastWidth = window.innerWidth;
      setVh();
    }
  });

  // Pointer, normalised to -1..1, shared by every world.
  var pointer = { x: 0, y: 0, px: -9999, py: -9999, moved: 0 };
  window.addEventListener(
    'pointermove',
    function (e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.px = e.clientX;
      pointer.py = e.clientY;
      pointer.moved = performance.now();
    },
    { passive: true }
  );

  function progressOf(el) {
    var rect = el.getBoundingClientRect();
    var travel = rect.height - window.innerHeight;
    return { scrolled: -rect.top, travel: travel, p: travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0, rect: rect };
  }

  function whenVisible(el, cb) {
    if (!window.IntersectionObserver) return cb(true);
    new IntersectionObserver(function (entries) {
      cb(entries[0].isIntersecting);
    }, { rootMargin: '20% 0px' }).observe(el);
  }

  /* ================================================================
     01-03 Journey
     ================================================================ */

  var VERT = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec2 aUv;',
    'attribute vec2 aBackUv;',
    'uniform vec2 uHalf;',
    'uniform float uDist;',
    'varying vec3 vNormal;',
    'varying vec2 vUv;',
    'varying vec2 vBackUv;',
    'void main() {',
    '  float w = (uDist - aPos.z) / uDist;',
    '  gl_Position = vec4(aPos.x / uHalf.x, -aPos.y / uHalf.y, -aPos.z / 6000.0 * w, w);',
    '  vNormal = aNormal;',
    '  vUv = aUv;',
    '  vBackUv = aBackUv;',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform sampler2D uFront;',
    'uniform sampler2D uBack;',
    'uniform float uHasBack;',
    'varying vec3 vNormal;',
    'varying vec2 vUv;',
    'varying vec2 vBackUv;',
    'void main() {',
    '  vec3 n = normalize(vNormal);',
    '  vec4 base;',
    '  if (gl_FrontFacing) {',
    '    base = texture2D(uFront, vUv);',
    '  } else {',
    '    n = -n;',
    '    base = mix(vec4(0.86, 0.82, 0.76, 1.0), texture2D(uBack, vBackUv), uHasBack);',
    '  }',
    '  vec3 L = normalize(vec3(-0.42, -0.55, 0.72));',
    '  float diff = max(dot(n, L), 0.0);',
    '  float shade = 0.34 + 0.66 * diff / 0.72;',
    '  vec3 R = reflect(-L, n);',
    '  float spec = pow(max(R.z, 0.0), 28.0) * 0.10;',
    '  gl_FragColor = vec4(base.rgb * shade + spec, 1.0);',
    '}'
  ].join('\n');

  var SHADOW_FRAG = [
    'precision mediump float;',
    'varying vec3 vNormal;',
    'varying vec2 vUv;',
    'varying vec2 vBackUv;',
    'void main() { gl_FragColor = vec4(0.16, 0.10, 0.06, 1.0) * vBackUv.x; }'
  ].join('\n');

  function compile(gl, vs, fs) {
    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  // The printed face of the cloth: paper, grain, and the wordmark.
  function paintFront(W, H, word, phone) {
    var scale = Math.min(2, 2048 / Math.max(W, H));
    var c = document.createElement('canvas');
    c.width = Math.round(W * scale);
    c.height = Math.round(H * scale);
    var g = c.getContext('2d');
    g.fillStyle = '#f1ebe1';
    g.fillRect(0, 0, c.width, c.height);
    // Soft light across the sheet.
    var light = g.createRadialGradient(c.width * 0.28, c.height * 0.2, 0, c.width * 0.4, c.height * 0.4, c.width * 0.9);
    light.addColorStop(0, 'rgba(255, 252, 245, 0.55)');
    light.addColorStop(1, 'rgba(215, 204, 188, 0.25)');
    g.fillStyle = light;
    g.fillRect(0, 0, c.width, c.height);
    // Cotton grain.
    var grain = g.createImageData(c.width, c.height);
    for (var i = 0; i < grain.data.length; i += 4) {
      var v = Math.random() * 255;
      grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
      grain.data[i + 3] = 9;
    }
    var gc = document.createElement('canvas');
    gc.width = c.width;
    gc.height = c.height;
    gc.getContext('2d').putImageData(grain, 0, 0);
    g.drawImage(gc, 0, 0);
    // The wordmark, as big as the sheet allows.
    g.save();
    g.fillStyle = '#1f1814';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    var span = phone ? c.height * 0.84 : c.width * 0.88;
    var size = 100;
    g.font = '300 ' + size + 'px Newsreader, Georgia, serif';
    var measure = g.measureText(word).width;
    size = (size * span) / measure;
    g.font = '300 ' + size + 'px Newsreader, Georgia, serif';
    if (phone) {
      g.translate(c.width * 0.6, c.height * 0.5);
      g.rotate(-Math.PI / 2);
      g.fillText(word, 0, size * 0.34);
    } else {
      g.fillText(word, c.width / 2, c.height * 0.56 + size * 0.34);
    }
    g.restore();
    return c;
  }

  // The underside: the photograph, cropped to fill the given shape.
  function paintBack(img, aspect) {
    var c = document.createElement('canvas');
    var w = 1200;
    var h = Math.round(w / aspect);
    if (h > 2048) {
      h = 2048;
      w = Math.round(h * aspect);
    }
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var dw = img.naturalWidth * s;
    var dh = img.naturalHeight * s;
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c;
  }

  function initJourney(section) {
    if (section.dataset.jvliReady) return;
    section.dataset.jvliReady = 'true';

    var frame = section.querySelector('.jvli-x-journey__frame');
    var clothWrap = section.querySelector('[data-jvli-x-cloth]');
    var canvas = section.querySelector('.jvli-x-cloth__canvas');
    var labels = section.querySelector('[data-jvli-x-labels]');
    var world = section.querySelector('[data-jvli-x-world]');
    var printA = section.querySelector('[data-jvli-x-print-a]');
    var items = Array.prototype.slice.call(world.children);
    var word = section.dataset.word || 'JVLI';

    var gl = null;
    if (!still) {
      try {
        gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false, alpha: true });
      } catch (e) {
        gl = null;
      }
    }
    if (!gl) {
      section.classList.add('is-static');
      if (still) {
        document.body.classList.add('jvli-x-header-in');
        return;
      }
    }

    var state = {
      turn: 0,
      turnTarget: 0,
      ex: 0,
      exTarget: 0,
      mx: 0,
      my: 0,
      visible: true,
      frame: 0,
      handed: false
    };

    /* ---------- The cloth (WebGL) ---------- */
    var cloth = null;
    if (gl) {
      try {
        cloth = buildCloth();
      } catch (e) {
        cloth = null;
        section.classList.add('is-static');
      }
    }

    function buildCloth() {
      var prog = compile(gl, VERT, FRAG);
      var shadowProg = compile(gl, VERT, SHADOW_FRAG);
      var buffers = {
        pos: gl.createBuffer(),
        normal: gl.createBuffer(),
        uv: gl.createBuffer(),
        backUv: gl.createBuffer(),
        index: gl.createBuffer(),
        shadowPos: gl.createBuffer(),
        shadowAlpha: gl.createBuffer()
      };
      var tex = { front: gl.createTexture(), back: gl.createTexture(), hasBack: 0 };
      var c = { prog: prog, shadowProg: shadowProg, buffers: buffers, tex: tex };

      c.layout = function () {
        var W = frame.clientWidth;
        var H = frame.clientHeight;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        var phone = W < 750;
        var NX = phone ? 56 : 112;
        var NY = Math.max(24, Math.round((NX * H) / W));
        if (NX * NY > 11000) NY = Math.floor(11000 / NX);
        c.W = W;
        c.H = H;
        c.NX = NX;
        c.NY = NY;
        c.phone = phone;
        c.h = new Float32Array(NX * NY);
        c.hPrev = new Float32Array(NX * NY);
        c.pos = new Float32Array(NX * NY * 3);
        c.nrm = new Float32Array(NX * NY * 3);
        c.shadow = new Float32Array(NX * NY * 3);
        c.shadowA = new Float32Array(NX * NY * 2);
        var uv = new Float32Array(NX * NY * 2);
        for (var j = 0; j < NY; j++) {
          for (var i = 0; i < NX; i++) {
            var k = j * NX + i;
            uv[k * 2] = i / (NX - 1);
            uv[k * 2 + 1] = j / (NY - 1);
          }
        }
        c.uv = uv;
        var idx = new Uint16Array((NX - 1) * (NY - 1) * 6);
        var t = 0;
        for (j = 0; j < NY - 1; j++) {
          for (i = 0; i < NX - 1; i++) {
            var a = j * NX + i;
            idx[t++] = a;
            idx[t++] = a + NX;
            idx[t++] = a + 1;
            idx[t++] = a + 1;
            idx[t++] = a + NX;
            idx[t++] = a + NX + 1;
          }
        }
        c.count = idx.length;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

        // The turn: the sheet curls over a hinge line moving across it.
        // Phones turn it like a page (right to left); larger screens lift
        // the bottom right corner and roll it over diagonally.
        var n = phone ? [1, 0] : [Math.SQRT1_2, Math.SQRT1_2];
        c.n = n;
        c.R = Math.min(W, H) * (phone ? 0.16 : 0.13);
        var smin = Infinity;
        var smax = -Infinity;
        [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]].forEach(function (p) {
          var s = p[0] * n[0] + p[1] * n[1];
          smin = Math.min(smin, s);
          smax = Math.max(smax, s);
        });
        c.hStart = smax + 2;
        c.hEnd = smin - Math.PI * c.R - 2;
        // Where each point ends up once fully turned: its mirror image. The
        // photograph is mapped onto that final shape, upright.
        var mirror = c.hEnd + (Math.PI * c.R) / 2;
        var fx = new Float32Array(NX * NY);
        var fy = new Float32Array(NX * NY);
        var bx0 = Infinity;
        var bx1 = -Infinity;
        var by0 = Infinity;
        var by1 = -Infinity;
        for (j = 0; j < NY; j++) {
          for (i = 0; i < NX; i++) {
            k = j * NX + i;
            var x = (i / (NX - 1) - 0.5) * W;
            var y = (j / (NY - 1) - 0.5) * H;
            var s2 = x * n[0] + y * n[1];
            var d = 2 * (s2 - mirror);
            fx[k] = x - d * n[0];
            fy[k] = y - d * n[1];
            bx0 = Math.min(bx0, fx[k]);
            bx1 = Math.max(bx1, fx[k]);
            by0 = Math.min(by0, fy[k]);
            by1 = Math.max(by1, fy[k]);
          }
        }
        var backUv = new Float32Array(NX * NY * 2);
        for (k = 0; k < NX * NY; k++) {
          backUv[k * 2] = (fx[k] - bx0) / (bx1 - bx0);
          backUv[k * 2 + 1] = (fy[k] - by0) / (by1 - by0);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.backUv);
        gl.bufferData(gl.ARRAY_BUFFER, backUv, gl.STATIC_DRAW);
        c.final = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, w: bx1 - bx0, h: by1 - by0 };

        // Print A takes the turned sheet's exact shape.
        var aHeight = H * (phone ? 0.56 : 0.64);
        var aWidth = aHeight * (c.final.w / c.final.h);
        if (aWidth > W * 0.8) {
          aWidth = W * 0.8;
          aHeight = aWidth / (c.final.w / c.final.h);
        }
        printA.style.width = aWidth + 'px';
        printA.style.height = aHeight + 'px';
        c.aspect = c.final.w / c.final.h;

        var front = paintFront(W, H, word, phone);
        upload(tex.front, front);
        if (c.photo) upload(tex.back, paintBack(c.photo, c.aspect));
        c.laidOut = true;
      };

      function upload(t, source) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }

      c.setPhoto = function (img) {
        c.photo = img;
        if (img && c.laidOut) {
          upload(tex.back, paintBack(img, c.aspect));
        }
        tex.hasBack = img ? 1 : 0;
      };

      // Ripples: a damped wave on a height field. The pointer presses a dent
      // into it and moving the pointer sends waves out.
      c.step = function (dt, time, calm) {
        var NX = c.NX;
        var NY = c.NY;
        var h = c.h;
        var hp = c.hPrev;
        var stepsNeeded = Math.min(3, Math.max(1, Math.round(dt / 16)));
        var rect = frame.getBoundingClientRect();
        var gx = ((pointer.px - rect.left) / c.W) * (NX - 1);
        var gy = ((pointer.py - rect.top) / c.H) * (NY - 1);
        var active = performance.now() - pointer.moved < 1400 && gx > -4 && gy > -4 && gx < NX + 4 && gy < NY + 4;
        var speed = Math.min(1, Math.hypot(pointer.px - (c.lastPx || pointer.px), pointer.py - (c.lastPy || pointer.py)) / 24);
        c.lastPx = pointer.px;
        c.lastPy = pointer.py;
        var radius = c.phone ? 5 : 7;
        for (var s = 0; s < stepsNeeded; s++) {
          if (active && calm > 0.01) {
            var i0 = Math.max(1, Math.floor(gx - radius * 2));
            var i1 = Math.min(NX - 2, Math.ceil(gx + radius * 2));
            var j0 = Math.max(1, Math.floor(gy - radius * 2));
            var j1 = Math.min(NY - 2, Math.ceil(gy + radius * 2));
            for (var j = j0; j <= j1; j++) {
              for (var i = i0; i <= i1; i++) {
                var dd = ((i - gx) * (i - gx) + (j - gy) * (j - gy)) / (radius * radius);
                if (dd > 4) continue;
                var f = Math.exp(-dd * 1.6);
                var k = j * NX + i;
                h[k] += (-0.55 * f - h[k]) * 0.05 * calm;
                h[k] -= speed * f * 0.22 * calm;
              }
            }
          }
          var next = hp;
          for (j = 1; j < NY - 1; j++) {
            var row = j * NX;
            for (i = 1; i < NX - 1; i++) {
              k = row + i;
              var lap = h[k - 1] + h[k + 1] + h[k - NX] + h[k + NX] - 4 * h[k];
              next[k] = (2 * h[k] - hp[k] + 0.22 * lap) * 0.986;
            }
          }
          c.hPrev = h;
          c.h = next;
          h = c.h;
          hp = c.hPrev;
        }
      };

      c.shape = function (time, turn, calm) {
        var NX = c.NX;
        var NY = c.NY;
        var W = c.W;
        var H = c.H;
        var h = c.h;
        var pos = c.pos;
        var n = c.n;
        var R = c.R;
        var A = (c.phone ? 20 : 28) * calm;
        var bend = (c.phone ? 5 : 7) * calm;
        // Hinge travel over the first 70% of the turn. As it flips, the sheet
        // slides so the turned part lands in view, then (55%..100%) it
        // shrinks and moves into print A's place.
        var flip = easeInOut(clamp(turn / 0.7, 0, 1));
        var hinge = mix(c.hStart, c.hEnd, flip);
        var flatten = smooth(0.6, 1, turn);
        var carry = easeInOut(smooth(0.55, 1, turn));
        var aRect = c.aRect;
        var aScale = aRect.h / c.final.h;
        var sc = mix(1, aScale, carry);
        var tx = mix(-c.final.x * flip, aRect.cx - c.final.x * aScale, carry);
        var ty = mix(-c.final.y * flip, aRect.cy - c.final.y * aScale, carry);
        var breathe = calm * (c.phone ? 2 : 3);
        for (var j = 0; j < NY; j++) {
          for (var i = 0; i < NX; i++) {
            var k = j * NX + i;
            var x = (i / (NX - 1) - 0.5) * W;
            var y = (j / (NY - 1) - 0.5) * H;
            var z = 0;
            if (A > 0.01) {
              var hi = i > 0 && i < NX - 1 ? h[k + 1] - h[k - 1] : 0;
              var hj = j > 0 && j < NY - 1 ? h[k + NX] - h[k - NX] : 0;
              x -= hi * bend;
              y -= hj * bend;
              z = h[k] * A + breathe * Math.sin(time * 0.00045 + x * 0.0021 + y * 0.0034) * Math.sin(time * 0.00031 + y * 0.0017);
            }
            // Curl past the hinge.
            var sv = x * n[0] + y * n[1];
            var dd = sv - hinge;
            if (dd > 0) {
              var th = dd / R;
              if (th < Math.PI) {
                var back = dd - R * Math.sin(th);
                x -= back * n[0];
                y -= back * n[1];
                z += R * (1 - Math.cos(th));
              } else {
                var over = 2 * dd - Math.PI * R;
                x -= over * n[0];
                y -= over * n[1];
                z += 2 * R;
              }
            }
            z *= 1 - flatten;
            pos[k * 3] = x * sc + tx;
            pos[k * 3 + 1] = y * sc + ty;
            pos[k * 3 + 2] = z * sc;
          }
        }
        // Normals from the finished surface.
        var nrm = c.nrm;
        for (j = 0; j < NY; j++) {
          for (i = 0; i < NX; i++) {
            k = j * NX + i;
            var a = (i < NX - 1 ? k + 1 : k) * 3;
            var b = (i > 0 ? k - 1 : k) * 3;
            var cc = (j < NY - 1 ? k + NX : k) * 3;
            var d2 = (j > 0 ? k - NX : k) * 3;
            var ux = pos[a] - pos[b];
            var uy = pos[a + 1] - pos[b + 1];
            var uz = pos[a + 2] - pos[b + 2];
            var vx = pos[cc] - pos[d2];
            var vy = pos[cc + 1] - pos[d2 + 1];
            var vz = pos[cc + 2] - pos[d2 + 2];
            var nx = uy * vz - uz * vy;
            var ny = uz * vx - ux * vz;
            var nz = ux * vy - uy * vx;
            var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nrm[k * 3] = nx / len;
            nrm[k * 3 + 1] = ny / len;
            nrm[k * 3 + 2] = nz / len;
          }
        }
        // A soft shadow of the lifted parts, cast down and to the right.
        var sh = c.shadow;
        var sa = c.shadowA;
        for (k = 0; k < NX * NY; k++) {
          var zz = pos[k * 3 + 2];
          sh[k * 3] = pos[k * 3] + zz * 0.22;
          sh[k * 3 + 1] = pos[k * 3 + 1] + zz * 0.32;
          sh[k * 3 + 2] = -1;
          sa[k * 2] = clamp(zz / (R * 2), 0, 1) * 0.1 * (1 - flatten);
          sa[k * 2 + 1] = 0;
        }
      };

      c.draw = function () {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        var half = [c.W / 2, c.H / 2];
        var dist = c.phone ? 1100 : 1500;

        // Shadow first, blended, no depth.
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(c.shadowProg);
        bindAttr(c.shadowProg, 'aPos', buffers.shadowPos, c.shadow, 3);
        bindAttr(c.shadowProg, 'aNormal', buffers.normal, c.nrm, 3);
        bindAttr(c.shadowProg, 'aUv', buffers.uv, null, 2);
        bindAttr(c.shadowProg, 'aBackUv', buffers.shadowAlpha, c.shadowA, 2);
        gl.uniform2fv(gl.getUniformLocation(c.shadowProg, 'uHalf'), half);
        gl.uniform1f(gl.getUniformLocation(c.shadowProg, 'uDist'), dist);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
        gl.drawElements(gl.TRIANGLES, c.count, gl.UNSIGNED_SHORT, 0);

        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(c.prog);
        bindAttr(c.prog, 'aPos', buffers.pos, c.pos, 3);
        bindAttr(c.prog, 'aNormal', buffers.normal, c.nrm, 3);
        bindAttr(c.prog, 'aUv', buffers.uv, null, 2);
        bindAttr(c.prog, 'aBackUv', buffers.backUv, null, 2);
        gl.uniform2fv(gl.getUniformLocation(c.prog, 'uHalf'), half);
        gl.uniform1f(gl.getUniformLocation(c.prog, 'uDist'), dist);
        gl.uniform1f(gl.getUniformLocation(c.prog, 'uHasBack'), tex.hasBack);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex.front);
        gl.uniform1i(gl.getUniformLocation(c.prog, 'uFront'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tex.back);
        gl.uniform1i(gl.getUniformLocation(c.prog, 'uBack'), 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
        gl.drawElements(gl.TRIANGLES, c.count, gl.UNSIGNED_SHORT, 0);
      };

      function bindAttr(prog, name, buffer, data, size) {
        var loc = gl.getAttribLocation(prog, name);
        if (loc < 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        if (data) gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }

      return c;
    }

    // Print A's place in the frame at the start of the exhibition, as the
    // centre (relative to the frame's centre) and height.
    function measureA() {
      var world0 = world.style.transform;
      world.style.transform = 'none';
      var fr = frame.getBoundingClientRect();
      var ar = printA.getBoundingClientRect();
      world.style.transform = world0;
      return {
        cx: ar.left + ar.width / 2 - (fr.left + fr.width / 2),
        cy: ar.top + ar.height / 2 - (fr.top + fr.height / 2),
        h: ar.height
      };
    }

    function layout() {
      if (cloth) {
        cloth.layout();
        cloth.aRect = measureA();
      }
    }

    /* ---------- Scroll and frame loop ---------- */
    function read() {
      var vh = window.innerHeight;
      var pr = progressOf(section);
      var sc = pr.scrolled;
      // 0.15 screens of rest, 1.6 screens of turn, then the exhibition.
      state.turnTarget = cloth ? clamp((sc - vh * 0.15) / (vh * 1.6), 0, 1) : 1;
      var exStart = cloth ? vh * 1.75 : 0;
      state.exTarget = clamp((sc - exStart) / Math.max(1, pr.travel - exStart), 0, 1);
    }

    var last = performance.now();
    function tick(now) {
      state.frame = 0;
      var dt = Math.min(48, now - last);
      last = now;
      read();
      // Fast flicks catch up quicker, so the cloth never trails far behind.
      var gap = state.turnTarget - state.turn;
      state.turn += gap * (Math.abs(gap) > 0.25 ? 0.22 : 0.14);
      if (Math.abs(state.turnTarget - state.turn) < 0.002) state.turn = state.turnTarget;
      state.ex += (state.exTarget - state.ex) * 0.1;
      state.mx += (pointer.x - state.mx) * 0.05;
      state.my += (pointer.y - state.my) * 0.05;

      // Cloth and turn.
      var done = state.turn >= 0.997;
      if (cloth && cloth.aRect) {
        var calm = 1 - smooth(0, 0.22, state.turn);
        if (!done) {
          if (calm > 0) cloth.step(dt, now, calm);
          cloth.shape(now, state.turn, calm);
          cloth.draw();
        }
        clothWrap.style.opacity = done ? '0' : '1';
        printA.style.opacity = done ? '1' : '0';
        labels.style.opacity = String(1 - smooth(0.02, 0.18, state.turn));
      }
      document.body.classList.toggle('jvli-x-header-in', state.turn > 0.9 || !cloth);

      // Exhibition camera: forward through the depths, turned by the mouse.
      // The walk: forward past print A, over toward B, then across to C,
      // ending face to face with the far word.
      var ex = state.ex;
      var camZ = easeInOut(ex) * 3100;
      var vw = window.innerWidth / 100;
      var narrow = window.innerWidth < 750;
      var camX = ((narrow ? -72 : -34) * smooth(0.06, 0.4, ex) + (narrow ? 144 : 58) * smooth(0.4, 0.82, ex)) * vw;
      var yaw = state.mx * 3;
      var pitch = -state.my * 2;
      world.style.transform =
        'translate3d(' + camX.toFixed(1) + 'px, 0, ' + camZ.toFixed(1) + 'px) rotateY(' + yaw.toFixed(3) + 'deg) rotateX(' + pitch.toFixed(3) + 'deg)';
      items.forEach(function (item) {
        var z = parseFloat(item.style.getPropertyValue('--z')) || 0;
        var toCamera = camZ + z;
        // Prints fade just before the camera would pass through them; the
        // giant words (walls) fade earlier, so only one wall is ever in view.
        var word = item.classList.contains('jvli-x-giant');
        var fade = word ? clamp((200 - toCamera) / 500, 0, 1) : clamp((1000 - toCamera) / 400, 0, 1);
        if (item !== printA || done) item.style.opacity = String(fade);
      });

      if (state.visible) state.frame = requestAnimationFrame(tick);
    }

    function start() {
      if (!state.frame) {
        last = performance.now();
        state.frame = requestAnimationFrame(tick);
      }
    }

    whenVisible(section, function (on) {
      state.visible = on;
      if (on) start();
    });

    if (cloth) {
      var fontReady = document.fonts && document.fonts.load ? document.fonts.load('300 100px Newsreader') : Promise.resolve();
      fontReady.then(function () {
        layout();
        section.classList.add('is-live');
        start();
      });
      loadImage(section.dataset.back).then(function (img) {
        cloth.setPhoto(img);
      });
      var resizeTimer = 0;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layout, 200);
      });
    } else {
      start();
    }
  }


  /* ================================================================
     04 Studio
     ================================================================ */

  function initStudio(section) {
    if (section.dataset.jvliReady) return;
    section.dataset.jvliReady = 'true';
    var space = section.querySelector('[data-jvli-x-space]');
    var floor = section.querySelector('[data-jvli-x-floor]');
    var hang = section.querySelector('[data-jvli-x-sway]');
    var swatch = section.querySelector('[data-jvli-x-float]');
    if (still) return;
    var st = { p: 0, mx: 0, my: 0, lx: 48, ly: 52, visible: false, frame: 0 };

    function tick(now) {
      st.frame = 0;
      var pr = progressOf(section);
      st.p += (pr.p - st.p) * 0.1;
      st.mx += (pointer.x - st.mx) * 0.04;
      st.my += (pointer.y - st.my) * 0.04;
      var vw = window.innerWidth / 100;
      var phone = window.innerWidth < 750;
      // Walk along the room, turning slightly as we go.
      var e = easeInOut(st.p);
      var camX = mix(phone ? 44 : 22, phone ? -78 : -30, e) * vw;
      var camZ = mix(-80, 220, e);
      var yaw = mix(-5, 5, e) + st.mx * 2.5;
      space.style.transform =
        'translate3d(' + camX.toFixed(1) + 'px, 0, ' + camZ.toFixed(1) + 'px) rotateY(' + yaw.toFixed(3) + 'deg) rotateX(' + (-st.my * 1.5).toFixed(3) + 'deg)';
      // Window light drifts toward the pointer, slowly.
      st.lx += (50 + pointer.x * 12 - st.lx) * 0.02;
      st.ly += (54 + pointer.y * 6 - st.ly) * 0.02;
      floor.style.setProperty('--jvli-x-lx', st.lx.toFixed(2) + '%');
      floor.style.setProperty('--jvli-x-ly', st.ly.toFixed(2) + '%');
      // The hanging print sways; the swatch floats. Everything else is still.
      if (hang) hang.style.setProperty('--jvli-x-sway', (Math.sin((now / 7000) * Math.PI * 2) * 1.5).toFixed(3) + 'deg');
      if (swatch) {
        var lift = (Math.sin((now / 9000) * Math.PI * 2) + 1) / 2;
        swatch.style.setProperty('--jvli-x-lift', (4 + lift * 10).toFixed(2) + 'px');
        swatch.style.setProperty('--jvli-x-lift-n', lift.toFixed(3));
      }
      if (st.visible) st.frame = requestAnimationFrame(tick);
    }
    whenVisible(section, function (on) {
      st.visible = on;
      if (on && !st.frame) st.frame = requestAnimationFrame(tick);
    });
  }

  /* ================================================================
     05 Found objects
     ================================================================ */

  function initFound(section) {
    if (section.dataset.jvliReady) return;
    section.dataset.jvliReady = 'true';
    var items = Array.prototype.slice.call(section.querySelectorAll('[data-jvli-x-found-item]'));
    if (!items.length) return;
    if (still) {
      items.forEach(function (item) {
        item.classList.add('is-near');
      });
      return;
    }
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var frame = 0;
    var visible = false;
    var eased = items.map(function () {
      return 1;
    });

    function tick() {
      frame = 0;
      var vh = window.innerHeight;
      var moving = false;
      items.forEach(function (item, i) {
        var media = item.querySelector('.jvli-card__media');
        if (!media) return;
        var r = media.getBoundingClientRect();
        if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
        // -1 above the middle, 0 in the middle, 1 below.
        var d = clamp((r.top + r.height / 2 - vh / 2) / (vh * 0.75), -1, 1);
        eased[i] += (d - eased[i]) * 0.14;
        if (Math.abs(d - eased[i]) > 0.002) moving = true;
        var a = Math.abs(eased[i]);
        var side = item.classList.contains('is-right') ? -1 : 1;
        media.style.setProperty('--jvli-x-rot', (eased[i] * 3.2 * side).toFixed(3) + 'deg');
        media.style.setProperty('--jvli-x-scale', (1 - a * 0.08).toFixed(4));
        media.style.setProperty('--jvli-x-blur', (fine ? Math.pow(a, 1.6) * 7 : 0).toFixed(2) + 'px');
        media.style.setProperty('--jvli-x-sat', (1 - a * 0.45).toFixed(3));
        item.classList.toggle('is-near', Math.abs(d) < 0.3);
      });
      if (visible && moving) frame = requestAnimationFrame(tick);
    }
    function schedule() {
      if (visible && !frame) frame = requestAnimationFrame(tick);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    whenVisible(section, function (on) {
      visible = on;
      schedule();
    });
  }

  /* ================================================================
     06 The ink
     ================================================================ */

  // A block-print flower, stamped in ink: eight petals with a line cut
  // through each, a ring of dots, eight small inner petals and a centre.
  function stampMotif(size, color) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var m = size / 2;
    g.translate(m, m);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.shadowColor = color;
    g.shadowBlur = size * 0.004;

    function petal(len, wid, rot) {
      g.save();
      g.rotate(rot);
      g.beginPath();
      g.moveTo(0, -len * 0.18);
      g.bezierCurveTo(wid, -len * 0.4, wid * 0.9, -len * 0.92, 0, -len);
      g.bezierCurveTo(-wid * 0.9, -len * 0.92, -wid, -len * 0.4, 0, -len * 0.18);
      g.fill();
      g.restore();
    }
    var R = size * 0.46;
    for (var i = 0; i < 8; i++) petal(R, R * 0.3, (i * Math.PI) / 4);
    // Cut lines through the petals (the paper shows through).
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = size * 0.006;
    for (i = 0; i < 8; i++) {
      g.save();
      g.rotate((i * Math.PI) / 4);
      g.beginPath();
      g.moveTo(0, -R * 0.36);
      g.quadraticCurveTo(R * 0.03, -R * 0.62, 0, -R * 0.86);
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, R * 0.34, 0, Math.PI * 2);
    g.lineWidth = size * 0.012;
    g.stroke();
    g.restore();
    // Ring of dots between the petals.
    for (i = 0; i < 16; i++) {
      var a = (i * Math.PI) / 8 + Math.PI / 16;
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56, size * 0.009, 0, Math.PI * 2);
      g.fill();
    }
    // Inner petals and the centre.
    for (i = 0; i < 8; i++) petal(R * 0.28, R * 0.1, (i * Math.PI) / 4 + Math.PI / 8);
    g.beginPath();
    g.arc(0, 0, R * 0.07, 0, Math.PI * 2);
    g.fill();
    // Uneven ink: a stamp never prints perfectly.
    var data = g.getImageData(0, 0, size, size);
    var px = data.data;
    for (var k = 3; k < px.length; k += 4) {
      if (!px[k]) continue;
      var r = Math.random();
      px[k] = r < 0.035 ? px[k] * 0.15 : px[k] * (0.78 + r * 0.22);
    }
    g.putImageData(data, 0, 0);
    return c;
  }

  function initInk(section) {
    if (section.dataset.jvliReady) return;
    section.dataset.jvliReady = 'true';
    var canvas = section.querySelector('canvas');
    var g = canvas.getContext('2d');
    var color = getComputedStyle(section).getPropertyValue('--jvli-x-ink-color').trim() || '#8e2f26';
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var motif = null;
    var st = { grow: 0, shown: 0, x: 0.5, y: 0.5, spawned: false, dry: 0, done: false, frame: 0, visible: false, rot: 0 };
    var seen = false;
    try {
      seen = sessionStorage.getItem('jvli-x-ink') === '1';
    } catch (e) {}

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(alpha) {
      var W = canvas.clientWidth;
      var H = canvas.clientHeight;
      g.clearRect(0, 0, W, H);
      if (!motif || st.shown <= 0.0005) return;
      var e = 1 - Math.pow(1 - st.shown, 3);
      var d = mix(0.012, 1.75, e) * Math.max(W, H);
      g.save();
      g.globalAlpha = alpha;
      // It drifts toward the middle as it grows.
      g.translate(mix(st.x, 0.5, e * 0.7) * W, mix(st.y, 0.5, e * 0.7) * H);
      g.rotate(st.rot + e * 0.5);
      g.drawImage(motif, -d / 2, -d / 2, d, d);
      g.restore();
    }

    if (still || seen) {
      // A faint, finished stain.
      size();
      motif = stampMotif(1400, color);
      st.shown = 0.62;
      draw(0.1);
      window.addEventListener('resize', function () {
        size();
        draw(0.1);
      });
      return;
    }

    function feed(amount) {
      if (st.done) return;
      if (!motif) motif = stampMotif(1400, color);
      st.grow = clamp(st.grow + amount, 0, 1);
      if (!st.frame) st.frame = requestAnimationFrame(tick);
    }

    function tick(now) {
      st.frame = 0;
      st.shown += (st.grow - st.shown) * 0.035;
      var alpha = 0.92;
      if (st.grow >= 1 && st.shown > 0.985) {
        if (!st.dry) {
          st.dry = now;
          try {
            sessionStorage.setItem('jvli-x-ink', '1');
          } catch (e) {}
        }
        var t = clamp((now - st.dry) / 3200, 0, 1);
        alpha = mix(0.92, 0.1, easeInOut(t));
        if (t >= 1) st.done = true;
      }
      draw(alpha);
      if (!st.done && (Math.abs(st.grow - st.shown) > 0.001 || st.dry)) st.frame = requestAnimationFrame(tick);
    }

    size();
    window.addEventListener('resize', function () {
      size();
      draw(st.done ? 0.1 : 0.92);
    });

    if (fine) {
      // The cursor feeds the ink: roughly three screen widths of movement.
      var last = null;
      section.addEventListener('pointermove', function (e) {
        var rect = canvas.getBoundingClientRect();
        if (!st.spawned) {
          st.spawned = true;
          st.x = clamp((e.clientX - rect.left) / rect.width, 0.1, 0.9);
          st.y = clamp((e.clientY - rect.top) / rect.height, 0.15, 0.85);
          st.rot = Math.random() * Math.PI;
        }
        if (last) feed(Math.hypot(e.clientX - last.x, e.clientY - last.y) / (window.innerWidth * 4.5));
        last = { x: e.clientX, y: e.clientY };
      });
      section.addEventListener('pointerleave', function () {
        last = null;
      });
    } else {
      // Phones: scrolling through the paper feeds it.
      var lastY = window.scrollY;
      st.spawned = true;
      st.x = 0.5;
      st.y = 0.46;
      window.addEventListener(
        'scroll',
        function () {
          var y = window.scrollY;
          var r = section.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.4 && r.bottom > 0) feed(Math.abs(y - lastY) / (window.innerHeight * 1.6));
          lastY = y;
        },
        { passive: true }
      );
    }
  }

  /* ================================================================
     Init
     ================================================================ */

  function init(scope) {
    scope.querySelectorAll('[data-jvli-x-journey]').forEach(initJourney);
    scope.querySelectorAll('[data-jvli-x-studio]').forEach(initStudio);
    scope.querySelectorAll('[data-jvli-x-found]').forEach(initFound);
    scope.querySelectorAll('[data-jvli-x-ink]').forEach(initInk);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }
  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });
})();
