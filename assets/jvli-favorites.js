/* JVLI global favorites.

   Every heart ([data-jvli-favorite] with data-product-id) on any page shows and
   changes one list per shopper:
   - Signed in: the list lives in the customer's account, through the
     jvli-favorites app proxy (GET / POST /apps/jvli-favorites).
   - Signed out: the list is kept in this browser, and merged into the account
     the next time the shopper signs in.

   Also adds hearts to Sense's product cards and fills the favorites page.
   Config (printed by snippets/jvli-assets.liquid): window.JvliFavoritesConfig
   = { loggedIn, endpoint }. */
(function () {
  if (window.JvliFavorites) return;

  var config = window.JvliFavoritesConfig || {};
  var ENDPOINT = config.endpoint || '/apps/jvli-favorites';
  var GUEST_KEY = 'jvli:favorites';
  var MERGE_BATCH = 100;
  var PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;

  var loggedIn = !!config.loggedIn;
  var ids = [];
  var handles = {};
  var pending = {};
  // Filled by load() on the favorites page, which asks for product handles.
  var loadedProducts;
  var readyResolve;
  var ready = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  /* ---------- Guest list (this browser) ---------- */

  function readGuest() {
    try {
      var list = JSON.parse(window.localStorage.getItem(GUEST_KEY) || '[]');
      return Array.isArray(list)
        ? list.filter(function (item) {
            return item && PRODUCT_GID.test(item.id);
          })
        : [];
    } catch (error) {
      return [];
    }
  }

  function writeGuest(list) {
    try {
      if (list.length) window.localStorage.setItem(GUEST_KEY, JSON.stringify(list));
      else window.localStorage.removeItem(GUEST_KEY);
    } catch (error) {
      /* Storage blocked (e.g. private mode): the list lasts for this page. */
    }
  }

  function guestList() {
    return ids.map(function (id) {
      return { id: id, handle: handles[id] || '' };
    });
  }

  /* ---------- Account list (app proxy) ---------- */

  function request(method, body, query) {
    return fetch(ENDPOINT + (query || ''), {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!response.ok) {
            var error = new Error((data.error && data.error.message) || 'Could not update favorites');
            error.status = response.status;
            throw error;
          }
          return data;
        });
    });
  }

  function mergeGuest(list) {
    var batches = [];
    for (var i = 0; i < list.length; i += MERGE_BATCH) batches.push(list.slice(i, i + MERGE_BATCH));
    return batches.reduce(function (previous, batch) {
      return previous.then(function () {
        return request('POST', {
          action: 'merge',
          productIds: batch.map(function (item) {
            return item.id;
          }),
        });
      });
    }, Promise.resolve(null));
  }

  function load() {
    var guest = readGuest();
    guest.forEach(function (item) {
      if (item.handle) handles[item.id] = item.handle;
    });

    if (!loggedIn) {
      ids = guest.map(function (item) {
        return item.id;
      });
      return Promise.resolve();
    }

    var onFavoritesPage = !!document.querySelector('[data-jvli-favorites-page]');
    var start = guest.length ? mergeGuest(guest) : Promise.resolve(null);
    return start
      .then(function (merged) {
        if (guest.length) writeGuest([]);
        if (onFavoritesPage) return request('GET', null, '?include=products');
        return merged && merged.favorites ? merged : request('GET');
      })
      .then(function (data) {
        if (data.authenticated === false) {
          // The page thought we were signed in but the proxy disagrees.
          loggedIn = false;
          ids = guest.map(function (item) {
            return item.id;
          });
          return;
        }
        ids = data.favorites || [];
        if (onFavoritesPage) loadedProducts = data.products === undefined ? null : data.products;
      })
      .catch(function () {
        // Keep whatever we can show; hearts still work optimistically.
        ids = guest.map(function (item) {
          return item.id;
        });
      });
  }

  /* ---------- Rendering ---------- */

  function has(id) {
    return ids.indexOf(id) !== -1;
  }

  function render() {
    document.querySelectorAll('[data-jvli-favorite]').forEach(function (button) {
      var id = button.dataset.productId;
      var on = has(id);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.classList.toggle('is-active', on);
      var title = button.dataset.productTitle || 'this product';
      button.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + title + (on ? ' from favorites' : ' to favorites'));
      var label = button.querySelector('[data-jvli-favorite-label]');
      if (label) label.textContent = on ? 'Saved to favorites' : 'Save to favorites';
    });
    document.querySelectorAll('[data-jvli-favorites-count]').forEach(function (el) {
      el.textContent = ids.length;
      el.hidden = ids.length === 0;
    });
  }

  function changed() {
    render();
    document.dispatchEvent(new CustomEvent('jvli:favorites:changed', { detail: { ids: ids.slice() } }));
  }

  /* ---------- Toggling ---------- */

  function toggle(id, handle) {
    if (!PRODUCT_GID.test(id) || pending[id]) return Promise.resolve();
    if (handle) handles[id] = handle;
    var adding = !has(id);
    var previous = ids.slice();
    ids = adding
      ? ids.concat(id)
      : ids.filter(function (other) {
          return other !== id;
        });
    changed();

    if (!loggedIn) {
      writeGuest(guestList());
      return Promise.resolve();
    }

    pending[id] = true;
    return request('POST', { action: adding ? 'add' : 'remove', productId: id })
      .then(function (data) {
        ids = data.favorites || ids;
      })
      .catch(function (error) {
        if (error.status === 401) {
          // Signed out in another tab: keep the change in this browser.
          loggedIn = false;
          writeGuest(guestList());
          return;
        }
        ids = previous;
        flash(id, error.message);
      })
      .then(function () {
        delete pending[id];
        changed();
      });
  }

  function flash(id, message) {
    document.querySelectorAll('[data-jvli-favorite][data-product-id="' + id + '"]').forEach(function (button) {
      button.classList.add('is-error');
      button.title = message;
      setTimeout(function () {
        button.classList.remove('is-error');
        button.removeAttribute('title');
      }, 2500);
    });
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-jvli-favorite]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(button.dataset.productId, button.dataset.productHandle);
  });

  // Keep several tabs in step for guests.
  window.addEventListener('storage', function (event) {
    if (event.key !== GUEST_KEY || loggedIn) return;
    ids = readGuest().map(function (item) {
      return item.id;
    });
    changed();
  });

  /* ---------- Hearts on Sense product cards ---------- */

  var HEART =
    '<svg class="jvli-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 20.3s-7.8-4.6-8.8-10a4.8 4.8 0 0 1 8.8-3.2 4.8 4.8 0 0 1 8.8 3.2c-1 5.4-8.8 10-8.8 10Z"/></svg>';

  function decorateSenseCards(scope) {
    scope.querySelectorAll('.card-wrapper').forEach(function (card) {
      if (card.dataset.jvliFavReady) return;
      var link = card.querySelector('a[id^="CardLink-"]');
      var inner = card.querySelector('.card__inner');
      if (!link || !inner) return;
      var numericId = link.id.split('-').pop();
      var handleMatch = (link.getAttribute('href') || '').match(/\/products\/([^/?#]+)/);
      if (!/^\d+$/.test(numericId)) return;
      card.dataset.jvliFavReady = 'true';

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'jvli-fav jvli-fav--sense';
      button.setAttribute('data-jvli-favorite', '');
      button.dataset.productId = 'gid://shopify/Product/' + numericId;
      if (handleMatch) button.dataset.productHandle = decodeURIComponent(handleMatch[1]);
      button.dataset.productTitle = (link.textContent || '').trim();
      button.innerHTML = HEART;
      inner.appendChild(button);
    });
  }

  /* ---------- Favorites page ---------- */

  function productList() {
    if (!loggedIn) {
      return Promise.resolve(
        ids.map(function (id) {
          return { id: id, handle: handles[id] };
        }),
      );
    }
    if (loadedProducts !== undefined) return Promise.resolve(loadedProducts);
    return request('GET', null, '?include=products').then(function (data) {
      ids = data.favorites || ids;
      return data.products;
    });
  }

  function fetchCard(product) {
    if (!product.handle) return Promise.resolve(null);
    var url = (window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/') + 'products/' + encodeURIComponent(product.handle) + '?view=favorites-internal-do-not-use';
    return fetch(url, { credentials: 'same-origin' })
      .then(function (response) {
        return response.ok ? response.text() : null;
      })
      .then(function (html) {
        if (!html) return null;
        var template = document.createElement('template');
        template.innerHTML = html.trim();
        var card = template.content.querySelector('[data-jvli-card]');
        // Guard against a stale handle that now points at another product.
        var heart = card && card.querySelector('[data-jvli-favorite]');
        if (!card || (heart && heart.dataset.productId !== product.id)) return null;
        return card;
      })
      .catch(function () {
        return null;
      });
  }

  function initFavoritesPage(page) {
    if (page.dataset.jvliReady) return;
    page.dataset.jvliReady = 'true';
    var grid = page.querySelector('[data-jvli-favorites-grid]');
    var setState = function (state) {
      page.dataset.state = state;
    };
    setState('loading');
    page.querySelectorAll('[data-jvli-favorites-guest-note]').forEach(function (note) {
      note.hidden = loggedIn;
    });

    ready
      .then(productList)
      .then(function (products) {
        if (products === null || products === undefined) {
          setState('error');
          return;
        }
        if (!products.length) {
          setState('empty');
          return;
        }
        return Promise.all(products.map(fetchCard)).then(function (cards) {
          grid.replaceChildren.apply(
            grid,
            cards.filter(Boolean).map(function (card) {
              var item = document.createElement('div');
              item.className = 'jvli-favorites__item';
              item.dataset.productId = card.querySelector('[data-jvli-favorite]').dataset.productId;
              item.appendChild(card);
              return item;
            }),
          );
          setState(grid.children.length ? 'ready' : 'empty');
          render();
        });
      })
      .catch(function () {
        setState('error');
      });

    // Removing a favorite on this page removes its card.
    document.addEventListener('jvli:favorites:changed', function () {
      grid.querySelectorAll('.jvli-favorites__item').forEach(function (item) {
        if (!has(item.dataset.productId)) item.remove();
      });
      if (page.dataset.state === 'ready' && !grid.children.length) setState('empty');
    });
  }

  /* ---------- Init ---------- */

  function scan(scope) {
    decorateSenseCards(scope);
    scope.querySelectorAll('[data-jvli-favorites-page]').forEach(initFavoritesPage);
    render();
  }

  function start() {
    scan(document);
    load().then(function () {
      readyResolve();
      changed();
    });

    // Sense re-renders product grids (filters, sorting, recommendations).
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        scan(document);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.JvliFavorites = {
    ready: ready,
    has: has,
    toggle: toggle,
    ids: function () {
      return ids.slice();
    },
  };
})();
