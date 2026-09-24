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
        return updateCartCount();
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

  /* ---------- Init ---------- */

  function init(scope) {
    initHeader(scope);
    initHero(scope);
    initReels(scope);
    initSearch();
    initCart();
    initProduct(scope);
    initRelated(scope);
    initCollection(scope);
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
