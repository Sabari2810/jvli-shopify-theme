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

  // Instagram's post action icons (like, comment, share, save), drawn as lines.
  function igIcon(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + path + '</svg>';
  }
  var IG_ACTIONS =
    '<span class="jvli-igpost__icons">' +
    igIcon('<path d="M12 20.3s-7.8-4.6-8.8-10a4.8 4.8 0 0 1 8.8-3.2 4.8 4.8 0 0 1 8.8 3.2c-1 5.4-8.8 10-8.8 10Z"/>') +
    igIcon('<path d="M20.6 16.2A9 9 0 1 0 17 19.9l3.8 1.1-1.1-3.8a9 9 0 0 0 .9-1Z"/>') +
    igIcon('<path d="M21.5 3.5 10.6 13.2M21.5 3.5l-6.9 17-4-7.3-7.4-3.9 18.3-5.8Z"/>') +
    '</span>' +
    igIcon('<path d="M18.5 21 12 15.3 5.5 21V4.2c0-.7.5-1.2 1.2-1.2h10.6c.7 0 1.2.5 1.2 1.2V21Z"/>');

  function timeAgo(timestamp) {
    var time = Date.parse(timestamp);
    if (!time) return '';
    var days = Math.floor((Date.now() - time) / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return days + ' days ago';
    if (days < 28) return Math.floor(days / 7) + (days < 14 ? ' week ago' : ' weeks ago');
    return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /* One reel. As a tile: the cover. As a post: the cover framed like an
     Instagram post (profile, actions, caption). Either way it links to the
     reel on Instagram, and plays a muted preview on hover when Instagram
     provides the video (desktop only). */
  function reelItem(reel, post) {
    var link = el('a', 'jvli-gallery__item jvli-gallery__item--reel' + (post ? ' jvli-igpost' : ''));
    link.href = reel.permalink;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', 'Watch on Instagram' + (reel.caption ? ': ' + reel.caption : ''));

    var media = post ? el('span', 'jvli-igpost__media') : link;
    if (post) {
      var head = el('span', 'jvli-igpost__head');
      var avatar = el('span', 'jvli-igpost__avatar');
      if (post.avatar) {
        var avatarImg = el('img');
        avatarImg.src = post.avatar;
        avatarImg.alt = '';
        avatarImg.loading = 'lazy';
        avatar.appendChild(avatarImg);
      } else {
        avatar.textContent = (post.handle || '?').charAt(0).toUpperCase();
      }
      head.appendChild(avatar);
      head.appendChild(el('span', 'jvli-igpost__user', post.handle));
      head.appendChild(el('span', 'jvli-igpost__more', '•••'));
      link.appendChild(head);
      link.appendChild(media);
    }

    var img = el('img', 'jvli-cover');
    img.src = reel.thumbnail;
    img.alt = reel.caption || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    media.appendChild(img);

    var canPreview =
      reel.video &&
      window.matchMedia('(hover: hover)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (canPreview) {
      var video = el('video', 'jvli-cover jvli-gallery__video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-hidden', 'true');
      media.appendChild(video);
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
    media.insertAdjacentHTML('beforeend', PLAY_ICON);

    if (post) {
      var actions = el('span', 'jvli-igpost__actions');
      actions.innerHTML = IG_ACTIONS;
      link.appendChild(actions);
      var caption = el('span', 'jvli-igpost__caption');
      caption.appendChild(el('b', '', post.handle));
      if (reel.caption) caption.appendChild(document.createTextNode(' ' + reel.caption));
      link.appendChild(caption);
      var ago = timeAgo(reel.timestamp);
      if (ago) link.appendChild(el('span', 'jvli-igpost__date', ago));
    }
    return link;
  }

  function initReels(scope) {
    scope.querySelectorAll('[data-jvli-reels]').forEach(function (row) {
      if (row.dataset.jvliReady) return;
      row.dataset.jvliReady = 'true';

      var count = parseInt(row.dataset.jvliReelsCount, 10) || 4;
      var post =
        row.dataset.jvliReelsDisplay === 'tiles'
          ? null
          : { handle: row.dataset.jvliReelsHandle || '', avatar: row.dataset.jvliReelsAvatar || '' };
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
          var items = reels.slice(0, count).map(function (reel) {
            return reelItem(reel, post);
          });
          photos.slice(0, count - items.length).forEach(function (photo) {
            items.push(photo);
          });
          row.replaceChildren.apply(row, items);
          row.classList.add('jvli-gallery__row--reels');
          if (post) row.classList.add('jvli-gallery__row--posts');
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
