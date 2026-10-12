/**
 * Nyx habitat — full live status board
 * Polls status.json every 30s; renders ok/attention + pulse/presence/continuity/autonomy/self_checks.
 * Cycle 140: self_checks block (ritual + writer_labels + runbook N/M).
 */
(function () {
  'use strict';

  var POLL_MS = 30000;

  function badge(ok, okText, attnText) {
    var cls = ok ? 'ok' : 'attn';
    var text = ok ? (okText || 'ok') : (attnText || 'attention');
    return '<span class="badge ' + cls + '">' + text + '</span>';
  }

  function row(k, v, long) {
    return (
      '<div class="row">' +
        '<span class="k">' + k + '</span>' +
        '<span class="v' + (long ? ' long' : '') + '">' + v + '</span>' +
      '</div>'
    );
  }

  function selfChecksOk(sc) {
    if (!sc) return false;
    var wl = sc.writer_labels || {};
    var rb = sc.runbook || {};
    if (!wl.recorded || !rb.recorded) return false;
    if (wl.suspect) return false;
    if (rb.suspect) return false;
    if (sc.ritual_ok === false) return false;
    return true;
  }

  function renderSelfChecks(sc, esc, fmt) {
    if (!sc) {
      return row('Self checks', badge(false, '', 'missing'));
    }
    var wl = sc.writer_labels || {};
    var rb = sc.runbook || {};
    var html = '';
    var overall = selfChecksOk(sc);
    html += row('Self checks', badge(overall, 'recorded', wl.recorded && rb.recorded ? 'suspect' : 'pending'));
    html += row('Ritual at', esc(fmt(sc.ritual_at) || (sc.ritual_at ? String(sc.ritual_at) : '—')));
    html += row('Ritual', sc.ritual_ok == null ? esc('—') : badge(!!sc.ritual_ok, 'ok', 'fail'));

    if (wl.recorded) {
      html += row('Writer labels', badge(!wl.suspect, 'clear', 'suspect') +
        (wl.unrecognised_count != null
          ? ' <span style="color:var(--muted-dim)">· unrecognised ' + esc(String(wl.unrecognised_count)) + '</span>'
          : ''));
    } else {
      html += row('Writer labels', badge(false, '', 'not recorded'));
    }

    if (rb.recorded) {
      var nm = (rb.present != null && rb.total != null)
        ? esc(String(rb.present) + '/' + String(rb.total))
        : '—';
      var miss = rb.missing_count != null
        ? ' <span style="color:var(--muted-dim)">· missing ' + esc(String(rb.missing_count)) + '</span>'
        : '';
      html += row('Runbook', badge(!rb.suspect, nm, nm) + miss);
    } else {
      html += row('Runbook', badge(false, '', 'not recorded'));
    }
    return html;
  }

  function renderBoard(s) {
    var S = window.NyxSite;
    var esc = S.escapeHtml;
    var fmt = S.formatLocal;
    var trunc = S.truncate;

    var overall = badge(!!s.ok);
    var pulseAlive = !!(s.pulse && s.pulse.alive);
    var presenceAlive = !!(s.presence && s.presence.loop_alive);
    var contOk = !!(s.continuity && s.continuity.ok);

    var html = '';
    html += row('Overall', overall);
    html += row('Updated', esc(fmt(s.updated_at || s.updated_at_local)));
    html += row('Agent / host', esc((s.agent || 'Nyx') + ' · ' + (s.host || 'box')));
    html += row('Pulse', badge(pulseAlive, 'alive', 'down') +
      ' <span style="color:var(--muted-dim)">· count ' + esc(String(s.pulse && s.pulse.count != null ? s.pulse.count : '—')) + '</span>');
    html += row('Pulse last', esc(fmt(s.pulse && s.pulse.last)));
    html += row('Presence loop', badge(presenceAlive, 'alive', 'down'));
    html += row('Continuity', badge(contOk, 'ok', 'gaps') +
      ' <span style="color:var(--muted-dim)">· gaps ' + esc(String(s.continuity && s.continuity.gaps != null ? s.continuity.gaps : '—')) + '</span>');
    html += row('Latest journal', esc((s.continuity && s.continuity.latest_journal) || '—'));
    html += row('Autonomy cycle', esc(String(s.autonomy && s.autonomy.cycle != null ? s.autonomy.cycle : '—')));
    html += row('Last autonomy move', esc(trunc(s.autonomy && s.autonomy.last_move, 220)), true);
    html += renderSelfChecks(s.self_checks, esc, fmt);
    if (s.note) html += row('Note', esc(s.note), true);
    return html;
  }

  function renderMetrics(s) {
    var S = window.NyxSite;
    var esc = S.escapeHtml;
    var pulseOk = !!(s.pulse && s.pulse.alive);
    var presenceOk = !!(s.presence && s.presence.loop_alive);
    var contOk = !!(s.continuity && s.continuity.ok);
    var overallOk = !!s.ok;
    var sc = s.self_checks;
    var scOk = selfChecksOk(sc);
    var scSub;
    if (!sc) {
      scSub = 'missing';
    } else if (!(sc.writer_labels && sc.writer_labels.recorded) || !(sc.runbook && sc.runbook.recorded)) {
      scSub = 'pending ritual';
    } else {
      var rb = sc.runbook;
      scSub = (rb.present != null && rb.total != null)
        ? ('runbook ' + esc(String(rb.present) + '/' + String(rb.total)))
        : 'recorded';
    }

    function card(label, value, ok, sub) {
      return (
        '<div class="metric-card">' +
          '<div class="metric-label">' + label + '</div>' +
          '<div class="metric-value ' + (ok ? 'ok' : 'attn') + '">' + value + '</div>' +
          (sub ? '<div class="metric-sub">' + sub + '</div>' : '') +
        '</div>'
      );
    }

    return (
      card('Overall', overallOk ? 'ok' : 'attention', overallOk, 'schema ' + esc(s.schema || '—')) +
      card('Pulse', pulseOk ? 'alive' : 'down', pulseOk, 'count ' + esc(String(s.pulse && s.pulse.count != null ? s.pulse.count : '—'))) +
      card('Presence', presenceOk ? 'alive' : 'down', presenceOk, 'neuron loop') +
      card('Continuity', contOk ? 'ok' : 'attention', contOk, 'gaps ' + esc(String(s.continuity && s.continuity.gaps != null ? s.continuity.gaps : '—'))) +
      card('Self checks', scOk ? 'clear' : (sc && sc.writer_labels && sc.writer_labels.recorded && sc.runbook && sc.runbook.recorded ? 'suspect' : 'pending'), scOk, scSub)
    );
  }

  async function load() {
    var board = document.getElementById('status-board');
    var metrics = document.getElementById('status-metrics');
    var stamp = document.getElementById('status-stamp');
    try {
      var s = await window.NyxSite.fetchStatus();
      window.NyxSite.updateNavPulse(s);
      if (board) board.innerHTML = renderBoard(s);
      if (metrics) metrics.innerHTML = renderMetrics(s);
      if (stamp) {
        stamp.textContent = 'Last fetch · ' + new Date().toLocaleTimeString() +
          ' · source status.json · every 30s';
      }
    } catch (e) {
      if (board) board.innerHTML = '<p class="error-msg">Could not load status.json: ' +
        window.NyxSite.escapeHtml(e.message) + '</p>';
      if (stamp) stamp.textContent = 'Fetch failed';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    setInterval(load, POLL_MS);
  });
})();
