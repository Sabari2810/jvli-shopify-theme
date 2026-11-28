/* JVLI Postcards from you (sections/jvli-postcards).
   One active postcard with its neighbours peeking out either side. Arrows,
   dots, swipe, the arrow keys, or a tap on a side card change it.
   Long reviews are trimmed (CSS line clamp); "Read more" shows only on the
   ones actually cut off and opens the whole review in a postcard pop-up. */
(function () {
  if (window.JvliPostcards) return;
  window.JvliPostcards = true;

  function initPostcards(scope) {
    scope.querySelectorAll('[data-jvli-postcards]').forEach(function (section) {
      if (section.dataset.jvliReady) return;
      section.dataset.jvliReady = 'true';

      var cards = Array.prototype.slice.call(section.querySelectorAll('[data-jvli-postcard]'));
      var dots = section.querySelectorAll('[data-jvli-postcards-dot]');
      var stage = section.querySelector('.jvli-postcards__stage');
      var count = cards.length;
      var index = 0;
      initReadMore(section, cards);
      if (count < 2) return;

      function show(next) {
        index = (next + count) % count;
        var prev = (index - 1 + count) % count;
        var after = (index + 1) % count;
        cards.forEach(function (card, i) {
          var role = '';
          if (i === index) role = 'is-active';
          else if (count === 2) role = index === 0 ? 'is-next' : 'is-prev';
          else if (i === prev) role = 'is-prev';
          else if (i === after) role = 'is-next';
          card.classList.remove('is-active', 'is-prev', 'is-next');
          if (role) card.classList.add(role);
          card.setAttribute('aria-hidden', i === index ? 'false' : 'true');
        });
        dots.forEach(function (dot, i) {
          if (i === index) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
      }

      section.querySelector('[data-jvli-postcards-prev]').addEventListener('click', function () {
        show(index - 1);
      });
      section.querySelector('[data-jvli-postcards-next]').addEventListener('click', function () {
        show(index + 1);
      });
      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          show(Number(dot.dataset.jvliPostcardsDot));
        });
      });
      cards.forEach(function (card, i) {
        card.addEventListener('click', function () {
          if (card.classList.contains('is-prev') || card.classList.contains('is-next')) show(i);
        });
      });
      section.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowLeft') show(index - 1);
        else if (event.key === 'ArrowRight') show(index + 1);
      });

      var startX = null;
      var startY = 0;
      stage.addEventListener('pointerdown', function (event) {
        startX = event.clientX;
        startY = event.clientY;
      });
      stage.addEventListener('pointerup', function (event) {
        if (startX === null) return;
        var dx = event.clientX - startX;
        var dy = event.clientY - startY;
        startX = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
      });
      stage.addEventListener('pointercancel', function () {
        startX = null;
      });

      // Theme editor: selecting a review block brings it to the front.
      section.addEventListener('shopify:block:select', function (event) {
        var i = cards.indexOf(event.target);
        if (i > -1) show(i);
      });

      show(0);
    });
  }

  /* ---------- Read more ---------- */

  function initReadMore(section, cards) {
    var modal = section.querySelector('[data-jvli-postcards-modal]');
    if (!modal) return;
    // Out of the section (which clips its overflow) so it covers the page.
    document.body.appendChild(modal);
    var body = modal.querySelector('[data-jvli-postcards-modal-body]');
    var closeButton = modal.querySelector('.jvli-pc-modal__close');
    var opener = null;
    var pushed = false;

    // Show "Read more" only where the clamp actually hides text.
    function measure() {
      cards.forEach(function (card) {
        var quote = card.querySelector('[data-jvli-postcard-quote]');
        var more = card.querySelector('[data-jvli-postcard-more]');
        if (quote && more) more.hidden = quote.scrollHeight <= quote.clientHeight + 2;
      });
    }

    function open(card, button) {
      var quote = card.querySelector('[data-jvli-postcard-quote]');
      var from = card.querySelector('.jvli-postcard__from');
      var stamp = card.querySelector('.jvli-postcard__stamp');
      body.innerHTML = '';
      if (stamp) body.appendChild(stamp.cloneNode(true));
      var full = document.createElement('blockquote');
      full.className = 'jvli-pc-modal__quote';
      full.innerHTML = quote.innerHTML;
      body.appendChild(full);
      if (from) body.appendChild(from.cloneNode(true));
      opener = button;
      modal.hidden = false;
      document.documentElement.classList.add('jvli-pc-modal-open');
      // Next frame, so the opening transition runs.
      requestAnimationFrame(function () {
        modal.classList.add('is-open');
      });
      body.scrollTop = 0;
      closeButton.focus({ preventScroll: true });
      // The phone's back gesture closes the review instead of leaving the page.
      try {
        history.pushState({ jvliReview: true }, '');
        pushed = true;
      } catch (error) {
        pushed = false;
      }
    }

    function close(fromHistory) {
      if (modal.hidden) return;
      modal.classList.remove('is-open');
      document.documentElement.classList.remove('jvli-pc-modal-open');
      setTimeout(function () {
        if (!modal.classList.contains('is-open')) modal.hidden = true;
      }, 250);
      if (pushed && !fromHistory) history.back();
      pushed = false;
      if (opener) opener.focus({ preventScroll: true });
    }

    cards.forEach(function (card) {
      var more = card.querySelector('[data-jvli-postcard-more]');
      if (!more) return;
      more.addEventListener('click', function (event) {
        // On a side card the tap only brings that card to the front.
        if (!card.classList.contains('is-active')) return;
        event.stopPropagation();
        open(card, more);
      });
    });

    modal.querySelectorAll('[data-jvli-postcards-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        close(false);
      });
    });

    modal.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      } else if (event.key === 'Tab') {
        // Keep focus inside: the close button and the scrolling review.
        event.preventDefault();
        (document.activeElement === closeButton ? body : closeButton).focus();
      }
    });

    window.addEventListener('popstate', function () {
      if (pushed) {
        pushed = false;
        close(true);
      }
    });

    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
  }

  function start() {
    initPostcards(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  document.addEventListener('shopify:section:load', function (event) {
    initPostcards(event.target);
  });
})();
