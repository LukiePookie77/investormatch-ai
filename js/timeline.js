/* ============================================================
   timeline.js — Zoomable, interactive stock timeline.
   - Timeframe buttons (1D…Max)
   - Wheel zoom (desktop), pinch zoom (mobile), draggable range
     brush, double-click reset
   - Hover tooltip (date / price / volume / signal)
   - Computes timeframe-aware technical metrics + AI summary and
     emits them via onChange so hosts can re-score strategies.
   Deterministic illustrative data — no live feed. Educational.
   ============================================================ */

const TIMELINE = (() => {
  const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
  const round = Math.round;
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  let uid = 0;

  const TFS = [
    { key: "1D", mode: "intra", days: 1 }, { key: "5D", mode: "intra", days: 5 },
    { key: "1M", mode: "daily", days: 22 }, { key: "3M", mode: "daily", days: 66 },
    { key: "6M", mode: "daily", days: 132 }, { key: "YTD", mode: "daily", days: 115 },
    { key: "1Y", mode: "daily", days: 252 }, { key: "5Y", mode: "daily", days: 1260 },
    { key: "Max", mode: "daily", days: 1300 },
  ];

  // Timeframe -> Yahoo range/interval (used when the backend is available).
  const TF_RANGE = {
    "1D": { range: "1d", interval: "5m", intra: true },
    "5D": { range: "5d", interval: "15m", intra: true },
    "1M": { range: "1mo", interval: "1d" }, "3M": { range: "3mo", interval: "1d" },
    "6M": { range: "6mo", interval: "1d" }, "YTD": { range: "ytd", interval: "1d" },
    "1Y": { range: "1y", interval: "1d" }, "5Y": { range: "5y", interval: "1wk" },
    "Max": { range: "max", interval: "1mo" },
  };
  const histCache = {};   // "SYM|TF" -> { pts, mode, real:true }

  const dailyCache = {};
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff; return h; }

  function fullDaily(stock) {
    if (dailyCache[stock.symbol]) return dailyCache[stock.symbol];
    const n = 1300; let seed = hash(stock.symbol);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const last = stock.price;
    const drift = (stock.tech.trend - 50) / 50 * last * 0.0009;
    const sigma = (0.008 + stock.tech.volatility / 100 * 0.02) * last;
    let price = Math.max(last * 0.2, last - drift * n * 0.6);
    const capScale = stock.capB ? Math.min(40, Math.max(2, stock.capB / 8)) : 4;
    const nowS = Math.floor(Date.now() / 1000);
    const pts = [];
    for (let i = 0; i < n; i++) {
      price += drift + (rnd() - 0.5) * 2 * sigma;
      if (price < last * 0.12) price = last * 0.12;
      const cyc = 0.5 + 0.5 * Math.abs(Math.sin(i / 28));
      const volume = Math.round((0.5 + rnd() * 0.9 + cyc * 0.5) * 1e6 * capScale);
      pts.push({ price: +price.toFixed(2), volume, t: nowS - (n - 1 - i) * 86400 });
    }
    pts[n - 1].price = last;
    return (dailyCache[stock.symbol] = pts);
  }

  function intraday(stock, days) {
    const perDay = 26, n = days * perDay; let seed = hash(stock.symbol + "i" + days);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const last = stock.price;
    const drift = (stock.tech.momentum - 50) / 50 * last * 0.0006;
    const sigma = (0.0012 + stock.tech.volatility / 100 * 0.004) * last;
    let price = last - drift * n * 0.5;
    const nowS = Math.floor(Date.now() / 1000);
    const pts = [];
    for (let i = 0; i < n; i++) {
      price += drift + (rnd() - 0.5) * 2 * sigma;
      const volume = Math.round((0.4 + rnd()) * 4e5);
      pts.push({ price: +price.toFixed(2), volume, t: nowS - (n - 1 - i) * 15 * 60 });
    }
    pts[n - 1].price = last;
    return pts;
  }

  function series(stock, tfKey) {
    const tf = TFS.find(t => t.key === tfKey) || TFS[6];
    if (tf.mode === "intra") return { pts: intraday(stock, tf.days), mode: "intra" };
    const all = fullDaily(stock);
    return { pts: all.slice(Math.max(0, all.length - tf.days)), mode: "daily" };
  }

  // Date label from a point's real timestamp (works for both real & synthetic).
  function fmtDate(pt, mode) {
    const d = pt && pt.t ? new Date(pt.t * 1000) : new Date();
    if (mode === "intra") return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // Timeframe-aware technical metrics from a slice of points.
  function metricsFor(pts) {
    const p = pts.map(x => x.price), n = p.length;
    if (n < 2) return { trend: 50, momentum: 50, volatility: 50, volumeTrend: 50, breakout: 50, relStrength: 50 };
    const chg = (p[n - 1] - p[0]) / p[0];
    const trend = clamp(50 + chg * 170);
    const k = Math.max(2, Math.floor(n * 0.25));
    const recent = (p[n - 1] - p[n - k]) / p[n - k];
    const momentum = clamp(50 + recent * 280);
    const rets = []; for (let i = 1; i < n; i++) rets.push((p[i] - p[i - 1]) / p[i - 1]);
    const m = avg(rets), sd = Math.sqrt(avg(rets.map(r => (r - m) ** 2)));
    const volatility = clamp(sd * 1500);
    const v = pts.map(x => x.volume), third = Math.max(1, Math.floor(n / 3));
    const early = avg(v.slice(0, third)) || 1, late = avg(v.slice(-third));
    const volumeTrend = clamp(50 + (late - early) / early * 55);
    const hi = Math.max(...p), lo = Math.min(...p);
    const breakout = clamp((p[n - 1] - lo) / ((hi - lo) || 1) * 100);
    const relStrength = clamp((trend + momentum) / 2);
    return { trend: round(trend), momentum: round(momentum), volatility: round(volatility),
      volumeTrend: round(volumeTrend), breakout: round(breakout), relStrength: round(relStrength), hi, lo };
  }

  function lvl(v) { return v >= 67 ? "strong" : v >= 45 ? "moderate" : "weak"; }
  function aiSummary(stock, pts, tfKey) {
    const m = metricsFor(pts), n = pts.length, p = pts.map(x => x.price);
    const chg = ((p[n - 1] - p[0]) / p[0] * 100);
    const last = p[n - 1];
    return {
      trend: `Over ${tfKey}, price ${chg >= 0 ? "rose" : "fell"} ${Math.abs(chg).toFixed(1)}% — ${m.trend > 58 ? "a clear uptrend" : m.trend < 42 ? "a downtrend" : "a sideways range"}.`,
      momentum: `Momentum is ${lvl(m.momentum)} (${m.momentum}/100) on this timeframe.`,
      volatility: `Volatility is ${lvl(m.volatility)} (${m.volatility}/100) — ${m.volatility > 60 ? "expect larger swings" : "relatively contained"}.`,
      volume: `Volume is ${m.volumeTrend > 55 ? "rising into the move" : m.volumeTrend < 45 ? "fading" : "steady"} (${m.volumeTrend}/100).`,
      sr: `Support ≈ $${m.lo.toFixed(2)}, resistance ≈ $${m.hi.toFixed(2)} (last $${last.toFixed(2)}).`,
      entry: m.trend > 55 ? `Entry logic: buy pullbacks toward support; trail stops as it rises.`
        : m.trend < 45 ? `Entry logic: avoid longs; wait for a base to form near support.`
        : `Entry logic: range tactics — buy near support, trim near resistance.`,
      risk: m.volatility > 65 ? "Risk: high — size down and widen stops." : m.volatility > 45 ? "Risk: moderate." : "Risk: lower on this timeframe.",
      metrics: m,
    };
  }

  // Downsample for path rendering only.
  function downsample(pts, max) {
    if (pts.length <= max) return pts;
    const step = pts.length / max, out = [];
    for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
    out.push(pts[pts.length - 1]); return out;
  }

  function chartSVG(pts, w, h) {
    const dp = downsample(pts, 360);
    const p = dp.map(x => x.price), min = Math.min(...p), max = Math.max(...p), rng = (max - min) || 1;
    const padB = 26; const ih = h - padB;
    const X = i => (i / (dp.length - 1)) * w;
    const Y = v => ih - ((v - min) / rng) * (ih - 6) - 3;
    const up = p[p.length - 1] >= p[0], col = up ? "#26d07c" : "#ff5d6c";
    const line = dp.map((q, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(q.price).toFixed(1)}`).join(" ");
    const area = `${line} L${w},${ih} L0,${ih} Z`;
    const vmax = Math.max(...dp.map(x => x.volume)) || 1;
    let vol = "";
    dp.forEach((q, i) => { const bh = (q.volume / vmax) * (padB - 6); vol += `<rect x="${X(i) - 1}" y="${h - bh}" width="2" height="${bh}" fill="#2a3a55"/>`; });
    let grid = "";
    for (let i = 1; i < 4; i++) grid += `<line x1="0" y1="${(ih / 4) * i}" x2="${w}" y2="${(ih / 4) * i}" stroke="#1a2436"/>`;
    const id = "tlg" + (uid);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.28"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}${vol}
      <path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  function brushSVG(allPts, lo, hi, w, h) {
    const dp = downsample(allPts, 240);
    const p = dp.map(x => x.price), min = Math.min(...p), max = Math.max(...p), rng = (max - min) || 1;
    const line = dp.map((q, i) => `${i ? "L" : "M"}${(i / (dp.length - 1) * w).toFixed(1)},${(h - ((q.price - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
    const L = allPts.length - 1;
    const x0 = lo / L * w, x1 = hi / L * w;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">
      <path d="${line}" fill="none" stroke="#5b8cff" stroke-width="1.4" opacity="0.8"/>
      <rect x="0" y="0" width="${x0}" height="${h}" fill="rgba(8,12,20,.6)"/>
      <rect x="${x1}" y="0" width="${w - x1}" height="${h}" fill="rgba(8,12,20,.6)"/>
      <rect x="${x0}" y="0" width="${Math.max(2, x1 - x0)}" height="${h}" fill="rgba(61,214,196,.10)" stroke="var(--accent)" stroke-width="1"/>
    </svg>`;
  }

  function mount(container, stock, opts = {}) {
    const my = ++uid;
    const st = { tf: opts.initialTf || "1Y", lo: 0, hi: 0, pts: [], mode: "daily" };

    container.innerHTML = `
      <div class="tl">
        <div class="tl-tfs glass" id="tlt${my}">
          ${TFS.map(t => `<button class="tl-tf" data-tf="${t.key}">${t.key}</button>`).join("")}
        </div>
        <div class="tl-chart" id="tlc${my}">
          <div class="tl-plot" id="tlp${my}"></div>
          <div class="tl-cross" id="tlx${my}"></div>
          <div class="tl-tip hidden" id="tli${my}"></div>
        </div>
        <div class="tl-dates" id="tld${my}"></div>
        <div class="tl-zoom glass" id="tlz${my}">
          <button class="tl-zbtn" data-z="out" title="Zoom out">−</button>
          <input class="tl-zrange" type="range" min="0" max="100" value="0" id="tlr${my}" title="Zoom">
          <button class="tl-zbtn" data-z="in" title="Zoom in">+</button>
          <button class="tl-zbtn" data-z="reset" title="Reset zoom">⟳</button>
        </div>
        <div class="tl-scroll" id="tls${my}">
          <span class="tl-plabel" title="Scroll back in time">⟵</span>
          <input class="tl-prange" type="range" min="0" max="100" value="100" id="tlpr${my}" title="Scroll through the timeline">
          <span class="tl-plabel" title="Scroll forward in time">⟶</span>
        </div>
        <div class="tl-brush" id="tlb${my}" title="Drag the highlighted window to pan"></div>
        <div class="tl-hint faint">Zoom with the wheel · scroll through time with the slider above · double-click to reset</div>
      </div>`;

    const plot = container.querySelector(`#tlp${my}`);
    const cross = container.querySelector(`#tlx${my}`);
    const tip = container.querySelector(`#tli${my}`);
    const brush = container.querySelector(`#tlb${my}`);
    const tfbar = container.querySelector(`#tlt${my}`);
    const chartBox = container.querySelector(`#tlc${my}`);
    const zrange = container.querySelector(`#tlr${my}`);
    const zbar = container.querySelector(`#tlz${my}`);
    const prange = container.querySelector(`#tlpr${my}`);

    function syncPan() {
      if (!prange) return;
      const room = (st.pts.length - 1) - (st.hi - st.lo);
      if (room <= 0) { prange.value = 100; prange.disabled = true; }
      else { prange.disabled = false; prange.value = Math.round(st.lo / room * 100); }
    }
    function scrollToPct(v) {
      const win = st.hi - st.lo, room = (st.pts.length - 1) - win;
      if (room <= 0) return;
      const lo = Math.round(v / 100 * room);
      setWindow(lo, lo + win);
    }

    function minWin() { return Math.max(8, Math.floor(st.pts.length * 0.03)); }
    function syncZoom() {
      const full = st.pts.length, mw = minWin(), win = st.hi - st.lo;
      if (zrange) zrange.value = Math.round(clamp((full - win) / ((full - mw) || 1) * 100, 0, 100));
    }
    function zoomToLevel(v) {
      const full = st.pts.length, mw = minWin();
      const win = Math.round(full - (v / 100) * (full - mw));
      const c = (st.lo + st.hi) / 2;
      setWindow(c - win / 2, c + win / 2);
    }

    function vis() { return st.pts.slice(st.lo, st.hi + 1); }
    function emit() {
      const v = vis();
      opts.onChange && opts.onChange({ tf: st.tf, points: v, metrics: metricsFor(v), summary: aiSummary(stock, v, st.tf), zoomed: !(st.lo === 0 && st.hi === st.pts.length - 1) });
    }
    function renderChart() {
      plot.innerHTML = chartSVG(vis(), 600, 200);
      plot.style.animation = "none"; void plot.offsetWidth; plot.style.animation = "tlFade .35s ease";
      brush.innerHTML = brushSVG(st.pts, st.lo, st.hi, 600, 46);
      tfbar.querySelectorAll(".tl-tf").forEach(b => b.classList.toggle("active", b.dataset.tf === st.tf));
      // x-axis date labels
      const dEl = container.querySelector(`#tld${my}`);
      if (dEl) {
        const v = vis(), n = v.length, picks = 5; let html = "";
        for (let i = 0; i < picks; i++) {
          const idx = Math.round(i / (picks - 1) * (n - 1));
          html += `<span>${fmtDate(v[idx], st.mode)}</span>`;
        }
        dEl.innerHTML = html;
      }
      syncZoom();
      syncPan();
    }
    function applySeries(s) { st.pts = s.pts; st.mode = s.mode; st.lo = 0; st.hi = s.pts.length - 1; renderChart(); emit(); }
    function setTf(tf) {
      st.tf = tf;
      const ck = stock.symbol + "|" + tf;
      if (histCache[ck]) { applySeries(histCache[ck]); return; }   // real data already loaded
      applySeries(series(stock, tf));                              // show synthetic immediately
      const cfg = TF_RANGE[tf];
      if (window.__BACKEND && cfg) {                               // then fetch real Yahoo history
        const badge = container.querySelector(`#tlt${my}`);
        if (badge) badge.classList.add("tl-loading");
        fetch(`api/history?symbol=${encodeURIComponent(stock.symbol)}&range=${cfg.range}&interval=${cfg.interval}`)
          .then(r => r.ok ? r.json() : null)
          .then(h => {
            if (badge) badge.classList.remove("tl-loading");
            if (h && h.points && h.points.length > 3 && st.tf === tf) {
              const real = { pts: h.points.map(p => ({ price: p.price, volume: p.volume || 0, t: p.t })), mode: cfg.intra ? "intra" : "daily", real: true };
              histCache[ck] = real;
              applySeries(real);
            }
          })
          .catch(() => { if (badge) badge.classList.remove("tl-loading"); });
      }
    }
    function setWindow(lo, hi) {
      lo = Math.max(0, Math.round(lo)); hi = Math.min(st.pts.length - 1, Math.round(hi));
      if (hi - lo < 4) return;
      st.lo = lo; st.hi = hi; renderChart(); emit();
    }
    function zoomAt(frac, factor) {
      const L = st.hi - st.lo, center = st.lo + frac * L;
      const nl = L * factor;
      setWindow(center - nl * frac, center + nl * (1 - frac));
    }

    tfbar.querySelectorAll(".tl-tf").forEach(b => b.addEventListener("click", () => setTf(b.dataset.tf)));

    // wheel zoom — gentle, normalized across devices
    chartBox.addEventListener("wheel", e => {
      e.preventDefault();
      const r = chartBox.getBoundingClientRect();
      const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
      const dir = e.deltaY > 0 ? 1 : -1;
      zoomAt(frac, dir > 0 ? 1.07 : 0.935);
    }, { passive: false });

    // zoom wheel control (slider + buttons)
    if (zrange) zrange.addEventListener("input", e => zoomToLevel(+e.target.value));
    if (prange) prange.addEventListener("input", e => scrollToPct(+e.target.value));
    if (zbar) zbar.querySelectorAll(".tl-zbtn").forEach(b => b.addEventListener("click", () => {
      const z = b.dataset.z;
      if (z === "reset") { st.lo = 0; st.hi = st.pts.length - 1; renderChart(); emit(); }
      else { const cur = +(zrange ? zrange.value : 0); zoomToLevel(clamp(cur + (z === "in" ? 12 : -12), 0, 100)); }
    }));

    // double-click reset
    chartBox.addEventListener("dblclick", () => { st.lo = 0; st.hi = st.pts.length - 1; renderChart(); emit(); });

    // drag-to-pan + hover tooltip (pointer events)
    let panning = null;
    chartBox.addEventListener("pointerdown", e => {
      if (e.pointerType === "touch") return;            // let touch use pinch/brush
      panning = { x: e.clientX, lo: st.lo, hi: st.hi };
      chartBox.setPointerCapture(e.pointerId);
      chartBox.classList.add("grabbing");
      cross.style.display = "none"; tip.classList.add("hidden");
    });
    chartBox.addEventListener("pointermove", e => {
      const r = chartBox.getBoundingClientRect();
      if (panning) {
        const win = panning.hi - panning.lo;
        let shift = (panning.x - e.clientX) / r.width * win;
        shift = Math.max(-panning.lo, Math.min((st.pts.length - 1) - panning.hi, shift));
        setWindow(panning.lo + shift, panning.hi + shift);
        return;
      }
      const v = vis(); if (!v.length) return;
      const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
      const idx = Math.round(frac * (v.length - 1));
      const pt = v[idx]; if (!pt) return;
      cross.style.left = (frac * 100) + "%"; cross.style.display = "block";
      const date = fmtDate(pt, st.mode);
      const sig = pt.price >= v[0].price ? "▲ above period open" : "▼ below period open";
      tip.classList.remove("hidden");
      tip.innerHTML = `<b>$${pt.price.toFixed(2)}</b><span>${date}</span><span>Vol ${(pt.volume / 1e6).toFixed(2)}M</span><span class="${pt.price >= v[0].price ? 'pos' : 'neg'}">${sig}</span>`;
      const tx = Math.min(r.width - 130, Math.max(0, e.clientX - r.left + 12));
      tip.style.left = tx + "px";
    });
    const endPan = () => { panning = null; chartBox.classList.remove("grabbing"); };
    chartBox.addEventListener("pointerup", endPan);
    chartBox.addEventListener("pointercancel", endPan);
    chartBox.addEventListener("mouseleave", () => { cross.style.display = "none"; tip.classList.add("hidden"); });

    // pinch zoom (touch)
    let pinch = null;
    chartBox.addEventListener("touchstart", e => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
    chartBox.addEventListener("touchmove", e => {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const f = 1 + (pinch / d - 1) * 0.6;             // dampened
        zoomAt(0.5, f); pinch = d;
      }
    }, { passive: false });
    chartBox.addEventListener("touchend", () => { pinch = null; });

    // draggable range brush
    let drag = null;
    function brushFrac(clientX) { const r = brush.getBoundingClientRect(); return clamp((clientX - r.left) / r.width, 0, 1); }
    brush.addEventListener("pointerdown", e => {
      const L = st.pts.length - 1, f = brushFrac(e.clientX) * L;
      const x0 = st.lo, x1 = st.hi;
      const edge = (st.pts.length) * 0.02;
      let mode = "move";
      if (Math.abs(f - x0) < Math.max(6, edge)) mode = "lo";
      else if (Math.abs(f - x1) < Math.max(6, edge)) mode = "hi";
      else if (f < x0 || f > x1) { const half = (x1 - x0) / 2; setWindow(f - half, f + half); }
      drag = { mode, startF: f, lo0: st.lo, hi0: st.hi };
      brush.setPointerCapture(e.pointerId);
    });
    brush.addEventListener("pointermove", e => {
      if (!drag) return;
      const L = st.pts.length - 1, f = brushFrac(e.clientX) * L, d = f - drag.startF;
      if (drag.mode === "move") setWindow(drag.lo0 + d, drag.hi0 + d);
      else if (drag.mode === "lo") setWindow(f, drag.hi0);
      else setWindow(drag.lo0, f);
    });
    brush.addEventListener("pointerup", () => { drag = null; });
    brush.addEventListener("pointercancel", () => { drag = null; });

    setTf(st.tf);
    return { setTf, getState: () => st };
  }

  // Build a stock clone whose tech metrics reflect a timeframe slice.
  function stockAt(stock, points) {
    const m = metricsFor(points);
    return { ...stock, tech: { ...stock.tech, trend: m.trend, momentum: m.momentum, volatility: m.volatility,
      volumeTrend: m.volumeTrend, breakout: m.breakout, relStrength: m.relStrength } };
  }

  return { mount, metricsFor, aiSummary, stockAt, series, TFS };
})();

window.TIMELINE = TIMELINE;
