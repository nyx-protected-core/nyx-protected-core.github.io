/**
 * Nyx habitat — home pulse summary
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

  document.addEventListener('DOMContentLoaded', function () {
    loadHome();
    setInterval(loadHome, 30000);
  });
})();
