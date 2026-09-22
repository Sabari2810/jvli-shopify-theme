/* JVLI home page behaviour. Every JVLI section loads this file, so it guards
   against running twice. Works per section so the theme editor can re-render
   sections (shopify:section:load). */
(function () {
  if (window.JvliHome) return;

  var root = window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/';

  /* ---------- Header ---------- */

  function initHeader(scope) {
    var header = scope.querySelector('[data-jvli-header]');
    if (!header || header.dataset.jvliReady) return;
    header.dataset.jvliReady = 'true';

    var wrapper = header.closest('.shopify-section');
    if (wrapper) {
      wrapper.classList.add('jvli-section-header');
      if (header.hasAttribute('data-jvli-header-overlay')) wrapper.classList.add('jvli-header-overlays');
    }

    function setHeight() {
      document.documentElement.style.setProperty('--jvli-header-height', header.offsetHeight + 'px');
    }

    if (header.hasAttribute('data-jvli-header-overlay')) {
      var solid = false;
      var onScroll = function () {
        var next = window.scrollY > 24;
        if (next !== solid) {
          solid = next;
          header.classList.toggle('is-solid', solid);
        }
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    } else {
      setHeight();
      window.addEventListener('resize', setHeight);
    }

    var menu = header.querySelector('[data-jvli-menu]');
    if (menu) {
      var close = function () {
        menu.open = false;
      };
      menu.addEventListener('toggle', function () {
        document.documentElement.style.overflow = menu.open ? 'hidden' : '';
      });
      menu.querySelectorAll('[data-jvli-menu-close], .jvli-menu__nav a').forEach(function (el) {
        el.addEventListener('click', close);
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.open) close();
      });
    }
  }

  /* ---------- Hero slides ---------- */

  function initHero(scope) {
    scope.querySelectorAll('[data-jvli-hero]').forEach(function (hero) {
      if (hero.dataset.jvliReady) return;
      hero.dataset.jvliReady = 'true';

      var slides = hero.querySelectorAll('[data-jvli-slide]');
      var dots = hero.querySelectorAll('[data-jvli-dot]');
      if (slides.length < 2) return;

      var current = 0;
      var timer = null;
      var seconds = parseInt(hero.dataset.autoplay, 10) || 0;
      var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function show(index) {
        current = (index + slides.length) % slides.length;
        slides.forEach(function (slide, i) {
          slide.classList.toggle('is-active', i === current);
          slide.setAttribute('aria-hidden', i === current ? 'false' : 'true');
        });
        dots.forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === current);
        });
      }

      function restart() {
        if (timer) clearInterval(timer);
        if (seconds > 0 && !reduceMotion) {
          timer = setInterval(function () {
            show(current + 1);
          }, seconds * 1000);
        }
      }

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          show(parseInt(dot.dataset.jvliDot, 10));
          restart();
        });
      });
      var next = hero.querySelector('[data-jvli-next]');
      if (next) {
        next.addEventListener('click', function () {
          show(current + 1);
          restart();
        });
      }
      hero.addEventListener('mouseenter', function () {
        if (timer) clearInterval(timer);
      });
      hero.addEventListener('mouseleave', restart);
      restart();
    });
  }

  /* ---------- Instagram reels ---------- */

  var PLAY_ICON =
    '<svg class="jvli-gallery__play" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.35)"/><path d="M10 8.2v7.6l6-3.8z" fill="#fff"/></svg>';

  function reelItem(reel) {
    var link = document.createElement('a');
    link.className = 'jvli-gallery__item jvli-gallery__item--reel';
    link.href = reel.permalink;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', 'Watch on Instagram' + (reel.caption ? ': ' + reel.caption : ''));

    var img = document.createElement('img');
    img.className = 'jvli-cover';
    img.src = reel.thumbnail;
    img.alt = reel.caption || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    link.appendChild(img);

    // Desktop only: play a muted preview on hover. The video loads on first hover.
    var canPreview =
      reel.video &&
      window.matchMedia('(hover: hover)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (canPreview) {
      var video = document.createElement('video');
      video.className = 'jvli-cover jvli-gallery__video';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-hidden', 'true');
      link.appendChild(video);
      link.addEventListener('mouseenter', function () {
        if (!video.src) video.src = reel.video;
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () {});
        link.classList.add('is-playing');
      });
      link.addEventListener('mouseleave', function () {
        video.pause();
        link.classList.remove('is-playing');
      });
    }

    link.insertAdjacentHTML('beforeend', PLAY_ICON);
    return link;
  }

  function initReels(scope) {
    scope.querySelectorAll('[data-jvli-reels]').forEach(function (row) {
      if (row.dataset.jvliReady) return;
      row.dataset.jvliReady = 'true';

      var count = parseInt(row.dataset.jvliReelsCount, 10) || 4;
      var url = row.dataset.jvliReels;
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'limit=' + count;

      fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (response) {
          return response.ok ? response.json() : { reels: [] };
        })
        .then(function (data) {
          var reels = (data && data.reels) || [];
          if (!reels.length) return;
          // Reels first; any remaining slots keep the fallback photos.
          var photos = Array.prototype.slice.call(row.children);
          var items = reels.slice(0, count).map(reelItem);
          photos.slice(0, count - items.length).forEach(function (photo) {
            items.push(photo);
          });
          row.replaceChildren.apply(row, items);
          row.classList.add('jvli-gallery__row--reels');
        })
        .catch(function () {});
    });
  }

  /* ---------- Add to bag ---------- */

  function updateCartCount() {
    return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json();
      })
      .then(function (cart) {
        document.querySelectorAll('[data-jvli-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count;
          el.hidden = cart.item_count === 0;
        });
        document.dispatchEvent(new CustomEvent('jvli:cart:updated', { detail: { cart: cart } }));
      })
      .catch(function () {});
  }

  function onAddSubmit(event) {
    var form = event.target.closest('[data-jvli-add-form]');
    if (!form) return;
    event.preventDefault();

    var message = form.querySelector('[data-jvli-add-message]');
    var button = form.querySelector('button[type="submit"]');
    var idField = form.querySelector('input[name="id"]:checked') || form.querySelector('input[type="hidden"][name="id"]');

    if (!idField) {
      if (message) message.textContent = 'Please choose a size.';
      return;
    }

    var label = button.textContent;
    button.disabled = true;
    if (message) message.textContent = '';

    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(idField.value), quantity: 1 }] }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.description || data.message || 'Could not add to bag');
          return data;
        });
      })
      .then(function () {
        button.textContent = 'Added';
        return updateCartCount();
      })
      .catch(function (error) {
        if (message) message.textContent = error.message;
      })
      .finally(function () {
        setTimeout(function () {
          button.textContent = label;
          button.disabled = false;
        }, 1600);
      });
  }

  /* ---------- Init ---------- */

  function init(scope) {
    initHeader(scope);
    initHero(scope);
    initReels(scope);
  }

  document.addEventListener('submit', onAddSubmit);
  document.addEventListener('change', function (event) {
    var form = event.target.closest('[data-jvli-add-form]');
    var message = form && form.querySelector('[data-jvli-add-message]');
    if (message) message.textContent = '';
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });

  window.JvliHome = { init: init, updateCartCount: updateCartCount };
})();
