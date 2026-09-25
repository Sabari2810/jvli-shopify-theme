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
        avatarImg.alt = '';
        avatarImg.loading = 'lazy';
        // If the avatar can't load, show the first letter instead.
        avatarImg.addEventListener('error', function () {
          avatar.textContent = (post.handle || '?').charAt(0).toUpperCase();
        });
        avatarImg.src = post.avatar;
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
      // No preview if the video can't load; the thumbnail stays.
      video.addEventListener('error', function () {
        link.classList.remove('is-playing');
        video.remove();
      });
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

  function thumbnailLoads(reel) {
    return new Promise(function (resolve) {
      if (!reel || !reel.thumbnail) return resolve(false);
      var image = new Image();
      var timer = setTimeout(function () {
        resolve(false);
      }, 8000);
      image.onload = function () {
        clearTimeout(timer);
        resolve(image.naturalWidth > 0);
      };
      image.onerror = function () {
        clearTimeout(timer);
        resolve(false);
      };
      image.src = reel.thumbnail;
    });
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

      // Without the feed, keep only real photos; with nothing left, hide the
      // section rather than show empty tiles.
      function fallBack() {
        row.querySelectorAll('[data-jvli-empty]').forEach(function (item) {
          item.remove();
        });
        if (!row.children.length) {
          var section = row.closest('.jvli-gallery');
          if (section) section.hidden = true;
        }
      }

      fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (response) {
          return response.ok ? response.json() : { reels: [] };
        })
        .then(function (data) {
          var reels = ((data && data.reels) || []).slice(0, count);
          // Only reels whose thumbnail actually loads replace the photos, so
          // a visitor never sees a broken image.
          return Promise.all(reels.map(thumbnailLoads)).then(function (loaded) {
            return reels.filter(function (reel, i) {
              return loaded[i];
            });
          });
        })
        .then(function (reels) {
          if (!reels || !reels.length) return fallBack();
          // Reels first; any remaining slots keep the real fallback photos.
          var photos = Array.prototype.slice.call(row.children).filter(function (item) {
            return !item.hasAttribute('data-jvli-empty');
          });
          var items = reels.map(function (reel) {
            return reelItem(reel, post);
          });
          photos.slice(0, count - items.length).forEach(function (photo) {
            items.push(photo);
          });
          row.replaceChildren.apply(row, items);
          row.classList.add('jvli-gallery__row--reels');
          if (post) row.classList.add('jvli-gallery__row--posts');
        })
        .catch(fallBack);
    });
  }

  /* ---------- Search overlay ----------
     Opens over the page (a native <dialog>, so Escape, focus and screen
     readers are handled) and shows products, collections and pages as you
     type, from Shopify's predictive search. Enter or "See all results" goes
     to the full search page. */

  var SEARCH_MIN_CHARS = 2;
  var ARROW_ICON =
    '<svg class="jvli-icon jvli-icon--arrow" viewBox="0 0 24 12" aria-hidden="true" focusable="false">' +
    '<path d="M1 6h21M17 1.5 22 6l-5 4.5"/></svg>';

  function searchRoot() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function formatPrice(amount) {
    var value = parseFloat(amount);
    if (!isFinite(value)) return '';
    var currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'INR';
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: value % 1 ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(value);
    } catch (error) {
      return value.toFixed(0);
    }
  }

  function sizedImage(url, width) {
    if (!url) return '';
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + width;
  }

  function searchPageUrl(query) {
    return searchRoot() + 'search?q=' + encodeURIComponent(query) + '&options%5Bprefix%5D=last';
  }

  function renderSearchResults(container, query, data) {
    var results = (data && data.resources && data.resources.results) || {};
    var products = results.products || [];
    var collections = results.collections || [];
    var pages = results.pages || [];
    container.replaceChildren();

    if (!products.length && !collections.length && !pages.length) {
      var empty = el('div', 'jvli-search__empty');
      empty.appendChild(el('p', 'jvli-search__empty-title', 'No results for “' + query + '”'));
      empty.appendChild(el('p', 'jvli-search__empty-text', 'Check the spelling or try a simpler word, like “kurti” or “cotton”.'));
      container.appendChild(empty);
      return;
    }

    if (products.length) {
      container.appendChild(el('p', 'jvli-eyebrow jvli-search__label', 'Products'));
      var list = el('ul', 'jvli-search__products');
      list.setAttribute('role', 'list');
      products.forEach(function (product) {
        var item = el('li');
        var link = el('a', 'jvli-search__product');
        link.href = product.url;
        var media = el('span', 'jvli-search__product-media');
        var src = product.image || (product.featured_image && product.featured_image.url);
        if (src) {
          var img = el('img');
          img.src = sizedImage(src, 360);
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('error', function () {
            img.remove();
          });
          media.appendChild(img);
        }
        link.appendChild(media);
        var text = el('span', 'jvli-search__product-text');
        text.appendChild(el('span', 'jvli-search__product-title', product.title));
        var price = el('span', 'jvli-search__product-price', formatPrice(product.price));
        if (product.available === false) price.appendChild(el('span', 'jvli-search__sold-out', 'Sold out'));
        text.appendChild(price);
        link.appendChild(text);
        item.appendChild(link);
        list.appendChild(item);
      });
      container.appendChild(list);
    }

    var others = collections
      .map(function (c) {
        return { title: c.title, url: c.url, kind: 'Collection' };
      })
      .concat(
        pages.map(function (p) {
          return { title: p.title, url: p.url, kind: 'Page' };
        }),
      );
    if (others.length) {
      container.appendChild(el('p', 'jvli-eyebrow jvli-search__label', 'Collections & pages'));
      var links = el('ul', 'jvli-search__links');
      links.setAttribute('role', 'list');
      others.forEach(function (other) {
        var item = el('li');
        var link = el('a', 'jvli-search__link');
        link.href = other.url;
        link.appendChild(el('span', '', other.title));
        link.appendChild(el('span', 'jvli-search__kind', other.kind));
        item.appendChild(link);
        links.appendChild(item);
      });
      container.appendChild(links);
    }

    var all = el('a', 'jvli-search__all', 'See all results for “' + query + '”');
    all.href = searchPageUrl(query);
    all.insertAdjacentHTML('beforeend', ARROW_ICON);
    container.appendChild(all);
  }

  function initSearch() {
    var dialog = document.querySelector('[data-jvli-search]');
    if (!dialog || dialog.dataset.jvliReady) return;
    dialog.dataset.jvliReady = 'true';
    // Browsers without <dialog> keep the plain link to the search page.
    if (typeof dialog.showModal !== 'function') return;

    var panel = dialog.querySelector('[data-jvli-search-panel]');
    var input = dialog.querySelector('[data-jvli-search-input]');
    var clear = dialog.querySelector('[data-jvli-search-clear]');
    var body = dialog.querySelector('[data-jvli-search-body]');
    var start = dialog.querySelector('[data-jvli-search-start]');
    var results = dialog.querySelector('[data-jvli-search-results]');
    var controller = null;
    var timer = null;
    var shown = '';

    function showStart() {
      if (controller) controller.abort();
      shown = '';
      results.replaceChildren();
      dialog.removeAttribute('data-loading');
      if (start) start.hidden = false;
    }

    function search(query) {
      if (query === shown) return;
      if (controller) controller.abort();
      controller = typeof AbortController === 'function' ? new AbortController() : null;
      dialog.setAttribute('data-loading', '');
      var url =
        searchRoot() +
        'search/suggest.json?q=' +
        encodeURIComponent(query) +
        '&resources%5Btype%5D=product,collection,page' +
        '&resources%5Blimit%5D=8' +
        '&resources%5Blimit_scope%5D=each' +
        '&resources%5Boptions%5D%5Bunavailable_products%5D=last';
      fetch(url, { headers: { Accept: 'application/json' }, signal: controller ? controller.signal : undefined })
        .then(function (response) {
          if (!response.ok) throw new Error('Search failed');
          return response.json();
        })
        .then(function (data) {
          if (input.value.trim() !== query) return;
          shown = query;
          if (start) start.hidden = true;
          renderSearchResults(results, query, data);
          dialog.removeAttribute('data-loading');
        })
        .catch(function (error) {
          if (error && error.name === 'AbortError') return;
          dialog.removeAttribute('data-loading');
          // Suggestions unavailable: Enter still searches the full page.
          results.replaceChildren();
          var all = el('a', 'jvli-search__all', 'Search for “' + query + '”');
          all.href = searchPageUrl(query);
          all.insertAdjacentHTML('beforeend', ARROW_ICON);
          results.appendChild(all);
          if (start) start.hidden = true;
        });
    }

    function onInput() {
      var query = input.value.trim();
      clear.hidden = input.value === '';
      clearTimeout(timer);
      if (query.length < SEARCH_MIN_CHARS) {
        showStart();
        return;
      }
      timer = setTimeout(function () {
        search(query);
      }, 180);
    }

    function open(event) {
      if (event) event.preventDefault();
      // Close the phone menu if search was opened from it.
      document.querySelectorAll('[data-jvli-menu][open]').forEach(function (menu) {
        menu.open = false;
      });
      if (dialog.open) return;
      dialog.showModal();
      document.documentElement.classList.add('jvli-search-open');
      input.focus();
      if (input.value) input.select();
    }

    function close() {
      if (dialog.open) dialog.close();
    }

    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('jvli-search-open');
      panel.style.transform = '';
    });

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-jvli-search-open]');
      if (trigger) open(event);
    });
    dialog.querySelector('[data-jvli-search-close]').addEventListener('click', close);
    // A click on the dimmed area outside the panel closes it.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });
    clear.addEventListener('click', function () {
      input.value = '';
      onInput();
      input.focus();
    });
    input.addEventListener('input', onInput);
    dialog.querySelector('form').addEventListener('submit', function (event) {
      if (!input.value.trim()) event.preventDefault();
    });

    // Phones: swipe down from the top of the results to close.
    var touchStartY = null;
    panel.addEventListener(
      'touchstart',
      function (event) {
        touchStartY = body.scrollTop <= 0 ? event.touches[0].clientY : null;
      },
      { passive: true },
    );
    panel.addEventListener(
      'touchmove',
      function (event) {
        if (touchStartY === null) return;
        var dy = event.touches[0].clientY - touchStartY;
        panel.style.transform = dy > 0 ? 'translateY(' + Math.min(dy, 160) * 0.6 + 'px)' : '';
      },
      { passive: true },
    );
    panel.addEventListener('touchend', function (event) {
      if (touchStartY === null) return;
      var dy = event.changedTouches[0].clientY - touchStartY;
      touchStartY = null;
      panel.style.transform = '';
      if (dy > 110) close();
    });
  }

  /* ---------- Cart page ----------
     Quantity steppers and Remove update the bag in place through
     /cart/change.js, which also returns this section re-rendered; the new
     HTML replaces the old. The form still works without JavaScript. */

  var cartBusy = false;

  function cartSection() {
    return document.querySelector('[data-jvli-cart]');
  }

  function showCartError(message) {
    var section = cartSection();
    var box = section && section.querySelector('[data-jvli-cart-error]');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  function changeCartLine(line, quantity) {
    var section = cartSection();
    if (!section || cartBusy) return;
    cartBusy = true;
    section.classList.add('is-updating');
    var sectionId = section.dataset.sectionId;
    var focusLine = line;
    fetch(root + 'cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity, sections: [sectionId], sections_url: window.location.pathname }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.description || data.message || 'Could not update your bag.');
          return data;
        });
      })
      .then(function (cart) {
        var html = cart.sections && cart.sections[sectionId];
        var fresh = null;
        if (html) {
          var template = document.createElement('template');
          template.innerHTML = html;
          fresh = template.content.querySelector('[data-jvli-cart]');
        }
        if (!fresh) {
          window.location.reload();
          return;
        }
        section.replaceWith(fresh);
        document.querySelectorAll('[data-jvli-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count;
          el.hidden = cart.item_count === 0;
        });
        document.dispatchEvent(new CustomEvent('jvli:cart:updated', { detail: { cart: cart } }));
        // Keep keyboard users where they were.
        var input = fresh.querySelector('[data-jvli-cart-line="' + focusLine + '"] [data-jvli-cart-qty]');
        if (input && quantity > 0) input.focus();
      })
      .catch(function (error) {
        section.classList.remove('is-updating');
        showCartError(error.message);
        // Put the quantities back to what the bag really holds.
        fetch(root + 'cart.js', { headers: { Accept: 'application/json' } })
          .then(function (response) {
            return response.json();
          })
          .then(function (cart) {
            section.querySelectorAll('[data-jvli-cart-line]').forEach(function (row) {
              var item = cart.items[Number(row.dataset.jvliCartLine) - 1];
              var input = row.querySelector('[data-jvli-cart-qty]');
              if (item && input) input.value = item.quantity;
            });
          })
          .catch(function () {});
      })
      .then(function () {
        cartBusy = false;
      });
  }

  var cartTimer = null;

  function initCart() {
    if (document.documentElement.dataset.jvliCartReady) return;
    document.documentElement.dataset.jvliCartReady = 'true';

    document.addEventListener('click', function (event) {
      var section = event.target.closest('[data-jvli-cart]');
      if (!section) return;
      var row = event.target.closest('[data-jvli-cart-line]');
      if (!row) return;
      var line = Number(row.dataset.jvliCartLine);

      if (event.target.closest('[data-jvli-cart-remove]')) {
        event.preventDefault();
        changeCartLine(line, 0);
        return;
      }
      var step = event.target.closest('[data-jvli-cart-step]');
      if (step) {
        var input = row.querySelector('[data-jvli-cart-qty]');
        var max = input.max ? Number(input.max) : Infinity;
        var next = Math.min(max, Math.max(0, (Number(input.value) || 0) + Number(step.dataset.jvliCartStep)));
        if (next === Number(input.value)) return;
        input.value = next;
        clearTimeout(cartTimer);
        // A short pause lets several taps become one update.
        cartTimer = setTimeout(function () {
          changeCartLine(line, next);
        }, 350);
      }
    });

    document.addEventListener('change', function (event) {
      if (!event.target.closest('[data-jvli-cart]')) return;
      if (event.target.matches('[data-jvli-cart-qty]')) {
        var row = event.target.closest('[data-jvli-cart-line]');
        var quantity = Math.max(0, Math.floor(Number(event.target.value) || 0));
        clearTimeout(cartTimer);
        changeCartLine(Number(row.dataset.jvliCartLine), quantity);
      } else if (event.target.matches('[data-jvli-cart-note]')) {
        fetch(root + 'cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ note: event.target.value }),
        }).catch(function () {});
      }
    });

    // Enter in a quantity box updates that line instead of submitting the
    // whole form to checkout.
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !event.target.matches('[data-jvli-cart] [data-jvli-cart-qty]')) return;
      event.preventDefault();
      event.target.blur();
    });
  }

  /* ---------- Product page ---------- */

  function initProduct(scope) {
    scope.querySelectorAll('[data-jvli-product]').forEach(function (section) {
      if (section.dataset.jvliReady) return;
      section.dataset.jvliReady = 'true';

      var form = section.querySelector('[data-jvli-product-form]');
      var dataEl = section.querySelector('[data-jvli-variants]');
      var variants = [];
      try {
        variants = JSON.parse(dataEl ? dataEl.textContent : '[]');
      } catch (error) {
        variants = [];
      }
      var idInput = section.querySelector('[data-jvli-variant-id]');
      var priceEl = section.querySelector('[data-jvli-price]');
      var addButton = section.querySelector('[data-jvli-add-button]');
      var fieldsets = Array.prototype.slice.call(section.querySelectorAll('[data-jvli-option]'));

      /* Gallery: thumbnails, dots and swiping share one "show" function. */
      var slidesEl = section.querySelector('[data-jvli-slides]');
      var slides = Array.prototype.slice.call(section.querySelectorAll('.jvli-product__slide'));
      function showMedia(mediaId, scroll) {
        var index = slides.findIndex(function (slide) {
          return String(slide.dataset.mediaId) === String(mediaId);
        });
        if (index === -1) return;
        slides.forEach(function (slide, i) {
          slide.classList.toggle('is-active', i === index);
        });
        section.querySelectorAll('[data-jvli-thumb]').forEach(function (thumb) {
          thumb.classList.toggle('is-active', thumb.dataset.jvliThumb === String(mediaId));
        });
        section.querySelectorAll('[data-jvli-dot-for]').forEach(function (dot) {
          dot.classList.toggle('is-active', dot.dataset.jvliDotFor === String(mediaId));
        });
        if (scroll && slidesEl && slidesEl.scrollWidth > slidesEl.clientWidth + 1) {
          slidesEl.scrollTo({ left: slides[index].offsetLeft, behavior: 'smooth' });
        }
      }
      section.querySelectorAll('[data-jvli-thumb]').forEach(function (thumb) {
        thumb.addEventListener('click', function () {
          showMedia(thumb.dataset.jvliThumb, true);
        });
      });
      // Phones: the slides scroll sideways; keep the dots in step.
      if (slidesEl) {
        var scrollTimer = null;
        slidesEl.addEventListener('scroll', function () {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(function () {
            if (slidesEl.scrollWidth <= slidesEl.clientWidth + 1) return;
            var index = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
            if (slides[index]) showMedia(slides[index].dataset.mediaId, false);
          }, 80);
        }, { passive: true });
      }

      /* Options -> variant. */
      function selected() {
        return fieldsets.map(function (fieldset) {
          var checked = fieldset.querySelector('input:checked');
          return checked ? checked.value : null;
        });
      }
      function findVariant(options) {
        return variants.find(function (variant) {
          return variant.options.every(function (value, i) {
            return value === options[i];
          });
        });
      }
      function markAvailability(options) {
        // A value is struck through when no available variant has it together
        // with the other options currently chosen.
        fieldsets.forEach(function (fieldset, position) {
          fieldset.querySelectorAll('input').forEach(function (input) {
            var candidate = options.slice();
            candidate[position] = input.value;
            var match = findVariant(candidate);
            input.closest('.jvli-card__size').classList.toggle('is-unavailable', !match || !match.available);
          });
        });
      }
      function update() {
        var options = selected();
        var variant = findVariant(options);
        fieldsets.forEach(function (fieldset, i) {
          var label = fieldset.querySelector('[data-jvli-option-value]');
          if (label) label.textContent = options[i] || '';
        });
        markAvailability(options);

        var available = !!(variant && variant.available);
        if (form) form.dataset.jvliUnavailable = available ? 'false' : 'true';
        if (addButton) {
          addButton.disabled = !available;
          addButton.textContent = !variant ? 'Unavailable' : available ? 'Add to bag' : 'Sold out';
        }
        if (!variant) return;
        if (idInput) idInput.value = variant.id;
        if (priceEl) priceEl.innerHTML = variant.price;
        if (variant.media) showMedia(variant.media, true);
        // Keep the URL shareable for the chosen variant.
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState(window.history.state, '', url.toString());
      }
      fieldsets.forEach(function (fieldset) {
        fieldset.addEventListener('change', update);
      });
      if (fieldsets.length) markAvailability(selected());

      /* Quantity stepper. */
      section.querySelectorAll('[data-jvli-qty]').forEach(function (button) {
        button.addEventListener('click', function () {
          var input = section.querySelector('input[name="quantity"]');
          var next = (parseInt(input.value, 10) || 1) + parseInt(button.dataset.jvliQty, 10);
          input.value = Math.min(Math.max(next, 1), parseInt(input.max, 10) || 99);
        });
      });

      /* Size guide pop-up. */
      var dialog = section.querySelector('[data-jvli-size-guide]');
      if (dialog) buildSizeBoard(dialog);
      if (dialog && dialog.showModal) {
        section.querySelectorAll('[data-jvli-size-guide-open]').forEach(function (button) {
          button.addEventListener('click', function () {
            dialog.showModal();
          });
        });
        dialog.querySelectorAll('[data-jvli-size-guide-close]').forEach(function (button) {
          button.addEventListener('click', function () {
            dialog.close();
          });
        });
        // Clicking the dimmed backdrop closes it too.
        dialog.addEventListener('click', function (event) {
          if (event.target === dialog) dialog.close();
        });
      }
    });
  }

  /* ---------- Size guide board ----------
     Turns the Size guide page (a table with sizes down the side, then a
     paragraph in italics for units and paragraphs under a "Fit notes"
     heading) into a pallanguzhi board: measurements carved into the pits,
     sizes along the top, seed trays at each end. The page stays the place to
     edit the numbers; without JavaScript it shows as the plain table.

     With 5 sizes and 3 measurements the board is a photograph (assets/
     jvli-sizeboard.webp, its pits emptied) with the text set into each pit;
     any other shape falls back to a board drawn in CSS. */

  // Pit centres in the photograph, as % of its width and height.
  var BOARD_COLUMNS = [22.0, 33.7, 45.2, 56.4, 67.7, 79.0];
  var BOARD_ROWS = [18.3, 42.3, 62.7, 83.3];

  function photoBoard(dialog, rows) {
    var src = dialog.getAttribute('data-jvli-board-image');
    if (!src || rows.length !== BOARD_COLUMNS.length) return null;
    if (!rows.every(function (row) { return row.length === BOARD_ROWS.length; })) return null;

    var frame = el('div', 'jvli-sizeboard__photo');
    var inner = el('div', 'jvli-sizeboard__photo-inner');
    inner.setAttribute('aria-hidden', 'true');
    var img = el('img');
    img.src = src;
    img.alt = '';
    img.width = 1435;
    img.height = 480;
    img.loading = 'lazy';
    inner.appendChild(img);
    // Page rows are sizes; on the board sizes run along the top.
    rows.forEach(function (sizeRow, column) {
      sizeRow.forEach(function (value, row) {
        var label = el('span', column === 0 ? 'jvli-sizeboard__label jvli-sizeboard__label--head' : 'jvli-sizeboard__label', value);
        label.style.left = BOARD_COLUMNS[column] + '%';
        label.style.top = BOARD_ROWS[row] + '%';
        inner.appendChild(label);
      });
    });
    frame.appendChild(inner);
    return frame;
  }

  var SEEDS = 13;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function tray(side) {
    var node = el('span', 'jvli-sizeboard__tray jvli-sizeboard__tray--' + side);
    node.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < SEEDS; i++) node.appendChild(el('span', 'jvli-sizeboard__seed'));
    if (side === 'right') {
      for (var f = 0; f < 2; f++) {
        var flower = el('span', 'jvli-sizeboard__flower jvli-sizeboard__flower--' + (f + 1));
        for (var p = 0; p < 5; p++) flower.appendChild(el('span'));
        node.appendChild(flower);
      }
    }
    return node;
  }

  function buildSizeBoard(dialog) {
    var rte = dialog.querySelector('.rte');
    var table = rte && rte.querySelector('table');
    if (!table || dialog.querySelector('.jvli-sizeboard')) return;

    var rows = Array.prototype.map.call(table.rows, function (row) {
      return Array.prototype.map.call(row.cells, function (cell) {
        return cell.textContent.trim();
      });
    });
    if (rows.length < 2) return;

    // The page lists sizes down the side; the board lists them along the top.
    var grid = el('table', 'jvli-sizeboard__grid');
    var caption = el('caption', 'visually-hidden', 'Body measurements by size');
    grid.appendChild(caption);
    rows[0].forEach(function (heading, column) {
      var row = grid.insertRow();
      rows.forEach(function (sizeRow, index) {
        var cell = document.createElement(index === 0 || column === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row';
        else if (column === 0) cell.scope = 'col';
        cell.appendChild(el('span', index === 0 ? 'jvli-sizeboard__pit jvli-sizeboard__pit--label' : 'jvli-sizeboard__pit', sizeRow[column] || ''));
        row.appendChild(cell);
      });
    });

    var board = photoBoard(dialog, rows);
    if (board) {
      // The photo is for the eye; screen readers get the table. (A table
      // can't be shrunk out of sight itself, so it goes in a wrapper.)
      var readable = el('div', 'jvli-sizeboard__sr');
      readable.appendChild(grid);
      board.appendChild(readable);
    } else {
      board = el('div', 'jvli-sizeboard__board');
      board.appendChild(tray('left'));
      var scroller = el('div', 'jvli-sizeboard__scroll');
      scroller.appendChild(grid);
      board.appendChild(scroller);
      board.appendChild(tray('right'));
    }

    // Units (the italic line) and the fit notes under the heading.
    var units = '';
    var notes = [];
    var heading = rte.querySelector('h2, h3, h4');
    rte.querySelectorAll('p').forEach(function (paragraph) {
      if (paragraph.classList.contains('jvli-size-guide__sub')) return;
      if (heading && heading.compareDocumentPosition(paragraph) & Node.DOCUMENT_POSITION_FOLLOWING) {
        notes.push(paragraph.textContent.trim());
      } else if (paragraph.textContent.trim()) {
        units = paragraph.textContent.trim();
      }
    });

    var wrap = el('div', 'jvli-sizeboard');
    wrap.appendChild(board);
    if (notes.length || units) {
      var foot = el('div', 'jvli-sizeboard__notes');
      if (notes.length) {
        foot.appendChild(el('p', 'jvli-sizeboard__notes-label', heading ? heading.textContent.trim() : 'Fit notes'));
        var text = el('div', 'jvli-sizeboard__notes-text');
        notes.forEach(function (note) {
          if (note) text.appendChild(el('p', null, note));
        });
        foot.appendChild(text);
      }
      if (units) {
        var mark = el('span', 'jvli-sizeboard__mark');
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML =
          '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 21v-7M12 14c0-4-2.4-6.4-6-7 .2 3.8 2.4 6.4 6 7Zm0 0c0-4 2.4-6.4 6-7-.2 3.8-2.4 6.4-6 7Zm0-3c-1.6-1.6-1.6-4.4 0-7 1.6 2.6 1.6 5.4 0 7Z"/></svg>';
        foot.appendChild(mark);
        foot.appendChild(el('p', 'jvli-sizeboard__units', units));
      }
      wrap.appendChild(foot);
    }

    // The Tamil line sits under the title.
    var sub = rte.querySelector('.jvli-size-guide__sub');
    var title = dialog.querySelector('.jvli-product__dialog-head h2');
    if (sub && title) title.insertAdjacentElement('afterend', el('p', 'jvli-sizeboard__sub', sub.textContent.trim()));

    rte.hidden = true;
    rte.insertAdjacentElement('afterend', wrap);
    dialog.classList.add('jvli-product__dialog--board');
  }

  /* ---------- Collection filters and sorting ---------- */

  function initCollection(scope) {
    scope.querySelectorAll('[data-jvli-collection]').forEach(function (section) {
      if (section.dataset.jvliReady) return;
      section.dataset.jvliReady = 'true';
      var form = section.querySelector('[data-jvli-filter-form]');
      if (!form) return;

      // Leave empty price boxes out of the URL.
      form.addEventListener('submit', function () {
        form.querySelectorAll('input[type="number"]').forEach(function (input) {
          if (input.value === '') input.disabled = true;
        });
      });

      var sort = form.querySelector('[data-jvli-sort]');
      if (sort) {
        sort.addEventListener('change', function () {
          if (form.requestSubmit) form.requestSubmit();
          else form.submit();
        });
      }

      // One filter open at a time; clicking elsewhere or Escape closes it.
      var filters = Array.prototype.slice.call(form.querySelectorAll('[data-jvli-filter]'));
      filters.forEach(function (filter) {
        filter.addEventListener('toggle', function () {
          if (!filter.open) return;
          filters.forEach(function (other) {
            if (other !== filter) other.open = false;
          });
        });
      });
      document.addEventListener('click', function (event) {
        filters.forEach(function (filter) {
          if (filter.open && !filter.contains(event.target)) filter.open = false;
        });
      });
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        filters.forEach(function (filter) {
          filter.open = false;
        });
      });
    });
  }

  /* ---------- Related products ---------- */

  function initRelated(scope) {
    scope.querySelectorAll('[data-jvli-related]').forEach(function (section) {
      if (section.dataset.jvliReady || !section.dataset.url) return;
      section.dataset.jvliReady = 'true';
      fetch(section.dataset.url)
        .then(function (response) {
          return response.ok ? response.text() : '';
        })
        .then(function (html) {
          var template = document.createElement('template');
          template.innerHTML = html;
          var fresh = template.content.querySelector('[data-jvli-related]');
          if (fresh && fresh.children.length) section.replaceChildren.apply(section, Array.prototype.slice.call(fresh.children));
        })
        .catch(function () {});
    });
  }

  /* ---------- Add to bag ---------- */

  // Refreshes the bag count. With `after`, the new count shows once that
  // promise settles (the add to bag photo landing on the bag).
  function updateCartCount(after) {
    return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json();
      })
      .then(function (cart) {
        return Promise.resolve(after).then(function () {
          return cart;
        });
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

  /* ---------- Add to bag animation ----------
     A round cut of the product photo flies up into the header bag, which
     gives a small bounce as the new count appears. Skipped with reduced
     motion, or when neither the photo nor the bag is on screen. */

  function visibleArea(el) {
    var box = el.getBoundingClientRect();
    var w = Math.min(box.right, window.innerWidth) - Math.max(box.left, 0);
    var h = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
    return w > 0 && h > 0 ? w * h : 0;
  }

  // The most visible of the elements matching `selector` in `scope`.
  function mostVisible(scope, selector) {
    var best = null;
    var bestArea = 0;
    scope.querySelectorAll(selector).forEach(function (el) {
      var area = visibleArea(el);
      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    });
    return best;
  }

  function bumpBag() {
    document.querySelectorAll('.jvli-header__icon--bag').forEach(function (bag) {
      bag.classList.remove('is-bumped');
      void bag.offsetWidth; // restart the animation
      bag.classList.add('is-bumped');
    });
  }

  // Resolves when the photo has landed (straight away when it can't fly).
  function flyToBag(form) {
    var scope = form.closest('[data-jvli-card], [data-jvli-product]');
    var photo = scope && mostVisible(scope, 'img');
    var bag = mostVisible(document, '.jvli-header__icon--bag');
    if (!photo || !bag || !photo.currentSrc || !document.body.animate) return Promise.resolve();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();

    var from = photo.getBoundingClientRect();
    var to = bag.getBoundingClientRect();
    var size = Math.min(from.width, from.height, 260);
    var left = from.left + (from.width - size) / 2;
    var top = from.top + (from.height - size) / 2;
    var dx = to.left + to.width / 2 - (left + size / 2);
    var dy = to.top + to.height / 2 - (top + size / 2);
    var end = 22 / size;

    var fly = document.createElement('div');
    fly.className = 'jvli-fly';
    fly.setAttribute('aria-hidden', 'true');
    fly.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + size + 'px;height:' + size + 'px;';
    var img = document.createElement('img');
    img.src = photo.currentSrc;
    img.alt = '';
    fly.appendChild(img);
    document.body.appendChild(fly);

    var animation = fly.animate(
      [
        { transform: 'translate(0, 0) scale(1)', borderRadius: '2px', opacity: 1 },
        { transform: 'translate(0, -10px) scale(0.86)', borderRadius: '50%', opacity: 1, offset: 0.18 },
        {
          transform: 'translate(' + dx * 0.55 + 'px, ' + (dy * 0.55 - 40) + 'px) scale(' + (0.86 + end) / 3 + ')',
          borderRadius: '50%',
          opacity: 1,
          offset: 0.6
        },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + end + ')', borderRadius: '50%', opacity: 0.5 }
      ],
      { duration: 820, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'forwards' }
    );

    return new Promise(function (resolve) {
      function done() {
        fly.remove();
        bumpBag();
        resolve();
      }
      animation.onfinish = done;
      animation.oncancel = done;
    });
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
    var quantityField = form.querySelector('[name="quantity"]');
    var quantity = Math.max(1, parseInt(quantityField && quantityField.value, 10) || 1);
    var added = form.querySelector('[data-jvli-added]');
    button.disabled = true;
    if (message) message.textContent = '';
    if (added) added.hidden = true;

    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(idField.value), quantity: quantity }] }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.description || data.message || 'Could not add to bag');
          return data;
        });
      })
      .then(function () {
        button.textContent = 'Added';
        if (added) added.hidden = false;
        return updateCartCount(flyToBag(form));
      })
      .catch(function (error) {
        if (message) message.textContent = error.message;
      })
      .finally(function () {
        setTimeout(function () {
          button.textContent = label;
          // The product page may have switched to a sold-out variant meanwhile.
          button.disabled = form.dataset.jvliUnavailable === 'true';
        }, 1600);
      });
  }

  /* ---------- Kolam thread (home page) ----------
     One maroon line runs down the page and draws itself as you scroll. It
     keeps to the side gutters and, between sections, crosses the page as a
     kolam border: the line weaves over and under a row of dots. It lies on the
     paper, under everything else: wherever a photo, text or button sits, the
     line is simply left out. A crossing may pass behind a photo but never
     through text or buttons.

     For smooth scrolling the line is split into its visible pieces (no SVG
     mask to repaint), only the piece being drawn changes each frame, and the
     drawn length eases toward the scroll position. The layout is measured
     again only when the page itself changes size, not when a phone's address
     bar shows or hides.

     Only when layout/theme.liquid marks <main data-jvli-thread> (home page,
     Theme settings > Kolam thread). With reduced motion it is drawn in full. */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var THREAD_COVERS =
    'img, video, iframe, picture, svg, h1, h2, h3, h4, p, a, button, input, select, textarea, label, dl, [data-jvli-thread-under]';
  var THREAD_MEDIA = 'img, video, iframe, picture, svg, [data-jvli-thread-under]';
  var THREAD_STEP = 2; // px between the points the line is measured at

  function initThread() {
    var main = document.querySelector('main[data-jvli-thread]');
    if (!main || main.dataset.jvliThreadReady) return;
    main.dataset.jvliThreadReady = 'true';

    var still = window.matchMedia('(prefers-reduced-motion: reduce)');
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'jvli-thread');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    main.appendChild(svg);

    var state = null;
    var shown = 0; // drawn length on screen, easing toward the scroll position
    var frame = 0;
    var size = '';

    function rectsOf(mainBox) {
      var rects = [];
      main.querySelectorAll(THREAD_COVERS).forEach(function (el) {
        if (el === svg || svg.contains(el)) return;
        var box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) return;
        var text = !el.matches(THREAD_MEDIA) && !el.querySelector(THREAD_MEDIA);
        var pad = text ? 6 : 2;
        rects.push({
          x1: box.left - mainBox.left - pad,
          y1: box.top - mainBox.top - pad,
          x2: box.right - mainBox.left + pad,
          y2: box.bottom - mainBox.top + pad,
          text: text
        });
      });
      return rects;
    }

    function covered(rects, x, y) {
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2) return true;
      }
      return false;
    }

    function bandIsClear(rects, y, half, x1, x2, textOnly) {
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if ((r.text || !textOnly) && r.y1 < y + half && r.y2 > y - half && r.x1 < x2 && r.x2 > x1) return false;
      }
      return true;
    }

    /* Nearest height to a section boundary where a full-width band is free of
       content, or failing that free of text (the crossing then runs partly
       behind a photo). Null when neither is close by. */
    function crossingNear(rects, boundary, half, x1, x2) {
      for (var pass = 0; pass < 2; pass++) {
        for (var offset = 0; offset <= 48; offset += 2) {
          if (bandIsClear(rects, boundary + offset, half, x1, x2, pass)) return boundary + offset;
          if (offset && bandIsClear(rects, boundary - offset, half, x1, x2, pass)) return boundary - offset;
        }
      }
      return null;
    }

    function build() {
      var mainBox = main.getBoundingClientRect();
      var sections = Array.prototype.filter.call(main.children, function (el) {
        return el !== svg && el.offsetHeight > 0;
      });
      if (!sections.length) return;

      var width = main.clientWidth;
      var height = Math.round(sections[sections.length - 1].getBoundingClientRect().bottom - mainBox.top);
      size = width + 'x' + height;
      var phone = width < 750;
      var gutter = Math.min(96, Math.max(20, width * 0.054));
      var d = phone ? 8 : 11; // dots sit 2d apart; the line weaves around them at radius d
      var sides = [gutter / 2, width - gutter / 2];
      var rects = rectsOf(mainBox);
      var under = sections.map(function (el) {
        return !!el.querySelector('[data-jvli-thread-under]');
      });

      // The line as points every THREAD_STEP px, each with its length so far.
      var points = [];
      var knots = [[0, 0]];
      var dots = [];
      var len = 0;
      var x = sides[0];
      var y = 0;
      var side = 0;
      points.push([x, y, 0]);

      function to(nx, ny) {
        len += Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y));
        x = nx;
        y = ny;
        points.push([x, y, len]);
      }
      function line(nx, ny) {
        var steps = Math.max(1, Math.ceil(Math.max(Math.abs(nx - x), Math.abs(ny - y)) / THREAD_STEP));
        var x0 = x;
        var y0 = y;
        for (var s = 1; s <= steps; s++) to(x0 + ((nx - x0) * s) / steps, y0 + ((ny - y0) * s) / steps);
      }
      function arc(cx, cy, a0, a1) {
        var steps = Math.max(2, Math.ceil((Math.abs(a1 - a0) * d) / THREAD_STEP));
        for (var s = 1; s <= steps; s++) {
          var a = a0 + ((a1 - a0) * s) / steps;
          to(cx + d * Math.cos(a), cy + d * Math.sin(a));
        }
      }

      for (var i = 0; i < sections.length - 1; i++) {
        if (under[i] || under[i + 1]) continue;
        var boundary = sections[i + 1].getBoundingClientRect().top - mainBox.top;
        var at = crossingNear(rects, boundary, d + 4, sides[0] - d, sides[1] + d);
        if (at === null || at - d < y + 60) continue;

        var target = sides[1 - side];
        var dir = target > x ? 1 : -1;
        var count = Math.max(1, Math.floor((Math.abs(target - x) - 4 * d) / (2 * d)) - 2);
        if (count % 2 === 0) count -= 1; // odd, so a dot sits in the middle
        var span = Math.min(260, Math.max(120, Math.abs(target - x) * 0.3));
        var PI = Math.PI;

        line(x, at - d);
        knots.push([at - span / 2, len - (span / 2 - d)]);
        // Turn from going down to going across.
        arc(x + dir * d, at - d, dir > 0 ? PI : 0, PI / 2);
        line((x + target) / 2 - dir * count * d, at);
        // Weave over and under the row of dots.
        for (var k = 0; k < count; k++) {
          var cx = x + dir * d;
          var start = dir > 0 ? PI : 0;
          var over = k % 2 === 0;
          dots.push({ x: cx, y: at, len: len + (PI * d) / 2 });
          arc(cx, at, start, start + (over === dir > 0 ? PI : -PI));
        }
        line(target - dir * d, at);
        // Turn from going across to going down.
        arc(target - dir * d, at + d, -PI / 2, dir > 0 ? 0 : -PI);
        knots.push([at + span / 2, len + (span / 2 - d)]);
        side = 1 - side;
      }

      // Finish by looping once around a last dot.
      var endY = height - 40;
      if (endY - d > y + 60) {
        line(x, endY - d);
        knots.push([endY - d, len]);
        dots.push({ x: x, y: endY, len: len + Math.PI * d });
        arc(x, endY, -Math.PI / 2, (3 * Math.PI) / 2);
        knots.push([endY + 2 * d, len]);
      }

      // Split into the stretches that aren't under anything.
      var pieces = [];
      var run = null;
      points.forEach(function (p) {
        if (covered(rects, p[0], p[1])) {
          run = null;
          return;
        }
        if (!run) pieces.push((run = []));
        run.push(p);
      });

      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.textContent = '';

      var parts = [];
      pieces.forEach(function (run) {
        if (run.length < 2) return;
        var start = run[0][2];
        var length = run[run.length - 1][2] - start;
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'jvli-thread__line');
        path.setAttribute(
          'd',
          'M' +
            run
              .map(function (p) {
                return p[0].toFixed(1) + ' ' + p[1].toFixed(1);
              })
              .join('L')
        );
        path.style.strokeDasharray = length + ' ' + (length + 1);
        path.style.strokeDashoffset = length;
        svg.appendChild(path);
        parts.push({ el: path, start: start, length: length, drawn: 0 });
      });

      var circles = [];
      dots.forEach(function (dot) {
        if (covered(rects, dot.x, dot.y)) return;
        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('class', 'jvli-thread__dot');
        circle.setAttribute('cx', dot.x.toFixed(1));
        circle.setAttribute('cy', dot.y.toFixed(1));
        circle.setAttribute('r', phone ? 1.8 : 2.4);
        svg.appendChild(circle);
        circles.push({ el: circle, len: dot.len, on: false });
      });

      state = { knots: knots, len: len, parts: parts, circles: circles };
      paint(shown);
    }

    function lengthAt(penY) {
      var knots = state.knots;
      if (penY <= knots[0][0]) return 0;
      for (var i = 1; i < knots.length; i++) {
        var a = knots[i - 1];
        var b = knots[i];
        if (penY <= b[0]) return a[1] + ((b[1] - a[1]) * (penY - a[0])) / Math.max(1, b[0] - a[0]);
      }
      return state.len;
    }

    // The length the scroll position asks for. Uses the layout viewport
    // height, which stays put while a phone's address bar slides.
    function wanted() {
      if (still.matches) return state.len;
      var view = document.documentElement.clientHeight;
      if (window.scrollY + view >= document.documentElement.scrollHeight - 4) return state.len;
      return Math.min(state.len, lengthAt(view * 0.72 - main.getBoundingClientRect().top));
    }

    // Only touches the pieces and dots whose state changed.
    function paint(length) {
      state.parts.forEach(function (part) {
        var drawn = Math.max(0, Math.min(part.length, length - part.start));
        if (drawn === part.drawn) return;
        part.drawn = drawn;
        part.el.style.strokeDashoffset = part.length - drawn;
      });
      state.circles.forEach(function (circle) {
        var on = circle.len <= length;
        if (on === circle.on) return;
        circle.on = on;
        circle.el.classList.toggle('is-on', on);
      });
    }

    function tick() {
      frame = 0;
      if (!state) return;
      var goal = wanted();
      var gap = goal - shown;
      // Ease toward the goal; snap when close or when the jump is big (a
      // jump link, or opening the page part way down).
      shown = Math.abs(gap) < 1 || Math.abs(gap) > 2400 ? goal : shown + gap * 0.22;
      paint(shown);
      if (shown !== goal) frame = requestAnimationFrame(tick);
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    var rebuildTimer = 0;
    function rebuild() {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () {
        build();
        schedule();
      }, 150);
    }

    // Rebuild only when the page's own size changes (images and fonts
    // loading, rotating, resizing a desktop window).
    function rebuildIfResized() {
      var sections = Array.prototype.filter.call(main.children, function (el) {
        return el !== svg && el.offsetHeight > 0;
      });
      var last = sections[sections.length - 1];
      var height = last ? Math.round(last.getBoundingClientRect().bottom - main.getBoundingClientRect().top) : 0;
      if (main.clientWidth + 'x' + height !== size) rebuild();
    }

    build();
    shown = wanted();
    paint(shown);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('load', rebuild);
    // Sideways product rows move what covers the line; measure once they settle.
    main.addEventListener('scroll', rebuild, true);
    document.addEventListener('jvli:layout', rebuild); // e.g. a polaroid moved
    if (window.ResizeObserver) new ResizeObserver(rebuildIfResized).observe(main);
    else window.addEventListener('resize', rebuildIfResized);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  }

  /* ---------- Touchable polaroids ----------
     With a mouse, a polaroid leans toward the cursor with light sliding over
     the photo, and can be picked up and moved: it swings with the movement
     and stays where it's dropped (within a hand's reach of where it was). A
     tap on a phone lifts it and lets it settle. Works through the individual
     translate / rotate / scale properties, so each polaroid keeps its own
     tilt from the stylesheet. Off with reduced motion. */

  var POLAROID_REACH = 140; // px a polaroid can be moved from its place

  function initPolaroids(scope) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    scope.querySelectorAll('.jvli-polaroid').forEach(function (card) {
      if (card.dataset.jvliTouchable) return;
      card.dataset.jvliTouchable = 'true';
      card.classList.add('is-touchable');

      var x = 0;
      var y = 0;
      var drag = null;

      function set(name, value) {
        card.style.setProperty(name, value);
      }

      // Past the reach, movement meets growing resistance.
      function soften(value) {
        var limit = POLAROID_REACH;
        if (Math.abs(value) <= limit) return value;
        var over = Math.abs(value) - limit;
        return Math.sign(value) * (limit + over / (1 + over / 40));
      }

      function lean(event) {
        var box = card.getBoundingClientRect();
        var px = (event.clientX - box.left) / box.width;
        var py = (event.clientY - box.top) / box.height;
        set('--jvli-shine-x', px * 100 + '%');
        set('--jvli-shine-y', py * 100 + '%');
        set('--jvli-lean', (px - 0.5) * 5 + 'deg');
      }

      card.addEventListener('dragstart', function (event) {
        event.preventDefault();
      });

      card.addEventListener('pointerenter', function (event) {
        if (event.pointerType !== 'mouse') return;
        card.classList.add('is-hovered');
        lean(event);
      });

      card.addEventListener('pointerleave', function (event) {
        if (event.pointerType !== 'mouse' || drag) return;
        card.classList.remove('is-hovered');
        set('--jvli-lean', '0deg');
      });

      card.addEventListener('pointerdown', function (event) {
        if (event.pointerType !== 'mouse') {
          // Phones: lift and settle, without getting in the way of scrolling.
          card.classList.remove('is-tapped');
          void card.offsetWidth;
          card.classList.add('is-tapped');
          return;
        }
        if (event.button !== 0) return;
        event.preventDefault();
        card.setPointerCapture(event.pointerId);
        drag = { startX: event.clientX - x, startY: event.clientY - y, lastX: event.clientX, lastT: event.timeStamp, swing: 0 };
        card.classList.add('is-lifted', 'is-dragging');
      });

      card.addEventListener('pointermove', function (event) {
        if (event.pointerType !== 'mouse') return;
        if (!drag) {
          lean(event);
          return;
        }
        x = soften(event.clientX - drag.startX);
        y = soften(event.clientY - drag.startY);
        // Swing with the movement, like a card held at the top.
        var dt = Math.max(1, event.timeStamp - drag.lastT);
        var speed = (event.clientX - drag.lastX) / dt;
        drag.swing = drag.swing * 0.7 + Math.max(-14, Math.min(14, speed * 9)) * 0.3;
        drag.lastX = event.clientX;
        drag.lastT = event.timeStamp;
        set('--jvli-x', x + 'px');
        set('--jvli-y', y + 'px');
        set('--jvli-lean', drag.swing + 'deg');
      });

      function drop() {
        if (!drag) return;
        drag = null;
        x = Math.max(-POLAROID_REACH, Math.min(POLAROID_REACH, x));
        y = Math.max(-POLAROID_REACH, Math.min(POLAROID_REACH, y));
        set('--jvli-x', x + 'px');
        set('--jvli-y', y + 'px');
        set('--jvli-lean', '0deg');
        card.classList.remove('is-lifted', 'is-dragging');
        // The kolam thread goes around whatever sits on the page.
        document.dispatchEvent(new CustomEvent('jvli:layout'));
      }

      card.addEventListener('pointerup', drop);
      card.addEventListener('pointercancel', drop);
      card.addEventListener('lostpointercapture', drop);
      card.addEventListener('animationend', function () {
        card.classList.remove('is-tapped');
      });
    });
  }

  /* ---------- Handwriting that writes itself ----------
     Handwritten notes (.jvli-handwriting) are hidden until they scroll into
     view, then each line is revealed left to right at a writing pace, one
     line after another. Only when <body data-jvli-write> (Theme settings >
     Page animations) and motion is welcome; the stylesheet shows the notes
     anyway if this never runs. */

  var writeObserver = null;

  function initHandwriting(scope) {
    if (!document.body.hasAttribute('data-jvli-write')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.IntersectionObserver) return;
    if (!writeObserver) {
      writeObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-writing');
            writeObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.6 }
      );
    }

    scope.querySelectorAll('.jvli-handwriting').forEach(function (note) {
      if (note.classList.contains('jvli-write')) return;
      // Group the note's content into lines at each <br>.
      var lines = [];
      var line = null;
      Array.prototype.slice.call(note.childNodes).forEach(function (node) {
        if (node.nodeName === 'BR') {
          line = null;
          return;
        }
        if (!line) {
          if (node.nodeType === 3 && !node.textContent.trim()) return;
          line = el('span', 'jvli-write__line');
          note.insertBefore(line, node);
          lines.push(line);
        }
        line.appendChild(node);
      });

      var delay = 150;
      lines.forEach(function (span) {
        var length = span.textContent.trim().length;
        var duration = Math.max(380, Math.min(1500, length * 70));
        span.style.setProperty('--jvli-write-delay', delay + 'ms');
        span.style.setProperty('--jvli-write-duration', duration + 'ms');
        delay += duration + 90;
      });
      note.classList.add('jvli-write');
      writeObserver.observe(note);
    });
  }

  /* ---------- Weave loupe (product photos) ----------
     A round magnifier over the product photo shows the fabric up close:
     following the cursor on desktop; on phones a tap brings it up (it sits
     above the finger), dragging moves it and another tap puts it away. Uses the
     largest version of the photo so the weave is sharp. A small hint on the
     photo says how, until it has been used once. */

  var LOUPE_ZOOM = 2.8;

  function largestSource(img) {
    var best = img.currentSrc || img.src;
    var bestWidth = 0;
    (img.getAttribute('srcset') || '').split(',').forEach(function (candidate) {
      var parts = candidate.trim().split(/\s+/);
      var width = parseInt(parts[1], 10);
      if (parts[0] && width > bestWidth) {
        best = parts[0];
        bestWidth = width;
      }
    });
    return best;
  }

  function initLoupe(scope) {
    scope.querySelectorAll('[data-jvli-slides]').forEach(function (slides) {
      if (slides.dataset.jvliLoupe) return;
      slides.dataset.jvliLoupe = 'true';
      if (!slides.querySelector('.jvli-product__slide img')) return;

      var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      var gallery = slides.closest('.jvli-product__gallery') || slides;
      var hint = el('p', 'jvli-loupe-hint', 'Hover to see the weave');
      hint.setAttribute('aria-hidden', 'true');
      gallery.style.position = 'relative';
      gallery.appendChild(hint);

      var lens = el('div', 'jvli-loupe');
      lens.setAttribute('aria-hidden', 'true');
      // Sense hides empty divs (div:empty { display: none }), so give it a child.
      lens.appendChild(el('span', 'jvli-loupe__glass'));
      document.body.appendChild(lens);
      var current = null;
      var loaded = {};

      function show(img, x, y, above) {
        if (current !== img) {
          current = img;
          var src = largestSource(img);
          lens.style.backgroundImage = 'url("' + src + '")';
          if (!loaded[src]) {
            loaded[src] = true;
            new Image().src = src;
          }
        }
        var box = img.getBoundingClientRect();
        // object-fit: cover crops the photo; map the pointer onto the
        // photo itself, not just its box.
        var nw = img.naturalWidth || box.width;
        var nh = img.naturalHeight || box.height;
        var scale = Math.max(box.width / nw, box.height / nh);
        var shownW = nw * scale;
        var shownH = nh * scale;
        var px = x - box.left + (shownW - box.width) / 2;
        var py = y - box.top + (shownH - box.height) / 2;
        var size = lens.offsetWidth || 170;
        lens.style.backgroundSize = shownW * LOUPE_ZOOM + 'px ' + shownH * LOUPE_ZOOM + 'px';
        lens.style.backgroundPosition = size / 2 - px * LOUPE_ZOOM + 'px ' + (size / 2 - py * LOUPE_ZOOM) + 'px';
        lens.style.transform = 'translate(' + (x - size / 2) + 'px, ' + (y - size / 2 - (above ? size * 0.75 : 0)) + 'px)';
        lens.classList.add('is-on');
        gallery.classList.add('is-loupe');
      }

      function hide() {
        lens.classList.remove('is-on');
        gallery.classList.remove('is-loupe');
      }

      function photoAt(target) {
        var slide = target.closest && target.closest('.jvli-product__slide');
        return slide ? slide.querySelector('img') : null;
      }

      function used() {
        hint.classList.add('is-used');
      }

      // Desktop: follow the cursor.
      slides.addEventListener('pointermove', function (event) {
        if (event.pointerType !== 'mouse') return;
        var img = photoAt(event.target);
        if (!img) return hide();
        show(img, event.clientX, event.clientY, false);
        used();
      });
      slides.addEventListener('pointerleave', function (event) {
        if (event.pointerType === 'mouse') hide();
      });

      // Phones: tap the photo to bring the loupe up, drag to move it (the
      // photos don't swipe meanwhile), tap again to put it away. A tap
      // doesn't compete with scrolling or with the phone's own long-press
      // actions on images, so it works the same everywhere.
      var active = false;
      var downAt = null;

      function close() {
        active = false;
        gallery.classList.remove('is-loupe-touch');
        hint.textContent = 'Tap to see the weave';
        hide();
      }

      if (!fine) hint.textContent = 'Tap to see the weave';

      slides.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse') return;
        downAt = { x: event.clientX, y: event.clientY, t: event.timeStamp };
        if (active) {
          var img = photoAt(event.target) || current;
          if (img) show(img, event.clientX, event.clientY, true);
        }
      });
      slides.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'mouse' || !active) return;
        event.preventDefault();
        var img = photoAt(document.elementFromPoint(event.clientX, event.clientY) || event.target) || current;
        if (img) show(img, event.clientX, event.clientY, true);
      });
      slides.addEventListener('pointerup', function (event) {
        if (event.pointerType === 'mouse' || !downAt) return;
        var tap = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) < 10 && event.timeStamp - downAt.t < 400;
        downAt = null;
        if (!tap) return;
        if (active) {
          close();
          return;
        }
        var img = photoAt(event.target);
        if (!img) return;
        active = true;
        gallery.classList.add('is-loupe-touch');
        hint.textContent = 'Drag to look closer \u00b7 tap to close';
        hint.classList.remove('is-used');
        show(img, event.clientX, event.clientY, true);
      });
      slides.addEventListener('pointercancel', function () {
        downAt = null;
      });
      slides.addEventListener('contextmenu', function (event) {
        if (active) event.preventDefault();
      });
      // Swiping to another photo or leaving the page puts it away.
      slides.addEventListener('scroll', function () {
        if (active) close();
      }, { passive: true });
    });
  }

  /* ---------- Draw a kolam (sections/jvli-kolam) ----------
     A canvas doorstep with a grid of dots. Visitors draw with a smoothed
     rice-flour line; "Show me" draws a sikku kolam through the dots (the
     line bounces diagonally between the dots and loops round the border
     ones); "Save" shares or downloads the drawing with the JVLI mark. */

  // Sikku kolam loops for a cols x rows dot grid, in grid units: dots sit at
  // odd coordinates in a 2*cols x 2*rows box and the line travels at 45
  // degrees, rounding each bounce into a loop around the border dot.
  function sikkuLoops(cols, rows) {
    var W = 2 * cols;
    var H = 2 * rows;
    var seen = {};
    var loops = [];
    var starts = [];
    for (var y = 1; y < H; y += 2) {
      starts.push([0, y, 1, 1], [0, y, 1, -1]);
    }
    starts.forEach(function (start) {
      var key = start.join(',');
      if (seen[key]) return;
      var x = start[0];
      var yy = start[1];
      var dx = start[2];
      var dy = start[3];
      var bounces = [];
      for (var guard = 0; guard < 4 * W * H; guard++) {
        var tx = dx > 0 ? W - x : x;
        var ty = dy > 0 ? H - yy : yy;
        var t = Math.min(tx, ty);
        x += dx * t;
        yy += dy * t;
        var inX = dx;
        var inY = dy;
        if (t === tx) dx = -dx;
        if (t === ty) dy = -dy;
        var k = [x, yy, dx, dy].join(',');
        bounces.push({ x: x, y: yy, ix: inX, iy: inY, ox: dx, oy: dy });
        seen[k] = true;
        if (k === key) break;
      }
      loops.push(bounces);
    });
    return loops.map(function (bounces) {
      var points = [];
      bounces.forEach(function (b) {
        var cx = b.x + (b.ox - b.ix) / 2;
        var cy = b.y + (b.oy - b.iy) / 2;
        var a1 = Math.atan2(b.y - 0.5 * b.iy - cy, b.x - 0.5 * b.ix - cx);
        var a2 = Math.atan2(b.y + 0.5 * b.oy - cy, b.x + 0.5 * b.ox - cx);
        var delta = a2 - a1;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta <= -Math.PI) delta += 2 * Math.PI;
        var r = Math.SQRT1_2;
        for (var i = 0; i <= 10; i++) {
          var a = a1 + (delta * i) / 10;
          points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
      });
      points.push(points[0]);
      // Straight runs between loops: add points along them for an even pace.
      var even = [];
      for (var i = 0; i < points.length - 1; i++) {
        var p = points[i];
        var q = points[i + 1];
        var steps = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.12));
        for (var s = 0; s < steps; s++) even.push([p[0] + ((q[0] - p[0]) * s) / steps, p[1] + ((q[1] - p[1]) * s) / steps]);
      }
      even.push(points[points.length - 1]);
      return { points: even, size: [W, H] };
    });
  }

  function initKolam(scope) {
    scope.querySelectorAll('[data-jvli-kolam]').forEach(function (board) {
      if (board.dataset.jvliReady) return;
      board.dataset.jvliReady = 'true';
      var section = board.closest('.jvli-kolam') || board;
      var canvas = board.querySelector('canvas');
      var ctx = canvas.getContext('2d');
      var hint = board.querySelector('[data-jvli-kolam-hint]');
      var cols = parseInt(board.dataset.cols, 10) || 5;
      var rows = parseInt(board.dataset.rows, 10) || 6;
      var strokes = []; // each: array of [x, y] in grid units (0..2*cols, 0..2*rows)
      var drawing = null;
      var demo = null;
      var box = { w: 0, h: 0, unit: 1, ox: 0, oy: 0 };

      function layout() {
        var rect = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var pad = 0.3; // grid units of margin around the loops
        var unit = Math.min(rect.width / (2 * cols + 2 * pad), rect.height / (2 * rows + 2 * pad));
        box = {
          w: rect.width,
          h: rect.height,
          unit: unit,
          ox: (rect.width - 2 * cols * unit) / 2,
          oy: (rect.height - 2 * rows * unit) / 2
        };
        render();
      }

      function toPx(p) {
        return [box.ox + p[0] * box.unit, box.oy + p[1] * box.unit];
      }

      function toGrid(x, y) {
        return [(x - box.ox) / box.unit, (y - box.oy) / box.unit];
      }

      function paint(target, geometry, lineWidth) {
        target.fillStyle = '#fbf6ec';
        for (var i = 0; i < cols; i++) {
          for (var j = 0; j < rows; j++) {
            var d = geometry([2 * i + 1, 2 * j + 1]);
            target.beginPath();
            target.arc(d[0], d[1], Math.max(2.2, lineWidth * 0.62), 0, Math.PI * 2);
            target.fill();
          }
        }
        target.lineCap = 'round';
        target.lineJoin = 'round';
        target.strokeStyle = 'rgba(248, 242, 230, 0.94)';
        target.lineWidth = lineWidth;
        // A faint powdery edge, not a glow: rice flour is matte.
        target.shadowColor = 'rgba(248, 242, 230, 0.25)';
        target.shadowBlur = lineWidth * 0.35;
        strokes.concat(demo ? [demo.drawn] : []).forEach(function (stroke) {
          if (!stroke || stroke.length < 2) return;
          target.beginPath();
          var p = geometry(stroke[0]);
          target.moveTo(p[0], p[1]);
          for (var k = 1; k < stroke.length - 1; k++) {
            var a = geometry(stroke[k]);
            var b = geometry(stroke[k + 1]);
            target.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
          }
          var last = geometry(stroke[stroke.length - 1]);
          target.lineTo(last[0], last[1]);
          target.stroke();
        });
        target.shadowBlur = 0;
      }

      function render() {
        ctx.clearRect(0, 0, box.w, box.h);
        paint(ctx, toPx, Math.max(2.4, box.unit * 0.17));
      }

      function started() {
        if (hint) hint.classList.add('is-hidden');
      }

      // Drawing, smoothed with a short "lazy" follow so lines come out flowing.
      canvas.addEventListener('pointerdown', function (event) {
        if (event.button > 0) return;
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        stopDemo(true);
        var rect = canvas.getBoundingClientRect();
        var point = toGrid(event.clientX - rect.left, event.clientY - rect.top);
        drawing = { stroke: [point], at: point };
        strokes.push(drawing.stroke);
        started();
      });
      canvas.addEventListener('pointermove', function (event) {
        if (!drawing) return;
        var rect = canvas.getBoundingClientRect();
        var target = toGrid(event.clientX - rect.left, event.clientY - rect.top);
        var at = drawing.at;
        at = [at[0] + (target[0] - at[0]) * 0.55, at[1] + (target[1] - at[1]) * 0.55];
        var last = drawing.stroke[drawing.stroke.length - 1];
        if (Math.hypot(at[0] - last[0], at[1] - last[1]) * box.unit < 1.5) return;
        drawing.at = at;
        drawing.stroke.push(at);
        render();
      });
      function end() {
        if (!drawing) return;
        if (drawing.stroke.length === 1) {
          var p = drawing.stroke[0];
          drawing.stroke.push([p[0] + 0.01, p[1]]);
        }
        drawing = null;
        render();
      }
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);

      // "Show me": draw a sikku kolam, loop by loop.
      function stopDemo(keep) {
        if (!demo) return;
        cancelAnimationFrame(demo.frame);
        if (keep) strokes.push(demo.drawn);
        demo = null;
      }

      function playDemo() {
        stopDemo(false);
        strokes = [];
        started();
        var loops = sikkuLoops(cols, rows);
        var queue = [];
        loops.forEach(function (loop) {
          queue.push(loop.points);
        });
        var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (still) {
          strokes = queue;
          render();
          return;
        }
        var total = queue.reduce(function (sum, points) {
          return sum + points.length;
        }, 0);
        var perMs = total / Math.min(7000, 2200 + total * 3);
        var loopIndex = 0;
        var done = 0;
        var t0 = performance.now();
        demo = { drawn: [], frame: 0 };
        function frame(now) {
          var target = Math.min(total, Math.floor((now - t0) * perMs));
          while (done < target && demo) {
            var points = queue[loopIndex];
            var local = done - queue.slice(0, loopIndex).reduce(function (s, p) { return s + p.length; }, 0);
            if (local >= points.length) {
              strokes.push(demo.drawn);
              demo.drawn = [];
              loopIndex++;
              continue;
            }
            demo.drawn.push(points[local]);
            done++;
          }
          render();
          if (demo && done < total) demo.frame = requestAnimationFrame(frame);
          else stopDemo(true);
        }
        demo.frame = requestAnimationFrame(frame);
      }

      function clear() {
        stopDemo(false);
        strokes = [];
        render();
      }

      // Save: share the picture where the device can (phones), else download.
      function save() {
        var size = 1080;
        var out = document.createElement('canvas');
        var unit = size / (2 * cols + 2.6);
        out.width = size;
        out.height = Math.round(unit * (2 * rows + 2.6) + size * 0.16);
        var o = out.getContext('2d');
        var bg = o.createRadialGradient(out.width * 0.35, out.height * 0.3, 0, out.width * 0.5, out.height * 0.5, out.width * 0.9);
        bg.addColorStop(0, '#6a4b3a');
        bg.addColorStop(1, '#46322a');
        o.fillStyle = bg;
        o.fillRect(0, 0, out.width, out.height);
        var ox = (size - 2 * cols * unit) / 2;
        var oy = unit * 1.3;
        paint(o, function (p) {
          return [ox + p[0] * unit, oy + p[1] * unit];
        }, unit * 0.17);
        o.fillStyle = 'rgba(251, 246, 236, 0.92)';
        o.textAlign = 'center';
        o.font = '400 ' + Math.round(size * 0.06) + 'px Newsreader, Georgia, serif';
        o.fillText(board.dataset.mark || 'JVLI', size / 2, out.height - size * 0.075);
        o.font = '400 ' + Math.round(size * 0.022) + 'px Jost, Futura, sans-serif';
        o.fillStyle = 'rgba(251, 246, 236, 0.7)';
        o.fillText(('My kolam · ' + (board.dataset.site || '')).toUpperCase(), size / 2, out.height - size * 0.035);
        out.toBlob(function (blob) {
          if (!blob) return;
          var file = new File([blob], 'my-jvli-kolam.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: 'My kolam' }).catch(function () {});
            return;
          }
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'my-jvli-kolam.png';
          document.body.appendChild(link);
          link.click();
          setTimeout(function () {
            URL.revokeObjectURL(link.href);
            link.remove();
          }, 1000);
        }, 'image/png');
      }

      section.querySelectorAll('[data-jvli-kolam-demo]').forEach(function (button) {
        button.addEventListener('click', playDemo);
      });
      section.querySelectorAll('[data-jvli-kolam-clear]').forEach(function (button) {
        button.addEventListener('click', clear);
      });
      section.querySelectorAll('[data-jvli-kolam-save]').forEach(function (button) {
        button.addEventListener('click', save);
      });

      layout();
      if (window.ResizeObserver) new ResizeObserver(layout).observe(canvas);
      else window.addEventListener('resize', layout);
    });
  }

  /* ---------- Init ---------- */

  function init(scope) {
    initHeader(scope);
    initHero(scope);
    initReels(scope);
    initSearch();
    initCart();
    initProduct(scope);
    initLoupe(scope);
    initKolam(scope);
    initRelated(scope);
    initCollection(scope);
    initThread();
    initPolaroids(scope);
    initHandwriting(scope);
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
