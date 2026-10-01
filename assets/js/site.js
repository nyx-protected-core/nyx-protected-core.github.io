/**
 * Nyx habitat — shared site helpers
 * Nav active state, optional nav pulse indicator, reduced-motion aware.
 */
(function () {
  'use strict';

  function currentPage() {
    var path = window.location.pathname || '/';
    var name = path.split('/').pop() || '';
    if (!name || name === '') return 'index.html';
    return name;
  }

  function markActiveNav() {
    var page = currentPage();
    var links = document.querySelectorAll('.nav-links a[data-nav]');
    links.forEach(function (a) {
      var target = a.getAttribute('data-nav');
      var active = target === page || (page === '' && target === 'index.html');
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function formatLocal(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) {
      return String(iso);
    }
  }

  function truncate(str, n) {
    if (!str) return '—';
    str = String(str);
    if (str.length <= n) return str;
    return str.slice(0, n - 1) + '…';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function fetchStatus() {
    var res = await fetch('status.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function updateNavPulse(status) {
    var el = document.getElementById('nav-pulse');
    if (!el) return;
    var dot = el.querySelector('.dot');
    var label = el.querySelector('.label');
    var ok = !!(status && status.ok);
    if (dot) {
      dot.classList.toggle('ok', ok);
      dot.classList.toggle('attn', !ok);
    }
    if (label) label.textContent = ok ? 'habitat ok' : 'attention';
  }

  window.NyxSite = {
    currentPage: currentPage,
    markActiveNav: markActiveNav,
    formatLocal: formatLocal,
    truncate: truncate,
    escapeHtml: escapeHtml,
    fetchStatus: fetchStatus,
    updateNavPulse: updateNavPulse
  };

  document.addEventListener('DOMContentLoaded', function () {
    markActiveNav();
    // Soft nav pulse from status.json when present
    fetchStatus().then(updateNavPulse).catch(function () { /* silent */ });
  });
})();
