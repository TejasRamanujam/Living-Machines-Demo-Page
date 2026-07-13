/* ============================================================
   THE LIVING CATALOGUE — engine
   Five live Canvas 2D simulacra, one RAF, honest about frames:
   DPR capped at 2, offscreen scenes fully paused, reduced-motion
   renders a single settled frame per figure.
   ============================================================ */
(() => {
'use strict';

const RM  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const TAU = Math.PI * 2;

/* ---------- palette (read from CSS so it stays coherent) ---------- */
const rootStyle = getComputedStyle(document.documentElement);
const PAPER  = (rootStyle.getPropertyValue('--paper').trim()  || '#EFE9DE');
const INK    = (rootStyle.getPropertyValue('--ink').trim()    || '#191510');
const ACCENT = (rootStyle.getPropertyValue('--accent').trim() || '#E8490F');

function hexRgb(h){
  const s = h.replace('#','');
  const v = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
}
const P = hexRgb(PAPER), I = hexRgb(INK), A = hexRgb(ACCENT);
const paperA  = a => `rgba(${P[0]},${P[1]},${P[2]},${a})`;
const inkA    = a => `rgba(${I[0]},${I[1]},${I[2]},${a})`;
const accentA = a => `rgba(${A[0]},${A[1]},${A[2]},${a})`;

/* ---------- tiny math ---------- */
const clamp = (v,a,b) => v < a ? a : (v > b ? b : v);
const lerp  = (a,b,t) => a + (b - a) * t;
const rand  = (a,b) => a + Math.random() * (b - a);
function hash2(x,y){
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x,y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(
    lerp(hash2(xi,yi),   hash2(xi+1,yi),   u),
    lerp(hash2(xi,yi+1), hash2(xi+1,yi+1), u), v);
}
function fbm(x,y){
  return vnoise(x,y) * .58 + vnoise(x*2.13, y*2.13) * .28 + vnoise(x*4.41, y*4.41) * .14;
}

/* ============================================================
   Scene base
   ============================================================ */
class Scene {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.active = false;
    this.t = rand(0, 100);
    this.px = -1e4; this.py = -1e4; this.pin = false;
    this.lastReal = -1e9; /* scene-time of last real pointer input */
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      this.px = e.clientX - r.left; this.py = e.clientY - r.top;
      this.pin = true; this.lastReal = this.t;
    }, { passive:true });
    canvas.addEventListener('pointerdown', e => {
      const r = canvas.getBoundingClientRect();
      this.px = e.clientX - r.left; this.py = e.clientY - r.top;
      this.pin = true; this.lastReal = this.t;
    }, { passive:true });
    canvas.addEventListener('pointerleave', () => { this.pin = false; this.px = -1e4; this.py = -1e4; }, { passive:true });
    this.fit();
  }
  fit(){
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(2, Math.round(r.width));
    this.h = Math.max(2, Math.round(r.height));
    this.canvas.width  = Math.round(this.w * DPR);
    this.canvas.height = Math.round(this.h * DPR);
    this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    this.init();
  }
  clear(){
    this.ctx.fillStyle = PAPER;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
  warm(steps){
    for (let i = 0; i < steps; i++){ this.t += 1/60; this.frame(1/60); }
  }
  init(){}
  frame(){}
}

/* ============================================================
   01 · FLOW — pen-plotter flow field (The Working Drawing)
   ============================================================ */
