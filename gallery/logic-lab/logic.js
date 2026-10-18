// Logic Lab: a small event-free logic simulator drawn in SVG.
// Model: parts {id,type,x,y,on} and wires {from,to,pin}. Every part has at most one output.
// Simulation: evaluate parts in place, in order, until nothing changes (Gauss-Seidel style),
// which lets feedback circuits such as an SR latch settle and remember.
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const W = 80, H = 50;
  const SPEC = {
    IN:    { ins: 0, out: true,  name: "Switch" },
    CLOCK: { ins: 0, out: true,  name: "Clock" },
    OUT:   { ins: 1, out: false, name: "Lamp" },
    NOT:   { ins: 1, out: true,  name: "NOT gate", f: a => !a },
    AND:   { ins: 2, out: true,  name: "AND gate", f: (a, b) => a && b },
    OR:    { ins: 2, out: true,  name: "OR gate", f: (a, b) => a || b },
    NAND:  { ins: 2, out: true,  name: "NAND gate", f: (a, b) => !(a && b) },
    NOR:   { ins: 2, out: true,  name: "NOR gate", f: (a, b) => !(a || b) },
    XOR:   { ins: 2, out: true,  name: "XOR gate", f: (a, b) => a !== b },
    XNOR:  { ins: 2, out: true,  name: "XNOR gate", f: (a, b) => a === b }
  };
  const SHAPE = {
    AND:  "M10 0H40A25 25 0 0 1 40 50H10Z",
    NAND: "M10 0H38A25 25 0 0 1 38 50H10Z",
    OR:   "M8 0Q34 0 70 25Q34 50 8 50Q22 25 8 0Z",
    NOR:  "M8 0Q32 0 64 25Q32 50 8 50Q22 25 8 0Z",
    XOR:  "M14 0Q38 0 70 25Q38 50 14 50Q28 25 14 0Z",
    XNOR: "M14 0Q36 0 64 25Q36 50 14 50Q28 25 14 0Z",
    NOT:  "M14 4L60 25L14 46Z"
  };
  const BUBBLE = { NAND: 69, NOR: 69, XNOR: 69, NOT: 65 };

  const $ = id => document.getElementById(id);
  const svg = $("board"), gWires = $("wires"), gParts = $("parts"), ghost = $("ghost");
  const statusEl = $("status");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let parts = [], wires = [], nextId = 1, values = new Map();
  let pending = null;          // {from: id} while drawing a wire
  let clockTimer = null;

  const say = msg => { statusEl.textContent = msg; };
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const byId = id => parts.find(p => p.id === id);
  const inPinY = (p, pin) => SPEC[p.type].ins === 1 ? 25 : (pin === 0 ? 14 : 36);

  function label(p) {
    if (p.type === "IN" || p.type === "OUT") {
      const same = parts.filter(q => q.type === p.type);
      const i = same.indexOf(p);
      return p.type === "IN" ? String.fromCharCode(65 + (i % 26)) : "Y" + i;
    }
    if (p.type === "CLOCK") return "CLK";
    return "";
  }

  // ---- simulation ----
  function inputsOf(p) {
    const n = SPEC[p.type].ins, out = [];
    for (let i = 0; i < n; i++) {
      const w = wires.find(w => w.to === p.id && w.pin === i);
      out.push(w ? !!values.get(w.from) : false);
    }
    return out;
  }
  function simulate() {
    let stable = false, passes = 0;
    while (!stable && passes < 64) {
      stable = true; passes++;
      for (const p of parts) {
        let v;
        if (p.type === "IN" || p.type === "CLOCK") v = !!p.on;
        else if (p.type === "OUT") v = inputsOf(p)[0];
        else v = SPEC[p.type].f(...inputsOf(p));
        if (values.get(p.id) !== v) { values.set(p.id, v); stable = false; }
      }
    }
    return stable;
  }

  // ---- drawing ----
  function wirePath(a, b, pin) {
    const x1 = a.x + W, y1 = a.y + 25, x2 = b.x, y2 = b.y + inPinY(b, pin);
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    return `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
  }
  function render() {
    const ok = simulate();
    gWires.textContent = "";
    for (const w of wires) {
      const a = byId(w.from), b = byId(w.to);
      if (!a || !b) continue;
      const d = wirePath(a, b, w.pin);
      const g = el("g", { class: "wire-grp" }, gWires);
      const hit = el("path", { d, class: "wire-hit" }, g);
      el("path", { d, class: "wire" + (values.get(w.from) ? " on" : "") }, g);
      hit.addEventListener("click", () => { wires = wires.filter(x => x !== w); save(); render(); say("Wire removed."); });
    }
    const focusedId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : null;
    gParts.textContent = "";
    for (const p of parts) drawPart(p);
    if (focusedId) { const f = gParts.querySelector(`[data-id="${focusedId}"]`); if (f) f.focus({ preventScroll: true }); }
    if (!ok) say("This circuit is oscillating: it never settles. That happens with odd loops of inverters.");
  }
  function drawPart(p) {
    const s = SPEC[p.type], on = !!values.get(p.id);
    const g = el("g", { class: "part" + (on ? " lit" : "") + (pending && pending.from === p.id ? " sel" : ""), transform: `translate(${p.x} ${p.y})`, tabindex: "0", role: "button", "data-id": p.id }, gParts);
    const lab = label(p);
    g.setAttribute("aria-label", `${s.name}${lab ? " " + lab : ""}, ${s.out ? "output" : "lit"} ${on ? "1" : "0"}${p.type === "IN" ? ". Space flips it" : ""}`);
    // input stubs and pins
    for (let i = 0; i < s.ins; i++) {
      const y = inPinY(p, i);
      el("line", { x1: 0, y1: y, x2: 14, y2: y, class: "stub" }, g);
      const pin = el("circle", { cx: 0, cy: y, r: 6, class: "pin" + (inputsOf(p)[i] ? " on" : "") }, g);
      pin.addEventListener("pointerdown", e => { e.stopPropagation(); finishWire(p, i); });
    }
    if (s.out) {
      el("line", { x1: 66, y1: 25, x2: W, y2: 25, class: "stub" }, g);
    }
    if (SHAPE[p.type]) {
      el("path", { d: SHAPE[p.type], class: "body" }, g);
      if (p.type === "XOR" || p.type === "XNOR") el("path", { d: "M5 0Q19 25 5 50", class: "body", fill: "none" }, g);
      if (BUBBLE[p.type]) el("circle", { cx: BUBBLE[p.type], cy: 25, r: 5, class: "body" }, g);
      const t = el("text", { x: 34, y: 29, class: "gname" }, g); t.textContent = p.type === "NOT" ? "" : p.type;
    } else if (p.type === "IN") {
      el("rect", { x: 6, y: 8, width: 60, height: 34, rx: 17, class: "body" }, g);
      el("circle", { cx: 23, cy: 25, r: 12, class: "knob" }, g);
    } else if (p.type === "CLOCK") {
      el("rect", { x: 6, y: 6, width: 60, height: 38, rx: 8, class: "body" }, g);
      el("path", { d: "M14 33h8V17h10v16h10V17h10v16h6", fill: "none", class: "stub" }, g);
    } else if (p.type === "OUT") {
      el("line", { x1: 0, y1: 25, x2: 22, y2: 25, class: "stub" }, g);
      el("circle", { cx: 42, cy: 25, r: 20, class: "lamp" }, g);
    }
    if (s.out) {
      const op = el("circle", { cx: W, cy: 25, r: 7, class: "pin" + (on ? " on" : "") + (pending && pending.from === p.id ? " armed" : "") }, g);
      op.addEventListener("pointerdown", e => { e.stopPropagation(); startWire(p); });
    }
    if (lab) { const t = el("text", { x: 40, y: 68, class: "label" }, g); t.textContent = lab; }
    g.addEventListener("pointerdown", e => beginDrag(e, p, g));
    g.addEventListener("keydown", e => onKey(e, p));
  }

  // ---- wiring ----
  function startWire(p) {
    pending = { from: p.id };
    say(`Wiring from ${SPEC[p.type].name} ${label(p)}. Click an input pin (or focus a part and press 1 or 2). Esc cancels.`);
    render();
  }
  function finishWire(p, pin) {
    if (!pending) { say("Start a wire from an output pin (right side) first."); return; }
    if (pending.from === p.id) { say("A part can't feed itself directly. Pick another part."); return; }
    wires = wires.filter(w => !(w.to === p.id && w.pin === pin));
    wires.push({ from: pending.from, to: p.id, pin });
    const src = byId(pending.from);
    pending = null; ghost.setAttribute("d", "");
    save(); render();
    say(`Connected ${SPEC[src.type].name} ${label(src)} to input ${pin + 1} of ${SPEC[p.type].name} ${label(p)}.`);
  }
  function cancelWire() { if (pending) { pending = null; ghost.setAttribute("d", ""); render(); say("Wire cancelled."); } }

  // ---- pointer ----
  function toSvg(e) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function beginDrag(e, p, g) {
    if (e.button !== 0) return;
    const start = toSvg(e), ox = p.x, oy = p.y;
    let moved = false;
    g.setPointerCapture(e.pointerId);
    const move = ev => {
      const q = toSvg(ev), dx = q.x - start.x, dy = q.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      p.x = clamp(Math.round((ox + dx) / 10) * 10, 10, 1200 - W - 10);
      p.y = clamp(Math.round((oy + dy) / 10) * 10, 10, 720 - H - 30);
      g.setAttribute("transform", `translate(${p.x} ${p.y})`);
      redrawWiresOnly();
    };
    const up = () => {
      g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up);
      if (!moved && p.type === "IN") { p.on = !p.on; say(`Switch ${label(p)} is now ${p.on ? 1 : 0}.`); }
      save(); render();
      const f = gParts.querySelector(`[data-id="${p.id}"]`); if (f) f.focus({ preventScroll: true });
    };
    g.addEventListener("pointermove", move); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
  }
  function redrawWiresOnly() {
    const paths = gWires.querySelectorAll("g");
    wires.forEach((w, i) => {
      const a = byId(w.from), b = byId(w.to); if (!a || !b || !paths[i]) return;
      const d = wirePath(a, b, w.pin);
      paths[i].querySelectorAll("path").forEach(n => n.setAttribute("d", d));
    });
  }
  svg.addEventListener("pointermove", e => {
    if (!pending) return;
    const a = byId(pending.from), q = toSvg(e);
    if (a) ghost.setAttribute("d", `M${a.x + W} ${a.y + 25}L${q.x} ${q.y}`);
  });
  svg.addEventListener("pointerdown", e => { if (e.target === svg || e.target.tagName === "rect" && e.target.parentNode === svg) cancelWire(); });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- keyboard ----
  function onKey(e, p) {
    const step = e.shiftKey ? 40 : 10;
    const k = e.key;
    if (k.startsWith("Arrow")) {
      e.preventDefault();
      if (k === "ArrowLeft") p.x -= step; if (k === "ArrowRight") p.x += step;
      if (k === "ArrowUp") p.y -= step; if (k === "ArrowDown") p.y += step;
      p.x = clamp(p.x, 10, 1200 - W - 10); p.y = clamp(p.y, 10, 720 - H - 30);
      save(); render(); return;
    }
    if ((k === " " || k === "Enter") && p.type === "IN") { e.preventDefault(); p.on = !p.on; save(); render(); say(`Switch ${label(p)} is now ${p.on ? 1 : 0}.`); return; }
    if (k === "w" || k === "W") { e.preventDefault(); if (SPEC[p.type].out) startWire(p); else say("Lamps have no output to wire from."); return; }
    if (k === "1" || k === "2") {
      const pin = Number(k) - 1;
      if (pin >= SPEC[p.type].ins) { say(`That part has ${SPEC[p.type].ins} input${SPEC[p.type].ins === 1 ? "" : "s"}.`); return; }
      e.preventDefault(); finishWire(p, pin); return;
    }
    if (k === "x" || k === "X") { wires = wires.filter(w => w.to !== p.id); save(); render(); say("Inputs unplugged."); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); removePart(p); return; }
    if (k === "Escape") cancelWire();
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") cancelWire(); });

  function removePart(p) {
    const name = `${SPEC[p.type].name} ${label(p)}`;
    parts = parts.filter(q => q !== p);
    wires = wires.filter(w => w.from !== p.id && w.to !== p.id);
    values.delete(p.id);
    save(); render(); say(`${name} removed.`);
    const first = gParts.querySelector(".part"); if (first) first.focus(); else svg.focus();
  }
  function addPart(type, x, y) {
    if (x === undefined) {
      // find a free-ish spot near the middle
      let tries = 0; x = 560; y = 330;
      while (tries++ < 40 && parts.some(q => Math.abs(q.x - x) < 90 && Math.abs(q.y - y) < 70)) { x = 200 + Math.round(Math.random() * 80) * 10; y = 40 + Math.round(Math.random() * 55) * 10; }
    }
    const p = { id: nextId++, type, x, y, on: false };
    parts.push(p);
    return p;
  }

  // ---- presets ----
  function build(spec) {
    parts = []; wires = []; values = new Map(); nextId = 1;
    const ids = {};
    for (const [key, type, x, y] of spec.parts) ids[key] = addPart(type, x, y).id;
    for (const [a, b, pin] of spec.wires) wires.push({ from: ids[a], to: ids[b], pin });
  }
  const PRESETS = {
    half: { parts: [["a", "IN", 100, 200], ["b", "IN", 100, 400], ["x", "XOR", 450, 220], ["n", "AND", 450, 400], ["s", "OUT", 800, 220], ["c", "OUT", 800, 400]],
      wires: [["a", "x", 0], ["b", "x", 1], ["a", "n", 0], ["b", "n", 1], ["x", "s", 0], ["n", "c", 0]], say: "Half adder: Y0 is the sum bit, Y1 is the carry. Try A=1, B=1." },
    full: { parts: [["a", "IN", 60, 140], ["b", "IN", 60, 280], ["ci", "IN", 60, 460], ["x1", "XOR", 300, 180], ["x2", "XOR", 600, 260], ["a1", "AND", 300, 360], ["a2", "AND", 600, 440], ["o", "OR", 860, 420], ["s", "OUT", 1060, 260], ["co", "OUT", 1060, 420]],
      wires: [["a", "x1", 0], ["b", "x1", 1], ["x1", "x2", 0], ["ci", "x2", 1], ["a", "a1", 0], ["b", "a1", 1], ["x1", "a2", 0], ["ci", "a2", 1], ["a1", "o", 0], ["a2", "o", 1], ["x2", "s", 0], ["o", "co", 0]],
      say: "Full adder: adds A + B + carry-in (C). Y0 is the sum, Y1 the carry-out. Chain these to add whole numbers." },
    latch: { parts: [["s", "IN", 100, 180], ["r", "IN", 100, 440], ["n2", "NOR", 450, 420], ["n1", "NOR", 450, 200], ["q", "OUT", 820, 200], ["qb", "OUT", 820, 420]],
      wires: [["r", "n1", 0], ["n2", "n1", 1], ["s", "n2", 0], ["n1", "n2", 1], ["n1", "q", 0], ["n2", "qb", 0]],
      say: "SR latch: A sets, B resets. Flip A on then off again: Y0 stays lit. That loop of two gates is one bit of memory. B clears it." },
    nandxor: { parts: [["a", "IN", 80, 200], ["b", "IN", 80, 440], ["n1", "NAND", 330, 320], ["n2", "NAND", 600, 200], ["n3", "NAND", 600, 440], ["n4", "NAND", 860, 320], ["y", "OUT", 1060, 320]],
      wires: [["a", "n1", 0], ["b", "n1", 1], ["a", "n2", 0], ["n1", "n2", 1], ["n1", "n3", 0], ["b", "n3", 1], ["n2", "n4", 0], ["n3", "n4", 1], ["n4", "y", 0]],
      say: "Four NAND gates make an XOR. NAND alone can build any logic circuit." },
    mux: { parts: [["d0", "IN", 80, 120], ["d1", "IN", 80, 520], ["sel", "IN", 80, 320], ["nt", "NOT", 300, 230], ["a0", "AND", 540, 160], ["a1", "AND", 540, 460], ["o", "OR", 800, 310], ["y", "OUT", 1040, 310]],
      wires: [["sel", "nt", 0], ["d0", "a0", 0], ["nt", "a0", 1], ["d1", "a1", 0], ["sel", "a1", 1], ["a0", "o", 0], ["a1", "o", 1], ["o", "y", 0]],
      say: "Multiplexer: switch B (select) chooses whether A or C reaches the lamp. Data selectors like this are everywhere in a CPU." },
    blink: { parts: [["clk", "CLOCK", 120, 320], ["n", "NOT", 460, 450], ["y0", "OUT", 800, 200], ["y1", "OUT", 800, 450]],
      wires: [["clk", "y0", 0], ["clk", "n", 0], ["n", "y1", 0]],
      say: "Press Run clock. The clock ticks twice a second and the NOT gate makes the lamps alternate." }
  };

  // ---- truth table ----
  function truthTable() {
    const ins = parts.filter(p => p.type === "IN"), outs = parts.filter(p => p.type === "OUT");
    const wrap = $("tableWrap"), tt = $("tt"), note = $("ttNote");
    wrap.hidden = false;
    tt.textContent = "";
    if (!ins.length || !outs.length) { note.textContent = "Add at least one switch and one lamp first."; return; }
    if (ins.length > 6) { note.textContent = "That is more than 6 switches (over 64 rows). Remove a few to build a table."; return; }
    const saved = ins.map(p => p.on), savedVals = new Map(values);
    const head = tt.insertRow();
    for (const p of ins) { const th = document.createElement("th"); th.scope = "col"; th.textContent = label(p); head.appendChild(th); }
    outs.forEach((p, i) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label(p); if (i === 0) th.className = "out"; head.appendChild(th); });
    let seq = false;
    for (let m = 0; m < 1 << ins.length; m++) {
      ins.forEach((p, i) => { p.on = !!(m >> (ins.length - 1 - i) & 1); });
      values = new Map();
      if (!simulate()) seq = true;
      const row = tt.insertRow();
      ins.forEach(p => { const c = row.insertCell(); c.textContent = p.on ? 1 : 0; c.className = p.on ? "one" : "zero"; });
      outs.forEach((p, i) => { const v = values.get(p.id) ? 1 : 0; const c = row.insertCell(); c.textContent = v; c.className = (v ? "one" : "zero") + (i === 0 ? " out" : ""); });
    }
    if (parts.some(p => p.type === "CLOCK")) seq = true;
    const loops = hasLoop();
    ins.forEach((p, i) => { p.on = saved[i]; });
    values = savedVals;
    note.textContent = `${1 << ins.length} rows. ` + (loops || seq ? "This circuit has feedback or a clock, so its outputs can depend on history. The table shows each row starting from all zeros." : "Every row is computed by actually running the circuit.");
    render();
    wrap.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }
  function hasLoop() {
    const adj = new Map(parts.map(p => [p.id, []]));
    wires.forEach(w => adj.get(w.from) && adj.get(w.from).push(w.to));
    const state = new Map();
    const dfs = id => { state.set(id, 1); for (const n of adj.get(id) || []) { if (state.get(n) === 1) return true; if (!state.get(n) && dfs(n)) return true; } state.set(id, 2); return false; };
    return parts.some(p => !state.get(p.id) && dfs(p.id));
  }

  // ---- persistence ----
  const KEY = "logic-lab-v1";
  const serial = () => JSON.stringify({ p: parts.map(p => [p.type, p.x, p.y, p.on ? 1 : 0]), w: wires.map(w => [parts.findIndex(p => p.id === w.from), parts.findIndex(p => p.id === w.to), w.pin]) });
  function load(json) {
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.p) || !Array.isArray(d.w)) throw new Error("bad data");
    parts = []; wires = []; values = new Map(); nextId = 1;
    for (const [type, x, y, on] of d.p) { if (!SPEC[type]) continue; const p = addPart(type, clamp(+x || 0, 10, 1110), clamp(+y || 0, 10, 640)); p.on = !!on; }
    for (const [a, b, pin] of d.w) { if (parts[a] && parts[b] && (pin === 0 || pin === 1)) wires.push({ from: parts[a].id, to: parts[b].id, pin }); }
  }
  function save() { try { localStorage.setItem(KEY, serial()); } catch { /* storage may be blocked */ } }

  // ---- UI wiring ----
  $("palette").addEventListener("click", e => {
    const t = e.target.closest("button[data-add]"); if (!t) return;
    const p = addPart(t.dataset.add);
    save(); render();
    const g = gParts.querySelector(`[data-id="${p.id}"]`); if (g) g.focus();
    say(`Added ${SPEC[p.type].name} ${label(p)}. It's focused: use arrow keys to move it, W to wire from it.`);
  });
  $("preset").addEventListener("change", e => {
    const k = e.target.value; if (!PRESETS[k]) return;
    build(PRESETS[k]); save(); render(); say(PRESETS[k].say);
    $("tableWrap").hidden = true;
  });
  $("clearBtn").addEventListener("click", () => {
    if (parts.length && !confirm("Clear the whole board?")) return;
    parts = []; wires = []; values = new Map(); save(); render(); say("Board cleared. Add a part to begin.");
  });
  $("tableBtn").addEventListener("click", truthTable);
  $("shareBtn").addEventListener("click", async () => {
    const url = location.href.split("#")[0] + "#c=" + btoa(unescape(encodeURIComponent(serial())));
    try { await navigator.clipboard.writeText(url); say("Share link copied. Anyone who opens it gets this exact circuit."); }
    catch { history.replaceState(null, "", url); say("Couldn't reach the clipboard, so the link is now in the address bar."); }
  });
  const clockBtn = $("clockBtn");
  clockBtn.addEventListener("click", () => {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; clockBtn.setAttribute("aria-pressed", "false"); clockBtn.textContent = "▶ Run clock"; say("Clock stopped."); return; }
    clockTimer = setInterval(() => { for (const p of parts) if (p.type === "CLOCK") p.on = !p.on; render(); }, 500);
    clockBtn.setAttribute("aria-pressed", "true"); clockBtn.textContent = "■ Stop clock";
    say(parts.some(p => p.type === "CLOCK") ? "Clock running at 1 Hz (it flips every half second)." : "Clock running, but there's no Clock part on the board yet.");
  });

  // ---- start ----
  try {
    const m = location.hash.match(/^#c=(.+)$/);
    if (m) { load(decodeURIComponent(escape(atob(m[1])))); say("Loaded the circuit from the link."); }
    else { const s = localStorage.getItem(KEY); if (s) { load(s); say("Welcome back. Your last board is restored."); } else throw new Error("none"); }
  } catch { build(PRESETS.half); say(PRESETS.half.say); }
  render();
})();
