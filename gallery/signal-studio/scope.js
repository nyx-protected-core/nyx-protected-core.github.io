// Signal Studio: Fourier synthesis -> first-order RC low-pass -> oscilloscope.
// The filter is applied exactly, per harmonic: H(f) = 1 / (1 + j f/fc).
// So CH2 is the true steady-state output, not an approximation.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const cv = $("screen"), ctx = cv.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TB = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]; // ms per division
  const DIVX = 10, DIVY = 8, VDIV = 1, M = 1000, CAP_F = 100e-9;
  const logMap = v => 20 * Math.pow(10, 3 * v / 1000);   // slider 0..1000 -> 20 Hz..20 kHz
  const state = { running: !reduced, t0: 0, mode: "yt", lastNoise: [] };
  let W = 0, H = 0, dpr = 1;

  const fmtHz = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2) + " kHz" : f.toFixed(f < 100 ? 1 : 0) + " Hz";
  const fmtV = v => v.toFixed(2) + " V";
  const fmtT = ms => ms >= 1 ? ms + " ms" : (ms * 1000) + " µs";
  const fmtR = r => r >= 1e6 ? (r / 1e6).toFixed(2) + " MΩ" : r >= 1e3 ? (r / 1e3).toFixed(2) + " kΩ" : r.toFixed(0) + " Ω";

  function params() {
    return {
      wave: $("wave").value, n: +$("n").value, f: logMap(+$("f").value), a: +$("a").value,
      nz: +$("nz").value, fc: logMap(+$("fc").value), tb: TB[+$("tb").value], vol: +$("vol").value,
      trig: $("trig").checked
    };
  }

  // Terms of x(t) = sum amp * sin(2*pi*k*f*t + ph). k = 0 is DC.
  function terms(wave, n) {
    const t = [];
    if (wave === "sine") return [{ k: 1, amp: 1, ph: 0 }];
    for (let k = 1; k <= n; k++) {
      if (wave === "square" && k % 2) t.push({ k, amp: 4 / (Math.PI * k), ph: 0 });
      if (wave === "triangle" && k % 2) t.push({ k, amp: 8 / (Math.PI * Math.PI * k * k) * ((k - 1) / 2 % 2 ? -1 : 1), ph: 0 });
      if (wave === "saw") t.push({ k, amp: 2 / (Math.PI * k) * (k % 2 ? 1 : -1), ph: 0 });
      if (wave === "pulse") { const c = 4 / (Math.PI * k) * Math.sin(Math.PI * k * 0.25); if (Math.abs(c) > 1e-12) t.push({ k, amp: c, ph: Math.PI / 2 }); }
    }
    if (wave === "pulse") t.unshift({ k: 0, amp: -0.5, ph: Math.PI / 2 });
    return t;
  }
  const filt = (k, f, fc) => { if (k === 0) return { g: 1, p: 0 }; const r = k * f / fc; return { g: 1 / Math.hypot(1, r), p: -Math.atan(r) }; };

  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function synth(P) {
    const T = DIVX * P.tb / 1000, dt = T / M, w = 2 * Math.PI * P.f;
    const tl = terms(P.wave, P.n);
    const out = tl.map(t => { const h = filt(t.k, P.f, P.fc); return { k: t.k, amp: t.amp * h.g, ph: t.ph + h.p }; });
    const c1 = new Float32Array(M), c2 = new Float32Array(M);
    // one-pole IIR for the noise only (the clean signal is filtered exactly above)
    const rc = 1 / (2 * Math.PI * P.fc), alpha = dt / (rc + dt);
    let y = 0;
    for (let i = 0; i < 300; i++) y += alpha * (gauss() * P.nz - y);
    for (let i = 0; i < M; i++) {
      const t = state.t0 + i * dt;
      let s1 = 0, s2 = 0;
      for (const q of tl) s1 += q.amp * Math.sin(w * q.k * t + q.ph);
      for (const q of out) s2 += q.amp * Math.sin(w * q.k * t + q.ph);
      const nzs = P.nz ? gauss() * P.nz : 0;
      y += alpha * (nzs - y);
      c1[i] = P.a * s1 + nzs; c2[i] = P.a * s2 + y;
    }
    return { c1, c2, tl, out, T, dt };
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr);
    ctx.fillStyle = "#030803"; ctx.fillRect(0, 0, W, H);
    draw(true);
  }

  function grid(labelsX, labelsY) {
    ctx.lineWidth = 1 * dpr; ctx.strokeStyle = "#163016";
    ctx.beginPath();
    for (let i = 1; i < DIVX; i++) { const x = Math.round(i * W / DIVX) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let j = 1; j < DIVY; j++) { const y = Math.round(j * H / DIVY) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.strokeStyle = "#245024"; ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    for (let i = 0; i <= DIVX * 5; i++) { const x = i * W / (DIVX * 5); ctx.moveTo(x, H / 2 - 4 * dpr); ctx.lineTo(x, H / 2 + 4 * dpr); }
    for (let j = 0; j <= DIVY * 5; j++) { const y = j * H / (DIVY * 5); ctx.moveTo(W / 2 - 4 * dpr, y); ctx.lineTo(W / 2 + 4 * dpr, y); }
    ctx.stroke();
    ctx.fillStyle = "#4f8f4f"; ctx.font = `${11 * dpr}px ui-monospace,monospace`;
    if (labelsX) labelsX.forEach(([x, s]) => ctx.fillText(s, x + 4 * dpr, H - 6 * dpr));
    if (labelsY) labelsY.forEach(([y, s]) => ctx.fillText(s, 4 * dpr, y - 4 * dpr));
  }

  function trace(xs, ys, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr; ctx.lineJoin = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 8 * dpr;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) { const x = xs[i], y = Math.max(-2, Math.min(H + 2, ys[i])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }

  function draw(full) {
    const P = params(), S = synth(P);
    ctx.fillStyle = state.running && !full ? "rgba(3,8,3,0.38)" : "#030803";
    ctx.fillRect(0, 0, W, H);
    const vy = v => H / 2 - v / VDIV * (H / DIVY);
    if (state.mode === "yt") {
      grid([[0, `${fmtT(P.tb)}/div`]], [[18 * dpr, "1 V/div"]]);
      const xs = Array.from({ length: M }, (_, i) => i / (M - 1) * W);
      trace(xs, Array.from(S.c1, vy), "#89ff7a");
      trace(xs, Array.from(S.c2, vy), "#ffb547");
    } else if (state.mode === "xy") {
      grid([[0, "X: CH1 1 V/div"]], [[18 * dpr, "Y: CH2 1 V/div"]]);
      const vx = v => W / 2 + v / VDIV * (W / DIVX);
      trace(Array.from(S.c1, vx), Array.from(S.c2, vy), "#c6ff7a");
    } else {
      spectrum(P, S);
    }
    const now = performance.now();
    if (full || now - lastMeas > 250) { lastMeas = now; measure(P, S); }
  }
  let lastMeas = 0;

  function spectrum(P, S) {
    const fmin = 10, fmax = 200000, dbMin = -60, dbMax = 12;
    const fx = f => Math.log10(f / fmin) / Math.log10(fmax / fmin) * W;
    const dy = db => (dbMax - db) / (dbMax - dbMin) * H;
    ctx.lineWidth = 1 * dpr; ctx.strokeStyle = "#163016"; ctx.beginPath();
    const decades = [10, 100, 1000, 10000, 100000];
    for (const d of decades) for (let m = 1; m < 10; m++) { const x = Math.round(fx(d * m)) + 0.5; if (x > W) break; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let db = dbMax; db >= dbMin; db -= 12) { const y = Math.round(dy(db)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.fillStyle = "#4f8f4f"; ctx.font = `${11 * dpr}px ui-monospace,monospace`;
    decades.forEach(d => ctx.fillText(fmtHz(d), fx(d) + 3 * dpr, H - 6 * dpr));
    for (let db = 0; db > dbMin; db -= 12) ctx.fillText(db + " dB", 4 * dpr, dy(db) - 3 * dpr);
    // filter response
    ctx.save(); ctx.setLineDash([6 * dpr, 6 * dpr]); ctx.strokeStyle = "#7a6a40"; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const f = fmin * Math.pow(fmax / fmin, i / 300); const g = 20 * Math.log10(1 / Math.hypot(1, f / P.fc)); i ? ctx.lineTo(fx(f), dy(g)) : ctx.moveTo(fx(f), dy(g)); }
    ctx.stroke(); ctx.restore();
    const xc = fx(P.fc); ctx.fillStyle = "#ffb547"; ctx.fillText("fc −3 dB", xc + 4 * dpr, dy(-3) - 6 * dpr);
    ctx.beginPath(); ctx.arc(xc, dy(-3.01), 3 * dpr, 0, 7); ctx.fill();
    const bar = (list, color, off) => {
      ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6 * dpr; ctx.lineWidth = 3 * dpr;
      for (const q of list) {
        if (q.k === 0) continue;
        const f = q.k * P.f; if (f > fmax) continue;
        const db = 20 * Math.log10(Math.abs(q.amp * P.a) / Math.SQRT2 + 1e-12); // dBV rms
        const x = fx(f) + off * dpr, y = dy(Math.max(dbMin, db));
        ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 2.5 * dpr, 0, 7); ctx.fill();
      }
      ctx.restore();
    };
    bar(S.tl, "#89ff7a", -2);
    bar(S.out, "#ffb547", 2);
  }

  function stats(a) {
    let mn = Infinity, mx = -Infinity, ss = 0;
    for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; ss += v * v; }
    return { pp: mx - mn, rms: Math.sqrt(ss / a.length) };
  }
  function measure(P, S) {
    const s1 = stats(S.c1), s2 = stats(S.c2), h = filt(1, P.f, P.fc);
    const R = 1 / (2 * Math.PI * P.fc * CAP_F);
    const top = S.tl.reduce((m, q) => Math.max(m, q.k), 1) * P.f;
    const nyq = M / S.T / 2;
    const items = [
      ["CH1 Vpp", fmtV(s1.pp), "c1"], ["CH1 Vrms", fmtV(s1.rms), "c1"], ["Frequency", fmtHz(P.f), "c1"],
      ["CH2 Vpp", fmtV(s2.pp), "c2"], ["CH2 Vrms", fmtV(s2.rms), "c2"],
      ["Gain @ f", (20 * Math.log10(h.g)).toFixed(1) + " dB", "c2"], ["Phase @ f", (h.p * 180 / Math.PI).toFixed(1) + "°", "c2"],
      ["Highest harmonic", fmtHz(top), ""]
    ];
    $("meas").innerHTML = items.map(([k, v, c]) => `<div><dt>${k}</dt><dd class="${c}">${v}</dd></div>`).join("");
    $("rc").innerHTML = `f<sub>c</sub> = <b>${fmtHz(P.fc)}</b>. With C = 100 nF that is R = <b>${fmtR(R)}</b>, time constant τ = RC = <b>${(R * CAP_F * 1000).toFixed(3)} ms</b>.`;
    $("explain").textContent = explain(P, top, nyq);
  }

  function explain(P, top, nyq) {
    const r = P.f / P.fc;
    const wave = {
      sine: "A sine is a single pure frequency. It's the only wave the filter can't change in shape, only in size and timing.",
      square: `A square wave is odd harmonics (1, 3, 5, …) at 1/k strength. You're adding harmonics up to number ${P.n}. Watch the ripple at each edge. That's the Gibbs effect: more harmonics make it narrower, but it never goes away.`,
      triangle: `A triangle uses the same odd harmonics as a square but at 1/k², so they fade fast. Just a few already look almost perfect.`,
      saw: `A sawtooth uses every harmonic at 1/k. That's why it sounds bright and buzzy. You're adding up to number ${P.n}.`,
      pulse: "A 25% pulse is high a quarter of the time. Its harmonics follow a sin(x)/x shape, so every 4th one is missing. Check the Spectrum view."
    }[P.wave];
    const mode = { yt: "", xy: " In XY mode CH1 drives the beam sideways and CH2 drives it up and down. A sine makes an ellipse, and its tilt and width show the filter's phase shift.", fft: " The spectrum shows each harmonic as a bar. Green is before the filter and amber is after. The dashed line is the filter's response, falling 20 dB per decade above fc." }[state.mode];
    const filter = r < 0.3 ? " The cutoff is well above the signal, so CH2 follows CH1 closely." : r > 3 ? " The cutoff is well below the signal, so the RC acts like an integrator: squares turn into triangles, and everything gets smaller and lags by almost 90°." : " The cutoff is near the signal, so the higher harmonics get cut and the edges round off.";
    const alias = top > nyq ? ` Note: the screen draws ${M} points per sweep (${fmtHz(nyq * 2).replace("Hz", "S/s")}), so harmonics above ${fmtHz(nyq)} alias on screen. Real scopes have the same problem. Use a faster timebase.` : "";
    return wave + filter + mode + alias;
  }

  // ---- animation ----
  let last = 0;
  function frame(ts) {
    if (!state.running) return;
    const P = params();
    if (!P.trig) state.t0 += (ts - last) / 1000 * 0.0007 * (P.tb / 0.5) * 0.37;
    last = ts;
    draw(false);
    requestAnimationFrame(frame);
  }
  const runBtn = $("runBtn");
  function setRun(on) {
    state.running = on;
    runBtn.setAttribute("aria-pressed", String(on));
    runBtn.textContent = on ? "■ Stop" : "▶ Run";
    if (on) { last = performance.now(); requestAnimationFrame(frame); } else draw(true);
  }
  runBtn.addEventListener("click", () => setRun(!state.running));

  // ---- outputs + inputs ----
  function syncOutputs() {
    const P = params();
    $("tbOut").textContent = fmtT(P.tb) + "/div";
    $("nOut").textContent = P.wave === "sine" ? "n/a" : "up to " + P.n;
    $("fOut").textContent = fmtHz(P.f);
    $("aOut").textContent = P.a.toFixed(1) + " V peak";
    $("nzOut").textContent = P.nz.toFixed(2) + " V rms";
    $("fcOut").textContent = fmtHz(P.fc);
    $("volOut").textContent = Math.round(P.vol * 200) + "%";
    $("n").disabled = P.wave === "sine";
  }
  document.querySelectorAll("#controls input, #controls select").forEach(n => n.addEventListener("input", () => {
    if (n.name === "mode") state.mode = document.querySelector("input[name=mode]:checked").value;
    if (n.id === "trig" && n.checked) state.t0 = 0;
    syncOutputs(); updateAudio();
    if (!state.running) draw(true);
  }));

  // ---- audio ----
  let ac = null, osc = null, gain = null;
  function updateAudio() {
    if (!osc) return;
    const P = params();
    const out = terms(P.wave, P.n).map(t => { const h = filt(t.k, P.f, P.fc); return { k: t.k, amp: t.amp * h.g, ph: t.ph + h.p }; });
    const K = Math.max(2, out.reduce((m, q) => Math.max(m, q.k), 1) + 1);
    const re = new Float32Array(K), im = new Float32Array(K);
    for (const q of out) { if (!q.k) continue; im[q.k] += q.amp * Math.cos(q.ph); re[q.k] += q.amp * Math.sin(q.ph); }
    osc.setPeriodicWave(ac.createPeriodicWave(re, im));
    osc.frequency.setTargetAtTime(P.f, ac.currentTime, 0.02);
    gain.gain.setTargetAtTime(P.vol, ac.currentTime, 0.03);
  }
  const audioBtn = $("audioBtn");
  audioBtn.addEventListener("click", () => {
    if (osc) {
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.02);
      const o = osc; osc = null; setTimeout(() => o.stop(), 120);
      audioBtn.setAttribute("aria-pressed", "false"); audioBtn.textContent = "🔈 Play through speakers"; return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { audioBtn.textContent = "Audio not supported here"; return; }
    ac = ac || new AC();
    ac.resume();
    gain = ac.createGain(); gain.gain.value = 0; gain.connect(ac.destination);
    osc = ac.createOscillator(); osc.connect(gain); osc.start();
    updateAudio();
    audioBtn.setAttribute("aria-pressed", "true"); audioBtn.textContent = "🔇 Stop sound";
  });

  addEventListener("resize", resize);
  syncOutputs();
  resize();
  setRun(state.running);
})();