class Flow extends Scene {
  init(){
    this.clear();
    this.seed = rand(0, 40);
    const n = clamp(Math.round(this.w * this.h / 2400), 140, 520);
    this.parts = [];
    for (let i = 0; i < n; i++) this.parts.push(this.spawn());
  }
  spawn(){
    return { x: rand(0, this.w), y: rand(0, this.h), life: rand(2.5, 8), acc: Math.random() < .055 };
  }
  frame(dt){
    const c = this.ctx, s = .0062, v = 36;
    c.fillStyle = paperA(clamp(dt * 2.2, .008, .08));
    c.fillRect(0, 0, this.w, this.h);
    c.lineWidth = 1;
    c.beginPath();
    const accSeg = [];
    for (const p of this.parts){
      let a = fbm(p.x * s + this.seed, p.y * s + this.t * .028) * TAU * 2;
      let boost = 1;
      if (this.pin){
        const dx = p.x - this.px, dy = p.y - this.py, d2 = dx*dx + dy*dy, R = 180;
        if (d2 < R * R){
          const f = 1 - Math.sqrt(d2) / R;
          a += f * 3.2 + Math.atan2(dy, dx) * f * 0.35;
          boost = 1 + f * 3.5;
        }
      }
      const nx = p.x + Math.cos(a) * v * boost * dt;
      const ny = p.y + Math.sin(a) * v * boost * dt;
      if (p.acc) accSeg.push(p.x, p.y, nx, ny);
      else { c.moveTo(p.x, p.y); c.lineTo(nx, ny); }
      p.x = nx; p.y = ny; p.life -= dt;
      if (p.life < 0 || nx < -4 || ny < -4 || nx > this.w + 4 || ny > this.h + 4){
        Object.assign(p, this.spawn(), { acc: p.acc });
      }
    }
    c.strokeStyle = inkA(.6);
    c.stroke();
    c.beginPath();
    for (let i = 0; i < accSeg.length; i += 4){
      c.moveTo(accSeg[i], accSeg[i+1]); c.lineTo(accSeg[i+2], accSeg[i+3]);
    }
    c.strokeStyle = accentA(.85);
    c.stroke();
  }
}

/* ============================================================
   02 · RESONANCE — voice orb (Connection)
   ============================================================ */
