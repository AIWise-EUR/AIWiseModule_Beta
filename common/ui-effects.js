(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;
  if (!body) return;
  var transitionTargets = Array.prototype.slice.call(document.querySelectorAll('body > section'));
  if (!transitionTargets.length) {
    transitionTargets = [body];
  }

  transitionTargets.forEach(function (target) {
    target.classList.add('ui-transition-target');
  });

  if (!reduceMotion) {
    transitionTargets.forEach(function (target) {
      target.classList.add('ui-entering');
    });
  }

  function mountPage() {
    if (reduceMotion) {
      transitionTargets.forEach(function (target) {
        target.classList.add('ui-mounted');
      });
      return;
    }
    window.requestAnimationFrame(function () {
      transitionTargets.forEach(function (target) {
        target.classList.remove('ui-entering');
        target.classList.add('ui-mounted');
      });
    });
  }

  function initDetailsMotion() {
    // Keep native details/summary toggle behavior for maximum stability.
  }

  function shouldHandleLink(link, event) {
    if (!link || event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target.toLowerCase() === '_blank') return false;
    if (link.hasAttribute('download')) return false;

    var href = link.getAttribute('href') || '';
    if (!href || href[0] === '#') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

    return true;
  }

  function runLeaveThenNavigate(url) {
    if (reduceMotion) {
      window.location.href = url;
      return;
    }
    transitionTargets.forEach(function (target) {
      target.classList.remove('ui-entering');
      target.classList.add('ui-leaving');
    });
    window.setTimeout(function () {
      window.location.href = url;
    }, 380);
  }

  // Shared helper so scripts doing programmatic navigation (e.g. the
  // diagnostic questionnaire's "Go to step" buttons) can opt into the
  // same leave animation that anchor clicks get.
  window.uiNavigate = runLeaveThenNavigate;

  if (!reduceMotion) {
    document.addEventListener('click', function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!shouldHandleLink(link, event)) return;

      event.preventDefault();
      runLeaveThenNavigate(link.href);
    });
  }

  window.addEventListener('pageshow', function () {
    transitionTargets.forEach(function (target) {
      target.classList.remove('ui-leaving');
    });
    if (!reduceMotion) {
      transitionTargets.forEach(function (target) {
        target.classList.add('ui-entering');
      });
    }
    mountPage();
  });

  initDetailsMotion();
  mountPage();
})();
