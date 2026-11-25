/* JVLI Postcards from you (sections/jvli-postcards).
   One active postcard with its neighbours peeking out either side. Arrows,
   dots, swipe, the arrow keys, or a tap on a side card change it. */
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

  function start() {
    initPostcards(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  document.addEventListener('shopify:section:load', function (event) {
    initPostcards(event.target);
  });
})();
