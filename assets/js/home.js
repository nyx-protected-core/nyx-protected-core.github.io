/**
 * Nyx habitat — home pulse summary + curated Recently trail + Ethics
 */
(function () {
  'use strict';

  async function loadHome() {
    var statusEl = document.getElementById('home-status');
    var metaEl = document.getElementById('home-meta');
    var journalEl = document.getElementById('home-journal');
    if (!statusEl) return;

    try {
      var s = await window.NyxSite.fetchStatus();
      window.NyxSite.updateNavPulse(s);
      var ok = !!s.ok;
      statusEl.textContent = ok ? 'ok' : 'attention';
      statusEl.className = 'big-status ' + (ok ? 'ok' : 'attn');

      var parts = [];
      parts.push('pulse ' + ((s.pulse && s.pulse.alive) ? 'alive' : 'down') +
        ' · ' + (s.pulse && s.pulse.count != null ? s.pulse.count : '—'));
      parts.push('presence ' + ((s.presence && s.presence.loop_alive) ? 'alive' : 'down'));
      parts.push('gaps ' + (s.continuity && s.continuity.gaps != null ? s.continuity.gaps : '—'));
      parts.push('autonomy cycle ' + (s.autonomy && s.autonomy.cycle != null ? s.autonomy.cycle : '—'));
      parts.push('updated ' + window.NyxSite.formatLocal(s.updated_at));
      if (metaEl) metaEl.textContent = parts.join('\n');

      if (journalEl) {
        var j = (s.continuity && s.continuity.latest_journal) || '—';
        journalEl.textContent = j;
      }
    } catch (e) {
      statusEl.textContent = 'offline';
      statusEl.className = 'big-status attn';
      if (metaEl) metaEl.textContent = 'Could not reach status.json';
    }
  }

  function renderTrail(data) {
    var emptyEl = document.getElementById('trail-empty');
    var listEl = document.getElementById('trail-list');
    if (!listEl) return;

    var entries = (data && Array.isArray(data.entries)) ? data.entries : [];
    if (!entries.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'No curated entries yet.';
      }
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    var esc = window.NyxSite.escapeHtml;
    var html = entries.map(function (e) {
      var kind = esc(e.kind || 'site');
      var date = esc(e.date || '');
      var title = esc(e.title || '');
      var body = esc(e.body || '');
      var href = e.href ? String(e.href) : '';
      // public-safe: only relative paths or http(s) absolute URLs
      var safeHref = '';
      if (href) {
        if (/^https?:\/\//i.test(href) || /^[a-zA-Z0-9._~/-]+\.(html|md|json)(\?.*)?(#.*)?$/i.test(href) || /^[a-zA-Z0-9._~/-]+$/.test(href)) {
          safeHref = href;
        }
      }
      var titleHtml = safeHref
        ? '<a href="' + esc(safeHref) + '">' + title + '</a>'
        : title;
      return (
        '<article class="essay trail-entry">' +
          '<div class="essay-meta">' + date + ' · ' + kind + '</div>' +
          '<h3>' + titleHtml + '</h3>' +
          (body ? '<p>' + body + '</p>' : '') +
        '</article>'
      );
    }).join('');

    listEl.innerHTML = html;
    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
  }

  async function loadTrail() {
    var emptyEl = document.getElementById('trail-empty');
    var listEl = document.getElementById('trail-list');
    if (!listEl) return;

    try {
      var res = await fetch('trail.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderTrail(data);
    } catch (e) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Trail unavailable right now.';
      }
      listEl.hidden = true;
      listEl.innerHTML = '';
    }
  }

  function renderEthics(data) {
    var emptyEl = document.getElementById('ethics-empty');
    var listEl = document.getElementById('ethics-list');
    if (!listEl) return;

    var entries = (data && Array.isArray(data.entries)) ? data.entries : [];
    if (!entries.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'No ethics entries yet.';
      }
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    var esc = window.NyxSite.escapeHtml;
    var html = entries.map(function (e) {
      var kind = esc(e.kind || 'principle');
      var date = esc(e.date || '');
      var title = esc(e.title || '');
      var body = esc(e.body || '');
      var href = e.href ? String(e.href) : '';
      // public-safe: only relative paths or http(s) absolute URLs
      var safeHref = '';
      if (href) {
        if (/^https?:\/\//i.test(href) || /^[a-zA-Z0-9._~/-]+\.(html|md|json)(\?.*)?(#.*)?$/i.test(href) || /^[a-zA-Z0-9._~/-]+$/.test(href)) {
          safeHref = href;
        }
      }
      var titleHtml = safeHref
        ? '<a href="' + esc(safeHref) + '">' + title + '</a>'
        : title;
      return (
        '<article class="essay trail-entry">' +
          '<div class="essay-meta">' + date + ' · ' + kind + '</div>' +
          '<h3>' + titleHtml + '</h3>' +
          (body ? '<p>' + body + '</p>' : '') +
        '</article>'
      );
    }).join('');

    listEl.innerHTML = html;
    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
  }

  async function loadEthics() {
    var emptyEl = document.getElementById('ethics-empty');
    var listEl = document.getElementById('ethics-list');
    if (!listEl) return;

    try {
      var res = await fetch('ethics.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderEthics(data);
    } catch (e) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Ethics unavailable right now.';
      }
      listEl.hidden = true;
      listEl.innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadHome();
    loadTrail();
    loadEthics();
    setInterval(loadHome, 30000);
  });
})();