class Orb extends Scene {
  init(){ this.clear(); }
  frame(){
    const c = this.ctx;
    this.clear();
    const cx = this.w / 2, cy = this.h / 2;
    const R = Math.min(this.w, this.h) * .31;

    // speech-like envelope: bursts of "talking"
    const env  = clamp((fbm(this.t * .55, 7.3) - .38) * 3.2, 0, 1);
    const prox = this.pin ? clamp(1 - Math.hypot(this.px - cx, this.py - cy) / (R * 2.4), 0, 1) : 0;
    const level = clamp(.22 + env * .55 + prox * .55, 0, 1.25);

    // concentric distorted rings
    const RINGS = 22, SEG = 110;
    for (let k = 0; k < RINGS; k++){
      const rr = R * (.34 + (k / (RINGS - 1)) * .78);
      const amp = (3 + 15 * level) * (.35 + .65 * (k / RINGS));
      c.beginPath();
      for (let i = 0; i <= SEG; i++){
        const ang = (i / SEG) * TAU;
        const nx = Math.cos(ang) * 1.35, ny = Math.sin(ang) * 1.35;
        const off = (fbm(nx + k * .37, ny + this.t * .75) * 2 - 1) * amp;
        const r = rr + off;
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.closePath();
      if (k === 0){ c.strokeStyle = accentA(.95); c.lineWidth = 1.6; }
      else { c.strokeStyle = inkA(.16 + .3 * (1 - k / RINGS)); c.lineWidth = 1; }
      c.stroke();
    }

    // level meter ticks on the outer orbit
    const TICKS = 48, lit = Math.round(TICKS * clamp(level, 0, 1));
    for (let i = 0; i < TICKS; i++){
      const ang = (i / TICKS) * TAU - Math.PI / 2;
      const r0 = R * 1.28, r1 = r0 + (i < lit ? 9 : 5);
      c.beginPath();
      c.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      c.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      c.strokeStyle = i < lit ? accentA(.9) : inkA(.2);
      c.lineWidth = 1.4;
      c.stroke();
    }

    // core
    c.beginPath();
    c.arc(cx, cy, 3.5 + 7 * level, 0, TAU);
    c.fillStyle = ACCENT;
    c.fill();

    // status word
    c.font = `700 10px "Space Mono", monospace`;
    c.textAlign = 'center';
    c.fillStyle = inkA(.5);
    c.fillText(level > .55 ? 'SPEAKING' : 'LISTENING', cx, cy + R * 1.28 + 30);
  }
}

/* ============================================================
   03 · RETRIEVAL — the archive queries itself (Neuron)
   ============================================================ */
class Grid extends Scene {
  init(){
    this.clear();
    this.top = 54;
    this.cell = this.w < 420 ? 26 : 30;
    this.cols = Math.max(4, Math.floor((this.w - 40) / this.cell));
    this.rows = Math.max(4, Math.floor((this.h - this.top - 40) / this.cell));
    this.ox = (this.w - this.cols * this.cell) / 2 + this.cell / 2;
    this.oy = this.top + (this.h - this.top - this.rows * this.cell) / 2 + this.cell / 2;
    this.glow = new Float32Array(this.cols * this.rows);
    this.queries = [
      'force-directed graph', 'ray tracer from scratch', 'tiny sql engine',
      'build a rate limiter', 'wasm game of life', 'markov chain poet',
      'spaced repetition core', 'pathfinding visualizer'
    ];
    this.qi = Math.floor(rand(0, this.queries.length));
    this.qpos = 0; this.phase = 'type'; this.timer = 0; this.hits = 0;
  }
  frame(dt){
    const c = this.ctx;
    this.clear();
    const q = this.queries[this.qi];
    this.timer += dt;

    // matches narrow as the query grows: nested subsets via a fixed per-query hash
    const frac = .38 * Math.pow(.86, this.qpos);
    if (this.phase === 'type' && this.timer > .085){
      this.timer = 0; this.qpos++;
      // keystroke: flash the cells that just fell out of the result set
      const f0 = .38 * Math.pow(.86, this.qpos - 1);
      const f1 = .38 * Math.pow(.86, this.qpos);
      for (let i = 0; i < this.glow.length; i++){
        const r = hash2(i * .713, this.qi * 13.7);
        if (r < f0 && r >= f1) this.glow[i] = 1;
      }
      if (this.qpos >= q.length){ this.phase = 'hold'; this.hits = 0;
        for (let i = 0; i < this.glow.length; i++){
          if (hash2(i * .713, this.qi * 13.7) < frac) this.hits++;
        }
      }
    } else if (this.phase === 'hold' && this.timer > 1.9){
      this.timer = 0; this.phase = 'type'; this.qpos = 0;
      this.qi = (this.qi + 1) % this.queries.length;
    }

    // query line
    c.font = `700 12px "Space Mono", monospace`;
    c.textAlign = 'left';
    c.fillStyle = inkA(.85);
    const caret = (Math.floor(this.t * 2.4) % 2 === 0) ? '▋' : ' ';
    c.fillText('> ' + q.slice(0, this.qpos) + caret, 20, 30);
    c.textAlign = 'right';
    c.fillStyle = this.phase === 'hold' ? accentA(.95) : inkA(.4);
    c.fillText(this.phase === 'hold' ? this.hits + ' MATCHES' : 'SEARCHING…', this.w - 20, 30);
    c.beginPath(); c.moveTo(20, 42); c.lineTo(this.w - 20, 42);
    c.strokeStyle = inkA(.2); c.lineWidth = 1; c.stroke();

    // records
    let hi = -1, hd = 1e9;
    for (let j = 0; j < this.rows; j++){
      for (let i = 0; i < this.cols; i++){
        const idx = j * this.cols + i;
        const x = this.ox + i * this.cell, y = this.oy + j * this.cell;
        if (this.pin){
          const d = (x - this.px) ** 2 + (y - this.py) ** 2;
          if (d < hd){ hd = d; hi = idx; }
        }
        const lit = hash2(idx * .713, this.qi * 13.7) < frac;
        const base = lit ? .55 + .3 * Math.sin(this.t * 3 + idx) : 0;
        const g = Math.max(this.glow[idx], base);
        if (g > .02){
          c.beginPath(); c.arc(x, y, 1.6 + 4.5 * g, 0, TAU);
          c.fillStyle = accentA(.25 + .7 * g); c.fill();
          c.beginPath(); c.arc(x, y, 5 + 9 * (1 - g), 0, TAU);
          c.strokeStyle = accentA(g * .5); c.stroke();
        } else {
          c.beginPath(); c.arc(x, y, 1.5, 0, TAU);
          c.fillStyle = inkA(.3); c.fill();
        }
        this.glow[idx] *= (1 - dt * 1.4);
      }
    }
    // pointer = you, inspecting a record
    if (this.pin && hi >= 0 && hd < 60 ** 2){
      const x = this.ox + (hi % this.cols) * this.cell;
      const y = this.oy + Math.floor(hi / this.cols) * this.cell;
      c.beginPath(); c.arc(x, y, 8, 0, TAU);
      c.strokeStyle = inkA(.8); c.lineWidth = 1.2; c.stroke();
      this.glow[hi] = Math.max(this.glow[hi], .9);
    }
  }
}

/* ============================================================
   04 · CORTEX — force-directed knowledge graph (Neurosurge)
   ============================================================ */
class Graph extends Scene {
  init(){
    this.clear();
    const N = this.w < 420 ? 30 : 42;
    this.nodes = []; this.edges = []; this.deg = new Array(N).fill(0);
    for (let i = 0; i < N; i++){
      this.nodes.push({
        x: this.w / 2 + rand(-this.w, this.w) * .28,
        y: this.h / 2 + rand(-this.h, this.h) * .28,
        vx: 0, vy: 0
      });
    }
    for (let i = 1; i < N; i++){
      const j = Math.floor(rand(0, i));
      this.edges.push([i, j]); this.deg[i]++; this.deg[j]++;
    }
    for (let k = 0; k < Math.floor(N / 4); k++){
      const a = Math.floor(rand(0, N)), b = Math.floor(rand(0, N));
      if (a !== b){ this.edges.push([a, b]); this.deg[a]++; this.deg[b]++; }
    }
    this.hubs = [...this.deg.keys()].sort((a,b) => this.deg[b] - this.deg[a]).slice(0, 5);
    this.tags = ['#ml', '#notes', '#graphs', '#cards', '#pdf'];
    this.rest = Math.min(this.w, this.h) * .16;
    // settle before first paint
    for (let s = 0; s < 140; s++) this.step(1/60);
  }
  step(dt){
    const n = this.nodes, cx = this.w / 2, cy = this.h / 2;
    for (let i = 0; i < n.length; i++){
      const a = n[i];
      for (let j = i + 1; j < n.length; j++){
        const b = n[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx*dx + dy*dy; if (d2 < 25) d2 = 25;
        const f = 2600 / d2, d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      a.vx += (cx - a.x) * .012;
      a.vy += (cy - a.y) * .012;
      if (this.pin){
        const dx = this.px - a.x, dy = this.py - a.y, d = Math.hypot(dx, dy);
        if (d < 150 && d > 1){ const f = (1 - d / 150) * 2.2; a.vx += (dx / d) * f * 60 * dt * 10; a.vy += (dy / d) * f * 60 * dt * 10; }
      }
    }
    for (const [i, j] of this.edges){
      const a = n[i], b = n[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - this.rest) * .045;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const a of n){
      a.vx *= .86; a.vy *= .86;
      a.x += a.vx * dt * 3.4; a.y += a.vy * dt * 3.4;
      a.x = clamp(a.x, 14, this.w - 14);
      a.y = clamp(a.y, 14, this.h - 14);
    }
  }
  frame(dt){
    this.step(dt); this.step(dt);
    const c = this.ctx;
    this.clear();
    c.lineWidth = 1;
    c.strokeStyle = inkA(.28);
    c.beginPath();
    for (const [i, j] of this.edges){
      c.moveTo(this.nodes[i].x, this.nodes[i].y);
      c.lineTo(this.nodes[j].x, this.nodes[j].y);
    }
    c.stroke();
    c.font = `700 10px "Space Mono", monospace`;
    c.textAlign = 'left';
    for (let i = 0; i < this.nodes.length; i++){
      const a = this.nodes[i], hub = this.hubs.indexOf(i);
      const r = 2 + Math.min(6, this.deg[i] * .9);
      c.beginPath(); c.arc(a.x, a.y, r, 0, TAU);
      c.fillStyle = hub >= 0 ? ACCENT : inkA(.85);
      c.fill();
      if (hub >= 0){
        c.beginPath(); c.arc(a.x, a.y, r + 5, 0, TAU);
        c.strokeStyle = accentA(.45); c.stroke();
        c.fillStyle = inkA(.6);
        c.fillText(this.tags[hub], a.x + r + 8, a.y + 3);
      }
    }
  }
}

/* ============================================================
   05 · CHORUS — ghost collaborators drawing (Scribbly)
   ============================================================ */
class Chorus extends Scene {
  init(){
    this.clear();
    this.bots = ['mira', 'theo', 'aki', 'noor'].map((name, i) => ({
      name,
      x: rand(30, this.w - 30), y: rand(30, this.h - 60),
      tx: 0, ty: 0, t0: 0, dur: 0, sx: 0, sy: 0,
      mode: 'idle', wait: rand(0, 1.4),
      seed: rand(0, 100),
      col: i === 0 ? accentA(.9) : inkA(.34 + i * .16)
    }));
    this.strokes = [];
    this.userStroke = null;
    this.lastUser = 0;
    this.born = 0;
  }
  newStroke(col, user){
    const s = { pts: [], col, user: !!user, born: this.t };
    this.strokes.push(s);
    let total = 0;
    for (const st of this.strokes) total += st.pts.length;
    while (total > 3600 && this.strokes.length > 1){
      total -= this.strokes[0].pts.length;
      this.strokes.shift();
    }
    return s;
  }
  frame(dt){
    const c = this.ctx;
    this.clear();

    // bots plan + move
    for (const b of this.bots){
      if (b.mode === 'idle'){
        b.wait -= dt;
        if (b.wait <= 0){
          b.mode = 'move';
          b.sx = b.x; b.sy = b.y;
          b.tx = rand(30, this.w - 30); b.ty = rand(30, this.h - 70);
          b.t0 = 0; b.dur = rand(.5, 1.1);
        }
      } else if (b.mode === 'move'){
        b.t0 += dt;
        const k = clamp(b.t0 / b.dur, 0, 1), e = k * k * (3 - 2 * k);
        b.x = lerp(b.sx, b.tx, e); b.y = lerp(b.sy, b.ty, e);
        if (k >= 1){ b.mode = 'draw'; b.t0 = 0; b.dur = rand(.9, 2.2); b.stroke = this.newStroke(b.col); }
      } else { // draw
        b.t0 += dt;
        const ang = fbm(b.seed + b.t0 * .9, b.seed * .7) * TAU * 2 + Math.sin(b.t0 * 3 + b.seed) * .8;
        b.x = clamp(b.x + Math.cos(ang) * 90 * dt, 16, this.w - 16);
        b.y = clamp(b.y + Math.sin(ang) * 90 * dt, 16, this.h - 46);
        b.stroke.pts.push(b.x, b.y);
        if (b.t0 >= b.dur){ b.mode = 'idle'; b.wait = rand(.3, 1.6); }
      }
    }

    // user draws by hovering
    if (this.pin){
      if (!this.userStroke || this.t - this.lastUser > .35){
        this.userStroke = this.newStroke(accentA(.95), true);
      }
      const p = this.userStroke.pts;
      const n = p.length;
      if (n < 2 || Math.hypot(p[n-2] - this.px, p[n-1] - this.py) > 1.5){
        p.push(this.px, this.py);
      }
      this.lastUser = this.t;
    }

    // strokes with replay-style aging
    c.lineJoin = c.lineCap = 'round';
    for (const s of this.strokes){
      const age = this.t - s.born;
      const fade = age < 12 ? 1 : Math.max(.14, 1 - (age - 12) / 14);
      c.globalAlpha = fade;
      c.strokeStyle = s.col;
      c.lineWidth = s.user ? 2 : 1.6;
      c.beginPath();
      for (let i = 0; i < s.pts.length; i += 2){
        i === 0 ? c.moveTo(s.pts[i], s.pts[i+1]) : c.lineTo(s.pts[i], s.pts[i+1]);
      }
      c.stroke();
    }
    c.globalAlpha = 1;

    // timeline of stroke history
    const ty = this.h - 22;
    c.beginPath(); c.moveTo(20, ty); c.lineTo(this.w - 20, ty);
    c.strokeStyle = inkA(.25); c.lineWidth = 1; c.stroke();
    const span = 40;
    for (const s of this.strokes){
      const k = 1 - clamp((this.t - s.born) / span, 0, 1);
      const x = lerp(20, this.w - 20, k);
      c.beginPath(); c.moveTo(x, ty - 4); c.lineTo(x, ty + 4);
      c.strokeStyle = s.user ? accentA(.9) : inkA(.5);
      c.stroke();
    }
    c.font = `700 9px "Space Mono", monospace`;
    c.textAlign = 'left';
    c.fillStyle = inkA(.45);
    c.fillText('REPLAY ← 40s', 20, ty + 16);

    // cursors + name tags
    const drawCursor = (x, y, name, col, user) => {
      c.beginPath();
      c.moveTo(x, y); c.lineTo(x + 11, y + 4.5); c.lineTo(x + 4.5, y + 11);
      c.closePath();
      c.fillStyle = user ? ACCENT : INK; c.fill();
      c.font = `700 10px "Space Mono", monospace`;
      const wTag = c.measureText(name).width + 10;
      c.fillStyle = col;
      c.fillRect(x + 12, y + 10, wTag, 16);
      c.fillStyle = PAPER;
      c.fillText(name, x + 17, y + 22);
    };
    for (const b of this.bots) drawCursor(b.x, b.y, b.name, b.col === accentA(.9) ? accentA(.95) : inkA(.8), false);
    if (this.pin) drawCursor(this.px, this.py, 'you', ACCENT, true);
  }
}

/* ============================================================
   Orchestration
   ============================================================ */
const SCENES = { flow: Flow, orb: Orb, grid: Grid, graph: Graph, chorus: Chorus };
const scenes = [];
const COARSE = matchMedia('(pointer: coarse)').matches;

document.querySelectorAll('canvas[data-scene]').forEach(cv => {
  const Cls = SCENES[cv.dataset.scene];
  if (Cls) scenes.push(new Cls(cv));
});

/* visibility -> pause offscreen */
if (!RM){
  const io = new IntersectionObserver(entries => {
    for (const e of entries){
      const s = scenes.find(s => s.canvas === e.target);
      if (s) s.active = e.isIntersecting;
    }
  }, { rootMargin: '12%' });
  scenes.forEach(s => io.observe(s.canvas));
}

/* resize (debounced re-init) */
let rsT = 0;
window.addEventListener('resize', () => {
  clearTimeout(rsT);
  rsT = setTimeout(() => {
    scenes.forEach(s => { s.fit(); if (RM) s.warm(240); });
    vitalsSize();
  }, 160);
}, { passive:true });

/* ---------- hero kinetic type ---------- */
const h1 = document.getElementById('kinetic');
const chars = [];
if (h1 && !RM){
  const build = node => {
    const kids = [...node.childNodes];
    for (const k of kids){
      if (k.nodeType === 3){
        const frag = document.createDocumentFragment();
        for (const word of k.textContent.split(/(\s+)/)){
          if (!word) continue;
          if (/^\s+$/.test(word)){ frag.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span');
          w.className = 'wd';
          for (const ch of word){
            const sp = document.createElement('span');
            sp.className = 'ch';
            sp.textContent = ch;
            w.appendChild(sp);
            chars.push(sp);
          }
          frag.appendChild(w);
        }
        node.replaceChild(frag, k);
      } else if (k.nodeType === 1){
        build(k);
      }
    }
  };
  build(h1);
}
let heroVisible = true;
if (h1 && !RM){
  new IntersectionObserver(e => { heroVisible = e[0].isIntersecting; }).observe(h1);
}

/* ---------- vitals ---------- */
const vFps = document.getElementById('v-fps');
const vClock = document.getElementById('v-clock');
const vCursor = document.getElementById('v-cursor');
const vView = document.getElementById('v-view');
let mx = 0, my = 0;
window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive:true });
function vitalsSize(){
  if (vView) vView.textContent = `${window.innerWidth}×${window.innerHeight}`;
}
vitalsSize();
let frames = 0, fpsMark = performance.now();
setInterval(() => {
  const now = performance.now();
  if (vFps){
    if (RM) vFps.textContent = 'STILL';
    else {
      vFps.textContent = String(Math.min(999, Math.round(frames / ((now - fpsMark) / 1000)) || 0));
      frames = 0; fpsMark = now;
    }
  }
  if (vCursor) vCursor.textContent = `${Math.round(mx)},${Math.round(my)}`;
  if (vClock){
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    vClock.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}, RM ? 1000 : 500);

/* ---------- scroll progress ---------- */
const prog = document.querySelector('.progress');
function onScroll(){
  if (!prog) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  prog.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
}
window.addEventListener('scroll', onScroll, { passive:true });
onScroll();

/* ---------- reveal choreography ---------- */
const revealIO = new IntersectionObserver(entries => {
  for (const e of entries){
    if (e.isIntersecting){ e.target.classList.add('in'); revealIO.unobserve(e.target); }
  }
}, { threshold: .18 });
document.querySelectorAll('[data-reveal]').forEach(el => {
  if (RM) el.classList.add('in');
  else revealIO.observe(el);
});

/* ---------- main loop ---------- */
let last = performance.now();
function tick(now){
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  frames++;
  for (const s of scenes){
    if (s.active){
      s.t += dt;
      /* touch devices: a phantom cursor keeps the scene alive, updated
         every tick, yielding to real input for a couple of seconds */
      if (COARSE && s.t - s.lastReal > 2.5){
        s.px = s.w * (0.5 + 0.34 * Math.cos(s.t * 0.42));
        s.py = s.h * (0.5 + 0.3 * Math.sin(s.t * 0.31));
        s.pin = true;
      }
      s.frame(dt);
    }
  }
  /* skip the weight pulse on touch devices: it re-flows the headline's
     line breaks at random and burns battery for no hover payoff */
  if (heroVisible && chars.length && !COARSE){
    const t = now / 1000;
    for (let i = 0; i < chars.length; i++){
      const w = 430 + 240 * Math.sin(t * 1.5 + i * .42);
      chars[i].style.fontVariationSettings = `"opsz" 144, "SOFT" 0, "WONK" 1, "wght" ${Math.round(w)}`;
    }
  }
  requestAnimationFrame(tick);
}

function start(){
  if (RM){
    scenes.forEach(s => s.warm(260));
  } else {
    requestAnimationFrame(t => { last = t; tick(t); });
  }
}
let launched = false;
function launch(){ if (launched) return; launched = true; start(); }
if (document.fonts && document.fonts.ready){
  document.fonts.ready.then(launch);
  setTimeout(launch, 2500); /* safety if fonts hang */
} else {
  launch();
}

})();


/* ---------- plate navigation hotkeys: J/K next-prev, 1-5 jump ---------- */
(() => {
  const plates = [...document.querySelectorAll('section.plate')];
  if (!plates.length) return;
  const current = () => {
    const mid = innerHeight / 2;
    let best = 0, bd = Infinity;
    plates.forEach((pl, i) => {
      const r = pl.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bd){ bd = d; best = i; }
    });
    return best;
  };
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'j') plates[Math.min(current() + 1, plates.length - 1)].scrollIntoView({ behavior: 'smooth' });
    else if (k === 'k') plates[Math.max(current() - 1, 0)].scrollIntoView({ behavior: 'smooth' });
    else if (/^[1-9]$/.test(k) && plates[+k - 1]) plates[+k - 1].scrollIntoView({ behavior: 'smooth' });
  });
})();
