/* JVLI FAQs (sections/jvli-faq): smooth open/close animations for nested
   <details> category and question accordions while keeping single-open
   behaviour per group. Falls back cleanly to native <details> without JS. */
(function () {
  if (window.JvliFaq) return;
  window.JvliFaq = true;

  var EASE = 'cubic-bezier(0.22, 0.8, 0.24, 1)';
  var DURATION_OPEN = 320;
  var DURATION_CLOSE = 260;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function panelFor(details) {
    return details.querySelector(':scope > .jvli-faq__list, :scope > .jvli-faq__answer');
  }

  function expand(details) {
    var panel = panelFor(details);
    if (!panel || reducedMotion() || typeof panel.animate !== 'function') {
      details.open = true;
      return;
    }

    var wasAnimating = !!details._jvliAnim;
    var csBefore = getComputedStyle(panel);
    var startFrame = wasAnimating
      ? {
          height: csBefore.height,
          paddingTop: csBefore.paddingTop,
          paddingBottom: csBefore.paddingBottom,
          opacity: Number(csBefore.opacity)
        }
      : { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };

    if (details._jvliAnim) details._jvliAnim.cancel();

    details.classList.remove('is-closing');
    details.open = true;
    details.classList.add('is-animating');

    var csEnd = getComputedStyle(panel);
    var endFrame = {
      height: panel.scrollHeight + 'px',
      paddingTop: csEnd.paddingTop,
      paddingBottom: csEnd.paddingBottom,
      opacity: 1
    };

    var anim = panel.animate([startFrame, endFrame], { duration: DURATION_OPEN, easing: EASE });
    details._jvliAnim = anim;

    anim.onfinish = function () {
      details.classList.remove('is-animating');
      details._jvliAnim = null;
    };
    anim.oncancel = function () {
      details.classList.remove('is-animating');
      details._jvliAnim = null;
    };
  }

  function collapse(details) {
    if (!details.open) return;
    var panel = panelFor(details);
    if (!panel || reducedMotion() || typeof panel.animate !== 'function') {
      details.open = false;
      return;
    }

    var cs = getComputedStyle(panel);
    var startFrame = {
      height: panel.getBoundingClientRect().height + 'px',
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      opacity: Number(cs.opacity)
    };
    if (details._jvliAnim) details._jvliAnim.cancel();

    details.classList.add('is-animating', 'is-closing');
    var anim = panel.animate(
      [startFrame, { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }],
      { duration: DURATION_CLOSE, easing: EASE }
    );
    details._jvliAnim = anim;

    anim.onfinish = function () {
      details.open = false;
      details.classList.remove('is-animating', 'is-closing');
      details._jvliAnim = null;
    };
    anim.oncancel = function () {
      details.classList.remove('is-animating', 'is-closing');
      details._jvliAnim = null;
    };
  }

  function initFaq(scope) {
    scope.querySelectorAll('.jvli-faq').forEach(function (section) {
      if (section.dataset.jvliReady) return;
      section.dataset.jvliReady = 'true';

      var allDetails = Array.prototype.slice.call(section.querySelectorAll('details'));
      allDetails.forEach(function (details) {
        var groupName = details.getAttribute('name');
        if (groupName) {
          details.dataset.jvliFaqGroup = groupName;
          // Let JS coordinate sibling closing so the collapse animates before [open] is removed.
          details.removeAttribute('name');
        }

        var summary = details.querySelector(':scope > summary');
        if (!summary) return;

        summary.addEventListener('click', function (event) {
          event.preventDefault();
          var isClosing = details.classList.contains('is-closing');
          if (details.open && !isClosing) {
            collapse(details);
            return;
          }

          var group = details.dataset.jvliFaqGroup;
          if (group) {
            allDetails.forEach(function (other) {
              if (other !== details && other.dataset.jvliFaqGroup === group && other.open && !other.classList.contains('is-closing')) {
                collapse(other);
              }
            });
          }
          expand(details);
        });
      });
    });
  }

  function start() {
    initFaq(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  document.addEventListener('shopify:section:load', function (event) {
    initFaq(event.target);
  });
})();
