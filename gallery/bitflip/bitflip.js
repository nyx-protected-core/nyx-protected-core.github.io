// Bitflip: Lights Out as XOR. Puzzles are built from real presses, so they're always solvable.
// Hints solve A·x = b over GF(2) with Gaussian elimination, then search the null space for the shortest x.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const boardEl = $("board"), regsEl = $("regs");
  const KEY = "bitflip-v1";
  let n = 3, cells = [], start = [], moves = 0, history = [], par = 0, level = 1, wrap = false, won = false, focusIdx = 0, isRandom = false;
  const store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } };

  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const sizeFor = L => L <= 3 ? 3 : L <= 8 ? 4 : L <= 16 ? 5 : L <= 26 ? 6 : 7;
  const neighbours = i => {
    const r = Math.floor(i / n), c = i % n, out = [i];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let rr = r + dr, cc = c + dc;
      if (wrap) { rr = (rr + n) % n; cc = (cc + n) % n; }
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
    return out;
  };
  const toggle = (arr, i) => { for (const j of neighbours(i)) arr[j] ^= 1; };

  // ---- solver over GF(2) ----
  function solve(b) {
    const N = n * n;
    const rows = [];
    for (let i = 0; i < N; i++) { const row = new Uint8Array(N + 1); for (const j of neighbours(i)) row[j] = 1; row[N] = b[i]; rows.push(row); }
    const pivCol = []; let r = 0;
    for (let c = 0; c < N && r < N; c++) {
      let p = r; while (p < N && !rows[p][c]) p++;
      if (p === N) continue;
      [rows[r], rows[p]] = [rows[p], rows[r]];
      for (let k = 0; k < N; k++) if (k !== r && rows[k][c]) for (let m = c; m <= N; m++) rows[k][m] ^= rows[r][m];
      pivCol.push(c); r++;
    }
    for (let k = r; k < N; k++) if (rows[k][N]) return null; // unsolvable
    const isPiv = new Set(pivCol), free = [];
    for (let c = 0; c < N; c++) if (!isPiv.has(c)) free.push(c);
    let best = null;
    const lim = Math.min(free.length, 12);
    for (let mask = 0; mask < 1 << lim; mask++) {
      const x = new Uint8Array(N);
      free.forEach((c, i) => { x[c] = i < lim ? (mask >> i) & 1 : 0; });
      pivCol.forEach((c, i) => { let v = rows[i][N]; for (const f of free) if (rows[i][f] && x[f]) v ^= 1; x[c] = v; });
      const w = x.reduce((a, v) => a + v, 0);
      if (!best || w < best.w) best = { x, w };
    }
    return best;
  }

  // ---- levels ----
  function makePuzzle(seed, size) {
    n = size;
    const rand = mulberry32(seed);
    const presses = Math.max(3, Math.round(size * size * (0.25 + 0.2 * rand())));
    let b;
    do {
      b = new Uint8Array(n * n);
      const picked = new Set();
      while (picked.size < presses) picked.add(Math.floor(rand() * n * n));
      picked.forEach(i => toggle(b, i));
    } while (!b.some(v => v));
    return b;
  }
  function load(L, randomSeed) {
    stopBurst();
    isRandom = randomSeed !== undefined;
    level = L;
    const seed = isRandom ? randomSeed : 0x5eed + L * 7919 + (wrap ? 1e6 : 0);
    start = makePuzzle(seed, isRandom ? 3 + Math.floor((randomSeed % 5)) : sizeFor(L));
    cells = Array.from(start); moves = 0; history = []; won = false;
    const s = solve(cells); par = s ? s.w : 0;
    focusIdx = Math.min(focusIdx, n * n - 1);
    const hadFocus = boardEl.contains(document.activeElement);
    buildBoard(); render();
    if (hadFocus) boardEl.querySelectorAll(".cell")[focusIdx].focus();
    $("next").hidden = true;
    say(isRandom ? `Random ${n}×${n} puzzle. Par is ${par}.` : `Level ${L}: ${n}×${n}${wrap ? ", wrap-around" : ""}. Par is ${par}.`);
    if (!isRandom) { store.level = L; store.wrap = wrap; persist(); }
  }

  // ---- rendering ----
  function buildBoard() {
    boardEl.style.setProperty("--n", n);
    boardEl.textContent = "";
    boardEl.classList.remove("won");
    for (let r = 0; r < n; r++) {
      const row = document.createElement("div"); row.setAttribute("role", "row"); row.style.display = "contents";
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const b = document.createElement("button");
        b.type = "button"; b.className = "cell"; b.dataset.i = i;
        b.setAttribute("role", "gridcell");
        b.tabIndex = i === focusIdx ? 0 : -1;
        b.addEventListener("click", () => press(i));
        row.appendChild(b);
      }
      boardEl.appendChild(row);
    }
  }
  function render() {
    const btns = boardEl.querySelectorAll(".cell");
    btns.forEach((b, i) => {
      b.textContent = cells[i];
      b.setAttribute("aria-pressed", cells[i] ? "true" : "false");
      b.setAttribute("aria-label", `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}: ${cells[i]}`);
      b.classList.remove("hint");
    });
    regsEl.textContent = "";
    for (let r = 0; r < n; r++) {
      let v = 0, bits = "";
      for (let c = 0; c < n; c++) { v = v << 1 | cells[r * n + c]; bits += cells[r * n + c]; }
      const li = document.createElement("li");
      li.innerHTML = `r${r} <span>0b${bits}</span> = <span class="hex">0x${v.toString(16).toUpperCase().padStart(2, "0")}</span>`;
      regsEl.appendChild(li);
    }
    $("level").textContent = isRandom ? "?" : level;
    $("moves").textContent = moves;
    $("par").textContent = par;
    $("ones").textContent = cells.reduce((a, v) => a + v, 0);
  }
  const say = m => { $("say").textContent = m; };

  function press(i) {
    if (won) return;
    focusIdx = i; setRoving();
    history.push(Array.from(cells));
    toggle(cells, i); moves++;
    render();
    if (!cells.some(v => v)) win();
  }
  function win() {
    won = true;
    boardEl.classList.add("won");
    const rating = moves <= par ? "Perfect: you matched par!" : `Solved in ${moves} (par ${par}).`;
    if (!isRandom) {
      const k = `${wrap ? "w" : "p"}${level}`;
      if (!store.best) store.best = {};
      const prev = store.best[k];
      if (!prev || moves < prev) store.best[k] = moves;
      persist();
    }
    say(`All zero! ${rating}`);
    const next = $("next"); next.hidden = isRandom; if (!isRandom) next.focus();
    burst();
  }

  // ---- keyboard: roving tabindex in the grid ----
  function setRoving() { boardEl.querySelectorAll(".cell").forEach((b, j) => { b.tabIndex = j === focusIdx ? 0 : -1; }); }
  boardEl.addEventListener("keydown", e => {
    const t = e.target.closest(".cell"); if (!t) return;
    let i = +t.dataset.i, r = Math.floor(i / n), c = i % n;
    const map = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (map[e.key]) {
      e.preventDefault();
      r = Math.max(0, Math.min(n - 1, r + map[e.key][0])); c = Math.max(0, Math.min(n - 1, c + map[e.key][1]));
      focusIdx = r * n + c; setRoving(); boardEl.querySelectorAll(".cell")[focusIdx].focus();
    } else if (e.key === "Home") { e.preventDefault(); focusIdx = r * n; setRoving(); boardEl.querySelectorAll(".cell")[focusIdx].focus(); }
    else if (e.key === "End") { e.preventDefault(); focusIdx = r * n + n - 1; setRoving(); boardEl.querySelectorAll(".cell")[focusIdx].focus(); }
  });
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "u") undo(); else if (k === "r") restart(); else if (k === "h") hint();
  });

  function undo() { if (!history.length || won) return; cells = history.pop(); moves++; render(); say("Undone. That still counts as a move. (Pressing the same cell again would do the same thing!)"); }
  function restart() { cells = Array.from(start); moves = 0; history = []; won = false; buildBoard(); render(); $("next").hidden = true; say("Back to the start."); }
  function hint() {
    if (won) return;
    const s = solve(cells);
    if (!s) { say("No solution from here. Try restarting."); return; }
    const left = s.w;
    let idx = -1;
    for (let i = 0; i < n * n; i++) if (s.x[i]) { idx = i; break; }
    render();
    if (idx >= 0) {
      const b = boardEl.querySelectorAll(".cell")[idx];
      b.classList.add("hint");
      say(`Try row ${Math.floor(idx / n) + 1}, column ${idx % n + 1}. The shortest solution from here takes ${left} press${left === 1 ? "" : "es"}.`);
    }
  }

  $("undo").addEventListener("click", undo);
  $("reset").addEventListener("click", restart);
  $("hint").addEventListener("click", hint);
  $("next").addEventListener("click", () => { load(level + 1); boardEl.querySelector(".cell[tabindex='0']").focus(); });
  $("random").addEventListener("click", () => load(level, (Math.random() * 1e9) >>> 0));
  $("wrap").addEventListener("change", e => { wrap = e.target.checked; load(isRandom ? 1 : level); });
  $("jump").addEventListener("change", e => { const v = Math.max(1, Math.min(99, Math.floor(+e.target.value) || 1)); e.target.value = v; load(v); });

  // ---- celebration: falling 0s and 1s ----
  const fx = $("fx"), g = fx.getContext("2d");
  let burstId = 0;
  function stopBurst() { burstId++; g.clearRect(0, 0, fx.width, fx.height); }
  function burst() {
    if (reduced) return;
    const id = ++burstId;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = innerWidth * dpr; fx.height = innerHeight * dpr;
    const rect = boardEl.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) * dpr, cy = (rect.top + rect.height / 2) * dpr;
    const ps = Array.from({ length: 90 }, () => ({ x: cx, y: cy, vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 4) * dpr, ch: Math.random() < 0.5 ? "0" : "1", life: 70 + Math.random() * 40, c: Math.random() < 0.5 ? "#7ab8ff" : "#ffd36b" }));
    let f = 0;
    (function step() {
      if (id !== burstId) return;
      g.clearRect(0, 0, fx.width, fx.height);
      g.font = `700 ${18 * dpr}px ui-monospace,monospace`;
      let alive = 0;
      for (const p of ps) {
        if (p.life-- <= 0) continue; alive++;
        p.vy += 0.5 * dpr; p.x += p.vx; p.y += p.vy; p.vx *= 0.99;
        g.globalAlpha = Math.min(1, p.life / 30); g.fillStyle = p.c; g.fillText(p.ch, p.x, p.y);
      }
      g.globalAlpha = 1;
      if (alive && f++ < 200) requestAnimationFrame(step); else g.clearRect(0, 0, fx.width, fx.height);
    })();
  }

  wrap = !!store.wrap; $("wrap").checked = wrap;
  const L = Math.max(1, Math.min(99, store.level || 1)); $("jump").value = L;
  load(L);
})();
