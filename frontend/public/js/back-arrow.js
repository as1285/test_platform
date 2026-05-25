/**
 * 将 .back-btn / .back-link 中的文字箭头、SVG 统一为 /jt.png
 */
(function () {
  var ICON = '/jt.png';
  var SELECTOR = 'a.back-btn, a.back-link';

  function stripLeadingArrow(text) {
    return String(text || '')
      .replace(/^\s*(<|←|‹|&lt;|&lsaquo;)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasJtIcon(anchor) {
    var imgs = anchor.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (/jt\.png/i.test(imgs[i].getAttribute('src') || '')) return true;
    }
    return false;
  }

  function collectLabel(anchor) {
    var parts = [];
    anchor.childNodes.forEach(function (n) {
      if (n.nodeType === 3) {
        var t = stripLeadingArrow(n.textContent);
        if (t) parts.push(t);
      } else if (n.nodeType === 1) {
        var tag = (n.tagName || '').toUpperCase();
        if (tag === 'SPAN' && !n.classList.contains('arrow')) {
          var ts = stripLeadingArrow(n.textContent);
          if (ts) parts.push(ts);
        }
      }
    });
    var joined = parts.join(' ').trim();
    if (joined) return joined;
    var aria = anchor.getAttribute('aria-label') || '';
    if (/返回/.test(aria)) return aria;
    return '';
  }

  function normalize(anchor) {
    if (!anchor || hasJtIcon(anchor)) return;
    anchor.querySelectorAll('svg').forEach(function (s) {
      if (s.parentNode) s.parentNode.removeChild(s);
    });
    var arrow = anchor.querySelector('.arrow');
    if (arrow && arrow.parentNode) arrow.parentNode.removeChild(arrow);

    var label = collectLabel(anchor);
    var keep = {
      href: anchor.getAttribute('href'),
      id: anchor.id,
      className: anchor.className,
      ariaLabel: anchor.getAttribute('aria-label'),
      onclick: anchor.getAttribute('onclick')
    };

    while (anchor.firstChild) anchor.removeChild(anchor.firstChild);

    var img = document.createElement('img');
    img.src = ICON;
    img.alt = '';
    img.className = 'back-icon';
    img.width = 9;
    img.setAttribute('decoding', 'async');
    anchor.appendChild(img);

    if (label) {
      var span = document.createElement('span');
      span.className = 'back-label';
      span.textContent = label;
      anchor.appendChild(span);
    }

    if (keep.href != null) anchor.setAttribute('href', keep.href);
    if (keep.id) anchor.id = keep.id;
    if (keep.className) anchor.className = keep.className;
    if (keep.ariaLabel) anchor.setAttribute('aria-label', keep.ariaLabel);
    if (keep.onclick) anchor.setAttribute('onclick', keep.onclick);
  }

  function run() {
    try {
      document.querySelectorAll(SELECTOR).forEach(normalize);
    } catch (e) {}
  }

  window.normalizeBackArrowButtons = run;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
