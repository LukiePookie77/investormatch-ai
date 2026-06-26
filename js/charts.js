/* ============================================================
   charts.js — Self-contained SVG charts, gauges & meters.
   No external libraries; renders fully offline.
   ============================================================ */

const CHARTS = (() => {
  const NS = "http://www.w3.org/2000/svg";

  function scoreColor(v) {
    if (v >= 80) return "#26d07c";
    if (v >= 65) return "#3dd6c4";
    if (v >= 50) return "#5b8cff";
    if (v >= 38) return "#ffb547";
    return "#ff5d6c";
  }

  // ----- Sparkline (mini line chart) -----
  function sparkline(data, w = 290, h = 46) {
    const min = Math.min(...data), max = Math.max(...data);
    const rng = max - min || 1;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => [i * step, h - ((v - min) / rng) * (h - 6) - 3]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const up = data[data.length - 1] >= data[0];
    const col = up ? "#26d07c" : "#ff5d6c";
    const id = "g" + Math.abs(hash(data.join(",")));
    const area = `${d} L${w},${h} L0,${h} Z`;
    return `<svg class="spark" width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
  }

  // ----- Larger price chart with axis hints -----
  function priceChart(data, w = 560, h = 220) {
    const min = Math.min(...data), max = Math.max(...data);
    const rng = max - min || 1;
    const pad = 8;
    const iw = w - pad * 2, ih = h - pad * 2;
    const step = iw / (data.length - 1);
    const pts = data.map((v, i) => [pad + i * step, pad + ih - ((v - min) / rng) * ih]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const up = data[data.length - 1] >= data[0];
    const col = up ? "#26d07c" : "#ff5d6c";
    const area = `${d} L${pad + iw},${h - pad} L${pad},${h - pad} Z`;
    let grid = "";
    for (let i = 1; i < 4; i++) {
      const y = pad + (ih / 4) * i;
      grid += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#1a2436" stroke-width="1"/>`;
    }
    return `<svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block">
      <defs><linearGradient id="pc" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#pc)"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round"/>
    </svg>
    <div class="faint mono" style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px">
      <span>Low $${min.toFixed(2)}</span><span>~60 sessions (illustrative)</span><span>High $${max.toFixed(2)}</span>
    </div>`;
  }

  // ----- Circular score meter (gauge) -----
  function scoreMeter(value, size = 92, label = "") {
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const off = c * (1 - value / 100);
    const col = scoreColor(value);
    const cx = size / 2;
    return `<div class="score-meter" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#1a2436" stroke-width="7"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col}" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
          transform="rotate(-90 ${cx} ${cx})" style="transition:stroke-dashoffset .6s ease"/>
      </svg>
      <span class="sm-num" style="color:${col};font-size:${size*0.26}px">${value}</span>
      ${label ? `<span class="sm-sub">${label}</span>` : ""}
    </div>`;
  }

  // ----- Half-circle risk gauge -----
  function riskGauge(value, band, size = 180) {
    const w = size, h = size * 0.62;
    const cx = w / 2, cy = h - 6, r = w / 2 - 16;
    const ang = Math.PI * (value / 100);            // 0..PI
    const nx = cx - r * Math.cos(ang);
    const ny = cy - r * Math.sin(ang);
    const col = scoreColor(100 - value); // higher risk -> warmer; invert palette
    const warm = value >= 78 ? "#ff5d6c" : value >= 55 ? "#ffb547" : value >= 30 ? "#5b8cff" : "#26d07c";
    // colored arc segments
    const seg = (a0, a1, color) => {
      const x0 = cx - r * Math.cos(a0), y0 = cy - r * Math.sin(a0);
      const x1 = cx - r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
      return `<path d="M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round"/>`;
    };
    const P = Math.PI;
    return `<div class="gauge-wrap">
      <svg width="${w}" height="${h+10}">
        ${seg(P, P*0.75, "#26d07c")}
        ${seg(P*0.75, P*0.5, "#5b8cff")}
        ${seg(P*0.5, P*0.25, "#ffb547")}
        ${seg(P*0.25, 0, "#ff5d6c")}
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#e8edf5" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#e8edf5"/>
      </svg>
      <div class="gauge-value" style="color:${warm}">${band} · ${value}/100</div>
    </div>`;
  }

  // ----- Linear meter -----
  function meter(value, color) {
    const col = color || scoreColor(value);
    return `<div class="meter"><span style="width:${value}%;background:${col}"></span></div>`;
  }

  function hash(str) {
    let h = 0; for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h;
  }

  return { sparkline, priceChart, scoreMeter, riskGauge, meter, scoreColor };
})();

window.CHARTS = CHARTS;
