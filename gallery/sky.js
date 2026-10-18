// Slow drifting stars that lean toward the pointer. Static when reduced motion is requested.
(() => {
  "use strict";
  const c = document.getElementById("sky");
  const ctx = c.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, dpr = 1, stars = [], mx = 0.5, my = 0.5;
  const hues = ["#b38cff", "#69f0d4", "#ffc46b", "#ecebf5"];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.width = Math.floor(innerWidth * dpr);
    h = c.height = Math.floor(innerHeight * dpr);
    const n = Math.round((innerWidth * innerHeight) / 5000);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      c: hues[(Math.random() * hues.length) | 0],
      t: Math.random() * Math.PI * 2
    }));
    draw(0);
  }
  function draw(time) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * mx, h * my, 0, w * mx, h * my, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(120,80,220,0.16)");
    g.addColorStop(1, "rgba(7,7,13,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      if (!still) {
        s.y -= s.z * 0.15 * dpr;
        s.x += (mx - 0.5) * s.z * 0.6 * dpr;
        if (s.y < 0) s.y += h;
        if (s.x < 0) s.x += w; else if (s.x > w) s.x -= w;
      }
      const a = 0.35 + 0.45 * Math.sin(s.t + time * 0.001 * s.z);
      ctx.globalAlpha = still ? 0.6 : a;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.z * 1.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function loop(t) { draw(t); requestAnimationFrame(loop); }
  addEventListener("resize", resize);
  addEventListener("pointermove", e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; if (still) draw(0); });
  resize();
  if (!still) requestAnimationFrame(loop);
})();
