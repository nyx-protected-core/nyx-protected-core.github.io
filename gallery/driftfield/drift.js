// Driftfield: particles follow a seeded 3-D Perlin noise field and leave ink behind.
// Same seed + settings = same painting (the PRNG and noise are fully seeded).
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const cv = $("art"), ctx = cv.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  const PALETTES = {
    aurora:  { name: "Aurora",       bg: "#04060d", c: ["#3ef2c3", "#4b8bff", "#a46bff", "#d9fff3"], blend: "lighter", a: 0.05 },
    ember:   { name: "Ember",        bg: "#0b0503", c: ["#ff4d00", "#ffb000", "#ff2a6d", "#ffd6a0"], blend: "lighter", a: 0.05 },
    tide:    { name: "Tide",         bg: "#020b14", c: ["#0aa1dd", "#79dae8", "#2155cd", "#e8f9fd"], blend: "lighter", a: 0.05 },
    neon:    { name: "Neon circuit", bg: "#040404", c: ["#39ff14", "#00e5ff", "#ff00e6", "#fff36b"], blend: "lighter", a: 0.06 },
    ink:     { name: "Ink on paper", bg: "#f3ede2", c: ["#1b1414", "#3a2e39", "#b23a48", "#5b4a3f"], blend: "source-over", a: 0.07, paper: true },
    botanic: { name: "Botanic",      bg: "#efe9dc", c: ["#2f5d50", "#7a9e7e", "#c08552", "#3e2723"], blend: "source-over", a: 0.08, paper: true }
  };
  const STYLES = {
    silk:  { steps: 700, life: [180, 600], lw: 0.7, speed: 1.4 },
    fur:   { steps: 360, life: [12, 40],   lw: 1.1, speed: 1.6 },
    maze:  { steps: 600, life: [60, 260],  lw: 0.9, speed: 1.5 },
    orbit: { steps: 700, life: [200, 700], lw: 0.7, speed: 1.4 }
  };

  // ---- seeded randomness ----
  function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return (h >>> 0) || 1; }
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeNoise(rand) {
    const p = new Uint8Array(512), perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
    return (x, y, z) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return lerp(lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    };
  }

  // ---- state ----
  let W = 0, H = 0, dpr = 1, cfg, rand, noise, pts = [], step = 0, total = 0, z = 0, stirs = [], paused = false, raf = 0;

  const words = ["ember", "lumen", "drift", "hollow", "quartz", "velvet", "signal", "harbor", "cinder", "orchid", "static", "meadow", "comet", "tidal", "relay", "nectar", "ion", "willow", "basalt", "aurora"];
  const randomSeed = () => words[Math.floor(Math.random() * words.length)] + "-" + Math.floor(Math.random() * 9000 + 1000);

  function readForm() {
    return { seed: $("seed").value.trim() || "drift-0001", palette: $("palette").value, style: $("style").value, sym: +$("sym").value, scale: +$("scale").value, count: +$("count").value };
  }
  function writeForm(c) {
    $("seed").value = c.seed; $("palette").value = c.palette; $("style").value = c.style; $("sym").value = String(c.sym);
    $("scale").value = c.scale; $("count").value = c.count; syncOut();
  }
  function syncOut() { $("scaleOut").textContent = $("scale").value; $("countOut").textContent = Number($("count").value).toLocaleString(); }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
  }

  function spawn(pt) {
    pt.x = rand() * W; pt.y = rand() * H; pt.px = pt.x; pt.py = pt.y;
    const S = STYLES[cfg.style];
    pt.life = S.life[0] + rand() * (S.life[1] - S.life[0]);
    const pal = PALETTES[cfg.palette];
    const f = 0.0006 * cfg.scale / dpr;
    const n = (noise(pt.x * f * 0.5, pt.y * f * 0.5, 50) + 1) / 2;
    pt.c = Math.min(pal.c.length - 1, Math.floor(n * pal.c.length * 1.15) % pal.c.length);
  }

  function start(c) {
    cancelAnimationFrame(raf);
    cfg = c;
    rand = mulberry32(hashStr(c.seed + "|" + c.style));
    noise = makeNoise(mulberry32(hashStr(c.seed)));
    resize();
    const pal = PALETTES[c.palette];
    document.body.classList.toggle("paper", !!pal.paper);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
    pts = Array.from({ length: c.count }, () => { const p = {}; spawn(p); return p; });
    step = 0; total = STYLES[c.style].steps; z = 0; stirs = [];
    $("no").textContent = "No. " + c.seed;
    $("meta").textContent = `${pal.name} · ${$("style").selectedOptions[0].textContent.split(":")[0]} · ${c.count.toLocaleString()} particles`;
    history.replaceState(null, "", "#" + new URLSearchParams({ seed: c.seed, p: c.palette, s: c.style, y: c.sym, k: c.scale, n: c.count }).toString());
    say(reduced ? "Painting (motion reduced: showing the finished piece)…" : "Painting…");
    if (reduced) { requestAnimationFrame(() => { while (step < total) tick(); done(); }); }
    else if (!paused) raf = requestAnimationFrame(loop);
  }

  function angleAt(x, y) {
    const f = 0.0006 * cfg.scale / dpr;
    let a = noise(x * f, y * f, z) * TAU * 1.6 + noise(x * f * 3, y * f * 3, z + 10) * 0.6;
    if (cfg.style === "maze") a = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
    if (cfg.style === "orbit") { const dx = x - W / 2, dy = y - H / 2; a = Math.atan2(dy, dx) + Math.PI / 2 + 0.25 + noise(x * f, y * f, z) * 1.3; }
    for (const s of stirs) {
      const dx = x - s.x, dy = y - s.y, d2 = dx * dx + dy * dy, r = s.r;
      const wgt = Math.exp(-d2 / (r * r));
      if (wgt > 0.01) {
        const t = Math.atan2(dy, dx) + Math.PI / 2 * s.dir;
        let diff = t - a; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        a += diff * wgt;
      }
    }
    return a;
  }

  function tick() {
    const pal = PALETTES[cfg.palette], S = STYLES[cfg.style];
    const paths = pal.c.map(() => new Path2D());
    const sp = S.speed * dpr;
    for (const pt of pts) {
      const a = angleAt(pt.x, pt.y);
      pt.px = pt.x; pt.py = pt.y;
      pt.x += Math.cos(a) * sp; pt.y += Math.sin(a) * sp;
      if (--pt.life < 0 || pt.x < -10 || pt.y < -10 || pt.x > W + 10 || pt.y > H + 10) { spawn(pt); continue; }
      const path = paths[pt.c]; path.moveTo(pt.px, pt.py); path.lineTo(pt.x, pt.y);
    }
    ctx.globalCompositeOperation = pal.blend;
    ctx.lineWidth = S.lw * dpr; ctx.lineCap = "round";
    const n = cfg.sym;
    for (let k = 0; k < n; k++) {
      ctx.save();
      if (n === 2 && k === 1) ctx.setTransform(-1, 0, 0, 1, W, 0);
      if (n === 4) ctx.setTransform(k & 1 ? -1 : 1, 0, 0, k & 2 ? -1 : 1, k & 1 ? W : 0, k & 2 ? H : 0);
      if (n === 6) { ctx.translate(W / 2, H / 2); ctx.rotate(k * TAU / 6); ctx.translate(-W / 2, -H / 2); }
      ctx.globalAlpha = n > 1 ? pal.a * 0.75 : pal.a;
      paths.forEach((p, i) => { ctx.strokeStyle = pal.c[i]; ctx.stroke(p); });
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    z += 0.0025; step++;
  }

  function loop() {
    if (paused) return;
    for (let i = 0; i < 3 && step < total; i++) tick();
    if (step < total) raf = requestAnimationFrame(loop); else done();
  }
  function done() { say(`Finished. Seed “${cfg.seed}”. Drag to stir it more, or save it.`); }
  const say = m => { $("status").textContent = m; };

  // ---- stirring ----
  let lastStir = null;
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); lastStir = null; addStir(e); });
  cv.addEventListener("pointermove", e => { if (e.buttons) addStir(e); });
  function addStir(e) {
    const x = e.clientX * dpr, y = e.clientY * dpr;
    if (lastStir && Math.hypot(x - lastStir.x, y - lastStir.y) < 60 * dpr) return;
    const dir = lastStir && ((x - lastStir.x) * (H / 2 - y) - (y - lastStir.y) * (W / 2 - x)) < 0 ? -1 : 1;
    lastStir = { x, y };
    stirs.push({ x, y, r: 140 * dpr, dir });
    if (stirs.length > 16) stirs.shift();
    if (step >= total) { total = step + 160; if (!paused) { if (reduced) { while (step < total) tick(); done(); } else raf = requestAnimationFrame(loop); } }
  }

  // ---- saving ----
  function save() {
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const o = out.getContext("2d"); o.drawImage(cv, 0, 0);
    const pal = PALETTES[cfg.palette];
    o.font = `italic ${16 * dpr}px Georgia, serif`; o.fillStyle = pal.paper ? "rgba(20,10,10,.6)" : "rgba(255,255,255,.6)";
    o.textAlign = "right"; o.fillText(`Driftfield · ${cfg.seed}`, W - 18 * dpr, H - 18 * dpr);
    out.toBlob(b => {
      if (!b) { say("Your browser couldn't export the image."); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b);
      a.download = `driftfield-${cfg.seed.replace(/[^a-z0-9-]+/gi, "_")}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      say("Saved as " + a.download);
    }, "image/png");
  }

  // ---- UI ----
  const palSel = $("palette");
  for (const [k, v] of Object.entries(PALETTES)) { const o = document.createElement("option"); o.value = k; o.textContent = v.name; palSel.appendChild(o); }
  $("form").addEventListener("submit", e => { e.preventDefault(); start(readForm()); });
  ["palette", "style", "sym", "scale", "count"].forEach(id => $(id).addEventListener("change", () => start(readForm())));
  ["scale", "count"].forEach(id => $(id).addEventListener("input", syncOut));
  const newSeed = () => { $("seed").value = randomSeed(); start(readForm()); };
  $("newBtn").addEventListener("click", newSeed);
  $("saveBtn").addEventListener("click", save);
  const pauseBtn = $("pauseBtn");
  function togglePause() {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.firstChild.textContent = paused ? "Resume " : "Pause ";
    if (!paused && step < total && !reduced) raf = requestAnimationFrame(loop);
    say(paused ? "Paused." : "Painting…");
  }
  pauseBtn.addEventListener("click", togglePause);
  const toggle = $("toggle"), panel = $("panel");
  toggle.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); });
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, select, textarea, button") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "n" || e.key === "N") newSeed();
    else if (e.key === "s" || e.key === "S") save();
    else if (e.key === " ") { e.preventDefault(); togglePause(); }
    else if (e.key === "h" || e.key === "H") toggle.click();
  });
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => start(readForm()), 300); });

  // ---- boot ----
  const q = new URLSearchParams(location.hash.slice(1));
  const init = {
    seed: (q.get("seed") || randomSeed()).slice(0, 24),
    palette: PALETTES[q.get("p")] ? q.get("p") : "aurora",
    style: STYLES[q.get("s")] ? q.get("s") : "silk",
    sym: [1, 2, 4, 6].includes(+q.get("y")) ? +q.get("y") : 1,
    scale: Math.min(10, Math.max(1, +q.get("k") || 4)),
    count: Math.min(6000, Math.max(200, +q.get("n") || 2400))
  };
  if (innerWidth < 640) { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
  writeForm(init);
  start(init);
})();
