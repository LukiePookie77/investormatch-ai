/* ============================================================
   learn.js — "AI Tutor" lesson + diagram generator.
   Teaches HOW to use every method in the taxonomy with an
   annotated illustrative SVG graph and a structured lesson.
   Educational only — illustrative diagrams, not live data.
   ============================================================ */

const LEARN = (() => {
  const W = 600, H = 240, PAD = 32;
  const X = x => PAD + x * (W - 2 * PAD);            // x in 0..1
  const Y = y => (H - PAD) - y * (H - 2 * PAD);      // y in 0..1 (0 bottom)

  function frame(inner, sub) {
    let grid = "";
    for (let i = 1; i < 4; i++) grid += `<line x1="${PAD}" y1="${Y(i/4)}" x2="${W-PAD}" y2="${Y(i/4)}" stroke="#1a2436"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;background:linear-gradient(180deg,#0f1521,#131b2b);border:1px solid #22304a;border-radius:12px">
      ${grid}
      <line x1="${PAD}" y1="${Y(0)}" x2="${W-PAD}" y2="${Y(0)}" stroke="#2a3a55"/>
      <line x1="${PAD}" y1="${Y(0)}" x2="${PAD}" y2="${PAD}" stroke="#2a3a55"/>
      ${inner}
      ${sub ? `<text x="${W/2}" y="${H-6}" fill="#64748b" font-size="11" text-anchor="middle">${sub}</text>` : ""}
    </svg>`;
  }
  const poly = (pts, color, w = 2.4) =>
    `<path d="${pts.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round"/>`;
  const dash = (x1,y1,x2,y2,color="#9aa8c0") =>
    `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  const dot = (x,y,color) => `<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="${color}"/>`;
  const tag = (x,y,t,color="#e8edf5",anchor="middle") =>
    `<text x="${X(x)}" y="${Y(y)}" fill="${color}" font-size="11.5" font-weight="600" text-anchor="${anchor}">${t}</text>`;
  const buyMark = (x,y) => `${dot(x,y,'#26d07c')}<text x="${X(x)}" y="${Y(y)+18}" fill="#26d07c" font-size="11" font-weight="700" text-anchor="middle">BUY</text>`;
  const sellMark = (x,y) => `${dot(x,y,'#ff5d6c')}<text x="${X(x)}" y="${Y(y)-12}" fill="#ff5d6c" font-size="11" font-weight="700" text-anchor="middle">SELL</text>`;

  // wavy price line generator around a base trajectory
  function wave(n, base, amp, seed = 7) {
    const out = []; let s = seed;
    for (let i = 0; i <= n; i++) {
      s = (s * 9301 + 49297) % 233280; const r = s / 233280;
      const x = i / n;
      out.push([x, Math.max(0.05, Math.min(0.95, base(x) + (r - 0.5) * amp))]);
    }
    return out;
  }

  /* ---------------- Diagram dispatcher ---------------- */
  function diagram(key) {
    if (key && key.startsWith("payoff:")) return payoff(key.slice(7));
    switch (key) {
      case "uptrend": return diagUptrend();
      case "downtrend": return diagDowntrend();
      case "range": return diagRange();
      case "breakout": return diagBreakout();
      case "meanrev": return diagMeanRev();
      case "ma": return diagMA();
      case "oscillator": return diagOscillator();
      case "volume": return diagVolume();
      case "valuation": return diagValuation();
      case "allocation": return diagAllocation();
      case "spread": return diagSpread();
      case "event": return diagEvent();
      case "sentiment": return diagSentiment();
      case "risk": return diagRisk();
      case "signal": return diagSignal();
      case "timeframe": return diagTimeframe();
      case "hns": return diagHNS(false);
      case "invhns": return diagHNS(true);
      case "doubletop": return diagDouble(true);
      case "doublebottom": return diagDouble(false);
      case "triangle_asc": return diagTriangle("asc");
      case "triangle_desc": return diagTriangle("desc");
      case "triangle_sym": return diagTriangle("sym");
      case "cuphandle": return diagCupHandle();
      case "flag": return diagFlag();
      case "wedge": return diagWedge();
      case "rectangle": return diagRange("Rectangle / Box");
      default: return diagGeneric();
    }
  }

  function diagUptrend() {
    const p = wave(40, x => 0.25 + x * 0.55, 0.06);
    return frame(`${poly(p,'#26d07c')}${dash(0,0.22,1,0.78,'#3dd6c4')}
      ${tag(0.18,0.82,'higher highs','#26d07c')}${buyMark(0.30,0.42)}
      ${tag(0.8,0.86,'ride the trend','#9aa8c0')}`, "Uptrend — buy pullbacks, hold while structure rises");
  }
  function diagDowntrend() {
    const p = wave(40, x => 0.8 - x * 0.55, 0.06);
    return frame(`${poly(p,'#ff5d6c')}${sellMark(0.30,0.6)}${tag(0.7,0.18,'lower lows','#ff5d6c')}`,
      "Downtrend — avoid longs; short rallies only if experienced");
  }
  function diagRange(title) {
    const p = wave(48, x => 0.5 + Math.sin(x*Math.PI*4)*0.16, 0.03);
    return frame(`${dash(0,0.7,1,0.7,'#ff5d6c')}${dash(0,0.3,1,0.3,'#26d07c')}${poly(p,'#5b8cff')}
      ${tag(0.5,0.76,'resistance','#ff5d6c')}${tag(0.5,0.24,'support','#26d07c')}
      ${buyMark(0.12,0.32)}${sellMark(0.37,0.68)}`, (title||"Range") + " — buy support, sell resistance");
  }
  function diagBreakout() {
    const p = wave(48, x => x < 0.6 ? 0.5 + Math.sin(x*Math.PI*5)*0.08 : 0.58 + (x-0.6)*1.0, 0.03);
    return frame(`${dash(0,0.6,0.6,0.6,'#ff5d6c')}${poly(p,'#3dd6c4')}
      ${tag(0.3,0.66,'consolidation','#9aa8c0')}${buyMark(0.64,0.66)}${tag(0.85,0.92,'breakout','#26d07c')}`,
      "Breakout — enter as price closes above resistance on rising volume");
  }
  function diagMeanRev() {
    const p = wave(60, x => 0.5 + Math.sin(x*Math.PI*3)*0.22, 0.03);
    return frame(`${dash(0,0.78,1,0.78,'#ff5d6c')}${dash(0,0.5,1,0.5,'#64748b')}${dash(0,0.22,1,0.22,'#26d07c')}
      ${poly(p,'#b07bff')}${tag(0.5,0.84,'overbought','#ff5d6c')}${tag(0.5,0.16,'oversold','#26d07c')}
      ${buyMark(0.165,0.28)}${sellMark(0.5,0.72)}`, "Mean reversion — fade extremes back toward the average");
  }
  function diagMA() {
    const p = wave(50, x => 0.35 + x*0.35 + Math.sin(x*Math.PI*4)*0.06, 0.03);
    const fast = p.map((q,i)=>[q[0], 0.35 + q[0]*0.35 + Math.sin(q[0]*Math.PI*4)*0.03]);
    const slow = p.map(q=>[q[0], 0.4 + q[0]*0.3]);
    return frame(`${poly(p,'#5b8cff',1.6)}${poly(fast,'#3dd6c4',2)}${poly(slow,'#ffb547',2)}
      ${buyMark(0.34,0.52)}${tag(0.8,0.9,'fast > slow = bullish','#3dd6c4')}`,
      "Moving averages — golden cross (fast over slow) signals momentum up");
  }
  function diagOscillator() {
    const p = wave(50, x => 0.7 + Math.sin(x*Math.PI*3)*0.12, 0.02);
    const osc = wave(50, x => 0.3 + Math.sin(x*Math.PI*3 - 0.4)*0.22, 0.02);
    return frame(`${poly(p,'#5b8cff',1.8)}
      <rect x="${PAD}" y="${Y(0.34)}" width="${W-2*PAD}" height="${Y(0.02)-Y(0.34)}" fill="#0a0e17" opacity="0.5"/>
      ${dash(0,0.30,1,0.30,'#ff5d6c')}${dash(0,0.06,1,0.06,'#26d07c')}${poly(osc,'#b07bff',2)}
      ${tag(0.12,0.32,'70','#ff5d6c','start')}${tag(0.12,0.08,'30','#26d07c','start')}`,
      "Oscillator (RSI/Stoch) — readings >70 overbought, <30 oversold");
  }
  function diagVolume() {
    const p = wave(40, x => 0.45 + x*0.3, 0.05);
    let bars = "";
    for (let i = 0; i < 24; i++) { const h = 0.05 + ((i*7)%10)/10*0.18 + (i>16?0.12:0); const x = i/24;
      bars += `<rect x="${X(x)}" y="${Y(h)}" width="${(W-2*PAD)/26}" height="${Y(0)-Y(h)}" fill="${i>16?'#26d07c':'#2a3a55'}"/>`; }
    return frame(`${bars}${poly(p,'#5b8cff')}${tag(0.82,0.9,'volume surge','#26d07c')}`,
      "Volume — rising volume confirms a move; thin volume warns of fakeouts");
  }
  function diagValuation() {
    const data = [["Price",0.75,'#ff5d6c'],["Fair value",0.5,'#3dd6c4'],["Peers",0.6,'#5b8cff']];
    let bars = ""; data.forEach((d,i)=>{ const x=0.2+i*0.25; bars +=
      `<rect x="${X(x)-22}" y="${Y(d[1])}" width="44" height="${Y(0)-Y(d[1])}" fill="${d[2]}" rx="3"/>${tag(x,d[1]+0.06,d[0],'#e8edf5')}`; });
    return frame(`${bars}${dash(0,0.5,1,0.5,'#3dd6c4')}${tag(0.84,0.54,'buy below fair value','#26d07c')}`,
      "Valuation — estimate intrinsic value, buy with a margin of safety");
  }
  function diagAllocation() {
    const segs = [[0.30,'#3dd6c4','Equities'],[0.25,'#5b8cff','Bonds'],[0.20,'#b07bff','Alts'],[0.15,'#ffb547','Cash'],[0.10,'#26d07c','Intl']];
    let x = 0.1, bars = "";
    segs.forEach(s=>{ bars += `<rect x="${X(x)}" y="${Y(0.6)}" width="${s[0]*(W-2*PAD)}" height="40" fill="${s[1]}"/>${tag(x+s[0]/2,0.42,s[2],'#e8edf5')}`; x+=s[0]; });
    return frame(bars, "Allocation — diversify weights to balance risk and return");
  }
  function diagSpread() {
    const a = wave(40, x => 0.6 - x*0.05 + Math.sin(x*Math.PI*3)*0.05, 0.02);
    const b = wave(40, x => 0.4 + x*0.05 + Math.sin(x*Math.PI*3+0.3)*0.05, 0.02);
    return frame(`${poly(a,'#5b8cff')}${poly(b,'#ffb547')}${tag(0.85,0.62,'A','#5b8cff')}${tag(0.85,0.36,'B','#ffb547')}
      ${tag(0.5,0.9,'trade the spread, not direction','#9aa8c0')}`,
      "Relative value — long the cheap leg, short the rich leg; profit on convergence");
  }
  function diagEvent() {
    const p = [...wave(20, x => 0.45, 0.03, 3)].map(q=>[q[0]*0.5,q[1]]);
    const p2 = wave(20, x => 0.7, 0.03, 9).map(q=>[0.55+q[0]*0.45,q[1]]);
    return frame(`${poly(p,'#5b8cff')}${poly(p2,'#26d07c')}
      <line x1="${X(0.52)}" y1="${Y(0.45)}" x2="${X(0.55)}" y2="${Y(0.7)}" stroke="#26d07c" stroke-width="2.4" stroke-dasharray="3 3"/>
      ${tag(0.52,0.9,'catalyst (earnings/M&A)','#ffb547')}`, "Event-driven — position around a known catalyst, manage binary risk");
  }
  function diagSentiment() {
    const p = wave(60, x => 0.5 + Math.sin(x*Math.PI*2.5)*0.3, 0.03);
    return frame(`${dash(0,0.82,1,0.82,'#ff5d6c')}${dash(0,0.18,1,0.18,'#26d07c')}${poly(p,'#b07bff')}
      ${tag(0.5,0.9,'extreme greed','#ff5d6c')}${tag(0.5,0.1,'extreme fear','#26d07c')}
      ${buyMark(0.2,0.2)}${sellMark(0.6,0.8)}`, "Sentiment — be greedy when others are fearful, and vice versa");
  }
  function diagRisk() {
    const p = wave(40, x => 0.6 + Math.sin(x*Math.PI*3)*0.1, 0.03);
    return frame(`${poly(p,'#5b8cff')}${dash(0,0.4,1,0.4,'#ff5d6c')}${buyMark(0.2,0.62)}
      ${tag(0.5,0.34,'stop-loss (define risk first)','#ff5d6c')}${tag(0.82,0.74,'let winners run','#26d07c')}`,
      "Risk management — size by your stop so one loss is ≤1–2% of capital");
  }
  function diagSignal() {
    const p = wave(50, x => 0.4 + x*0.3 + Math.sin(x*Math.PI*5)*0.08, 0.03);
    return frame(`${poly(p,'#5b8cff')}${buyMark(0.2,0.5)}${sellMark(0.5,0.68)}${buyMark(0.72,0.62)}
      ${tag(0.5,0.92,'model fires entries/exits systematically','#9aa8c0')}`,
      "Systematic — a model generates rules-based buy/sell signals");
  }
  function diagTimeframe() {
    const p = wave(60, x => 0.5 + Math.sin(x*Math.PI*6)*0.18, 0.03);
    return frame(`${poly(p,'#3dd6c4')}<rect x="${X(0.2)}" y="${PAD}" width="${X(0.32)-X(0.2)}" height="${H-2*PAD}" fill="#5b8cff" opacity="0.12"/>
      ${tag(0.26,0.92,'one trade window','#5b8cff')}`, "Time-horizon — match your hold time to your strategy and life");
  }
  function diagGeneric() {
    const p = wave(40, x => 0.4 + x*0.25 + Math.sin(x*Math.PI*3)*0.07, 0.04);
    return frame(`${poly(p,'#5b8cff')}${buyMark(0.25,0.5)}${tag(0.8,0.85,'plan entry, stop & target','#9aa8c0')}`,
      "Define a plan: entry trigger, stop-loss, and profit target");
  }

  /* ----- chart patterns ----- */
  function diagHNS(inv) {
    let pts = [[0,.4],[.12,.55],[.2,.45],[.32,.72],[.42,.45],[.55,.85],[.68,.45],[.8,.7],[.9,.45],[1,.3]];
    if (inv) pts = pts.map(p=>[p[0],1-p[1]]);
    const neck = inv ? 0.55 : 0.45;
    return frame(`${poly(pts, inv?'#26d07c':'#ff5d6c')}${dash(0.1,neck,0.95,neck,'#ffb547')}
      ${tag(0.32,inv?0.2:0.78,'shoulder','#9aa8c0')}${tag(0.55,inv?0.08:0.92,'head','#e8edf5')}${tag(0.8,inv?0.22:0.76,'shoulder','#9aa8c0')}
      ${tag(0.85,neck+(inv?-0.07:0.07),'neckline','#ffb547')}`,
      (inv?"Inverse Head & Shoulders — bullish reversal":"Head & Shoulders — bearish reversal")+"; trade the neckline break");
  }
  function diagDouble(top) {
    let pts = top ? [[0,.35],[.2,.78],[.4,.5],[.6,.78],[.8,.4],[1,.25]] : [[0,.65],[.2,.22],[.4,.5],[.6,.22],[.8,.6],[1,.75]];
    const lvl = top?0.5:0.5;
    return frame(`${poly(pts, top?'#ff5d6c':'#26d07c')}${dash(0,lvl,1,lvl,'#ffb547')}
      ${tag(0.2,top?0.85:0.15,top?'top':'bottom','#9aa8c0')}${tag(0.6,top?0.85:0.15,top?'top':'bottom','#9aa8c0')}
      ${tag(0.85,lvl+(top?0.06:-0.06),'break = signal','#ffb547')}`,
      (top?"Double Top — bearish":"Double Bottom — bullish")+"; enter on the break of the middle level");
  }
  function diagTriangle(kind) {
    const p = wave(50, x => {
      const top = kind==="desc"?0.7:(0.7 - x*0.18);
      const bot = kind==="asc"?0.4:(0.4 + x*0.18);
      const mid = (top+bot)/2; const amp=(top-bot)/2;
      return mid + Math.sin(x*Math.PI*6)*amp*0.9;
    }, 0.015);
    const topLine = kind==="desc"?dash(0,0.7,1,0.7,'#ff5d6c'):dash(0,0.7,1,0.52,'#ff5d6c');
    const botLine = kind==="asc"?dash(0,0.4,1,0.4,'#26d07c'):dash(0,0.4,1,0.58,'#26d07c');
    const name = kind==="asc"?"Ascending":kind==="desc"?"Descending":"Symmetrical";
    return frame(`${topLine}${botLine}${poly(p,'#5b8cff',1.8)}${tag(0.8,0.9,name+' triangle','#9aa8c0')}`,
      name+" triangle — trade the breakout in the direction of the squeeze");
  }
  function diagCupHandle() {
    const pts = [[0,.7],[.1,.6],[.2,.4],[.35,.32],[.5,.4],[.6,.6],[.68,.68],[.78,.58],[.86,.64],[1,.85]];
    return frame(`${poly(pts,'#3dd6c4')}${dash(0.1,0.7,0.68,0.7,'#ffb547')}
      ${tag(0.38,0.26,'cup','#9aa8c0')}${tag(0.73,0.5,'handle','#9aa8c0')}${buyMark(0.86,0.72)}`,
      "Cup & Handle — bullish continuation; buy the handle breakout");
  }
  function diagFlag() {
    const pole = [[0,.3],[.15,.3],[.3,.75]];
    const flag = [[.3,.75],[.4,.66],[.5,.72],[.6,.62],[.7,.68]];
    const out = [[.7,.68],[.85,.95]];
    return frame(`${poly(pole,'#26d07c')}${poly(flag,'#ffb547')}${poly(out,'#26d07c')}
      ${tag(0.2,0.5,'pole','#9aa8c0')}${tag(0.5,0.55,'flag','#ffb547')}${buyMark(0.72,0.74)}`,
      "Flag/Pennant — brief pause after a sharp move, then continuation");
  }
  function diagWedge() {
    const p = wave(50, x => 0.55 + Math.sin(x*Math.PI*6)*(0.22-x*0.16) + x*0.05, 0.012);
    return frame(`${dash(0,0.78,1,0.62,'#ff5d6c')}${dash(0,0.34,1,0.55,'#26d07c')}${poly(p,'#b07bff',1.8)}
      ${tag(0.8,0.9,'converging wedge','#9aa8c0')}`, "Wedge — narrowing range; breakout resolves the direction");
  }

  /* ----- options payoff diagrams ----- */
  // segments: array of [x0..x1] linear P/L in 0..1 space, x in 0..1, y 0.5 = breakeven
  function payoff(type) {
    const be = 0.5; // breakeven line
    const seg = {
      longcall: [[0,.25],[.45,.25],[1,.9]],
      longput:  [[0,.9],[.55,.25],[1,.25]],
      coveredcall:[[0,.15],[.5,.6],[1,.6]],
      protectiveput:[[0,.35],[.5,.35],[1,.85]],
      cashput:  [[0,.15],[.5,.65],[1,.65]],
      bullcall: [[0,.3],[.4,.3],[.7,.72],[1,.72]],
      bearput:  [[0,.72],[.4,.72],[.7,.3],[1,.3]],
      bullput:  [[0,.3],[.4,.3],[.7,.7],[1,.7]],
      bearcall: [[0,.7],[.4,.7],[.7,.3],[1,.3]],
      ironcondor:[[0,.32],[.25,.32],[.4,.68],[.6,.68],[.75,.32],[1,.32]],
      ironbutterfly:[[0,.3],[.5,.75],[1,.3]],
      butterfly:[[0,.42],[.35,.42],[.5,.78],[.65,.42],[1,.42]],
      condor:[[0,.42],[.25,.42],[.4,.74],[.6,.74],[.75,.42],[1,.42]],
      straddle: [[0,.85],[.5,.2],[1,.85]],
      strangle: [[0,.8],[.35,.28],[.65,.28],[1,.8]],
      calendar:[[0,.4],[.5,.72],[1,.4]],
      ratio:[[0,.45],[.4,.45],[.55,.75],[.8,.4],[1,.1]],
      backspread:[[0,.4],[.4,.4],[.55,.2],[.7,.4],[1,.9]],
    }[type] || [[0,.3],[.5,.3],[1,.8]];
    const profit = poly(seg, '#3dd6c4', 2.6);
    return frame(`${dash(0,be,1,be,'#64748b')}${profit}
      ${tag(0.1,be+0.05,'profit','#26d07c','start')}${tag(0.1,be-0.06,'loss','#ff5d6c','start')}
      <text x="${W/2}" y="${PAD-8}" fill="#9aa8c0" font-size="11" text-anchor="middle">P/L at expiration vs. stock price →</text>`,
      "Option payoff — green above the line is profit, below is loss");
  }

  /* ============================================================
     LESSON CONTENT
     ============================================================ */
  // Per-category teaching template (covers every method by default).
  const CAT = {
    c1: { chart:"valuation", what:"a long-horizon investing style focused on owning quality businesses and letting them compound.",
      how:["Screen for businesses with durable advantages and solid financials.","Estimate what the business is worth (intrinsic value).","Buy when price is at or below that value, then hold patiently."],
      use:["Define your criteria (growth, margins, debt, valuation).","Build a watchlist and wait for attractive prices.","Add gradually; reinvest dividends; review the thesis each year."],
      pros:["Lower stress, lower costs/taxes","Compounding works for you over time"], cons:["Requires patience","Can lag in speculative manias"], risk:"low" },
    c2: { chart:"timeframe", what:"a trading style defined by how long you hold positions.",
      how:["Pick a holding period that matches your time, capital, and temperament.","Use a chart timeframe that fits that horizon.","Match risk and position size to the speed of the strategy."],
      use:["Decide your max hold time before entering.","Set entries/exits appropriate to that window.","Avoid drifting between timeframes mid-trade ('timeframe creep')."],
      pros:["Clarity on when to act","Aligns strategy with lifestyle"], cons:["Shorter = more stress & costs","Mismatch causes mistakes"], risk:"med" },
    c3: { chart:"uptrend", what:"a trend/momentum approach that buys strength and rides established moves.",
      how:["Identify the dominant trend direction.","Enter in the direction of the trend (pullbacks or breakouts).","Stay in until the trend structure breaks."],
      use:["Confirm trend with higher highs/lows or moving averages.","Enter on a pullback or breakout with a stop below structure.","Trail your stop to ride the move; exit on a structure break."],
      pros:["Big winners when trends run","Simple, rule-friendly"], cons:["Whipsaws in choppy markets","Late entries/exits"], risk:"med" },
    c4: { chart:"meanrev", what:"a mean-reversion approach that fades extremes back toward the average.",
      how:["Measure how far price has stretched from its mean.","Enter against the move when it's statistically extreme.","Exit as price reverts toward the average."],
      use:["Define 'extreme' (bands, z-score, RSI level).","Enter counter-trend with a tight stop beyond the extreme.","Target the moving average / mean as your exit."],
      pros:["High win rate in ranges","Clear entry levels"], cons:["Dangerous in strong trends","Small wins, occasional big loss"], risk:"med" },
    c5: { chart:"range", what:"a price-action method that reads raw chart structure — support, resistance, and supply/demand.",
      how:["Mark key levels where price reacted before.","Watch how price behaves at those levels.","Trade the reaction (bounce or break) with confirmation."],
      use:["Draw support/resistance and supply/demand zones.","Wait for a clear rejection or break at a level.","Enter with a stop just beyond the level; target the next level."],
      pros:["No lagging indicators","Works on any market"], cons:["Subjective","Needs screen time to learn"], risk:"med" },
    c6: { chart:"oscillator", what:"an indicator-based method using a technical tool to time entries and exits.",
      how:["Apply the indicator to your chart.","Read its signal (cross, level, divergence).","Combine with trend/price for confirmation."],
      use:["Set the indicator's parameters for your timeframe.","Act on its signal only with trend or level confirmation.","Use a stop; indicators lag and give false signals alone."],
      pros:["Objective, easy to automate","Good for timing"], cons:["Lagging; false signals","Fails when used in isolation"], risk:"med" },
    c7: { chart:"doubletop", what:"a chart-pattern method that trades recognizable formations.",
      how:["Identify the pattern as it forms.","Wait for the confirmation trigger (level break).","Measure a target from the pattern's size."],
      use:["Confirm the pattern with volume.","Enter on the break of the key line, not before.","Stop on the other side; target = pattern height projected."],
      pros:["Defined entry, stop, and target","Visual and intuitive"], cons:["Patterns fail / are subjective","Hindsight bias"], risk:"med" },
    c8: { chart:"volume", what:"a volume-based method that reads conviction behind price moves.",
      how:["Compare current volume to its average.","Look for surges that confirm moves or absorption that warns.","Map where the most volume traded (value areas)."],
      use:["Require above-average volume to trust a breakout.","Fade moves on fading volume.","Use high-volume nodes as support/resistance."],
      pros:["Confirms genuine moves","Spots traps early"], cons:["Data-heavy","Less useful in thin names"], risk:"med" },
    c9: { chart:"volume", what:"an order-flow method that reads live buying/selling at the bid and ask.",
      how:["Watch the order book and time & sales.","Identify aggressive buyers vs. sellers and absorption.","Act on short-term imbalances."],
      use:["Use Level II / footprint to see resting and executed orders.","Enter when one side clearly overwhelms the other.","Exit fast — edges are short-lived."],
      pros:["Very precise timing","Real-time supply/demand"], cons:["Requires fast data & focus","Steep learning curve"], risk:"high" },
    c10:{ chart:"valuation", what:"fundamental analysis — valuing a company from its financial statements.",
      how:["Study revenue, earnings, cash flow, and the balance sheet.","Estimate intrinsic value (e.g. DCF or multiples).","Compare price to value and to peers."],
      use:["Read the financials and model future cash flows.","Apply a margin of safety to your value estimate.","Buy below value; revisit when fundamentals change."],
      pros:["Grounded in business reality","Great for long horizons"], cons:["Slow; needs accounting skill","Markets can stay irrational"], risk:"low" },
    c11:{ chart:"signal", what:"a global-macro approach trading economies, rates, and policy themes.",
      how:["Form a view on growth, inflation, and policy.","Pick instruments that express that view.","Size for wide outcome ranges and long timelines."],
      use:["Track macro data and central-bank signals.","Express the theme via sectors, indices, or currencies.","Use options or stops — macro timing is hard."],
      pros:["Huge opportunity in regime shifts","Diversifies stock-picking"], cons:["Hard to time","Wide dispersion of outcomes"], risk:"high" },
    c12:{ chart:"event", what:"an event-driven approach trading around known catalysts.",
      how:["Identify an upcoming catalyst (earnings, M&A, spin-off).","Estimate the range of outcomes and the market's expectation.","Position with defined risk for the binary event."],
      use:["Map the event date and scenarios.","Use defined-risk structures (or small size).","Have an exit plan for each outcome before the event."],
      pros:["Clear catalyst and timeline","Repeatable setups"], cons:["Binary, gap risk","Crowded trades"], risk:"high" },
    c13:{ chart:"signal", what:"a quantitative approach using data and models to generate signals.",
      how:["Form a hypothesis and gather clean data.","Backtest a rules-based signal honestly (out-of-sample).","Trade the signal systematically and monitor decay."],
      use:["Define features and a testable rule.","Validate on unseen data; account for costs/slippage.","Automate execution; retire signals as edges fade."],
      pros:["Objective, scalable, emotion-free","Diversifiable"], cons:["Overfitting risk","Needs data & coding skill"], risk:"med" },
    c14:{ chart:"spread", what:"an arbitrage/relative-value approach profiting from price relationships, not direction.",
      how:["Find two related instruments that are mispriced.","Go long the cheap one and short the rich one.","Profit as the spread converges."],
      use:["Confirm a stable historical relationship.","Enter when the spread is statistically wide.","Exit on convergence; cap risk if the relationship breaks."],
      pros:["Market-neutral","Lower directional risk"], cons:["Relationships can break","Often needs leverage/infra"], risk:"high" },
    c15:{ chart:"payoff:longcall", what:"an options strategy with a defined, shaped risk/reward profile.",
      how:["Pick a directional or volatility view.","Choose strikes/expiration to shape the payoff.","Know your max profit, max loss, and breakeven before entering."],
      use:["Match the structure to your view and risk budget.","Mind time decay (theta) and implied volatility (IV).","Have a plan to manage, roll, or close before expiration."],
      pros:["Defined risk; flexible payoffs","Can profit from time/volatility"], cons:["Complex; decay works against buyers","IV crush risk"], risk:"high" },
    c16:{ chart:"uptrend", what:"futures trading — leveraged contracts on indices, commodities, or rates.",
      how:["Choose a liquid contract and understand its specs.","Apply a trend or macro method.","Manage leverage carefully with strict stops."],
      use:["Know contract size, margin, and roll dates.","Trade with the trend; size small due to leverage.","Use hard stops — gains and losses magnify fast."],
      pros:["Deep liquidity; go long or short","Capital efficient"], cons:["High leverage risk","Roll/contango complexity"], risk:"high" },
    c17:{ chart:"range", what:"market making — continuously quoting both sides to capture the spread.",
      how:["Post bids and offers around fair value.","Earn the bid-ask spread on flow.","Manage inventory to stay risk-neutral."],
      use:["Quote tight in liquid names; widen in volatility.","Hedge or offload inventory promptly.","This is largely institutional/algorithmic."],
      pros:["Steady edge from spread","Market-neutral if hedged"], cons:["Inventory/adverse-selection risk","Needs infrastructure"], risk:"high" },
    c18:{ chart:"signal", what:"algorithmic trading — automating execution and/or strategy with code.",
      how:["Encode entry, exit, and risk rules.","Backtest and forward-test the logic.","Deploy with monitoring and kill-switches."],
      use:["Start simple; validate before going live.","Account for latency, fees, and slippage.","Monitor constantly; automation fails silently."],
      pros:["Speed, consistency, scale","Removes emotion"], cons:["Bugs/overfitting can be costly","Requires engineering"], risk:"med" },
    c19:{ chart:"allocation", what:"an institutional portfolio approach balancing risk across many assets.",
      how:["Define objectives and constraints.","Allocate to balance risk contributions, not just dollars.","Rebalance on a schedule or thresholds."],
      use:["Estimate risk/correlation across holdings.","Weight to target a risk profile (e.g. risk parity).","Rebalance to keep the target intact."],
      pros:["Smoother returns","Disciplined and repeatable"], cons:["Model-dependent","Can underperform in big bull runs"], risk:"low" },
    c20:{ chart:"allocation", what:"an alternative-asset approach (real estate, PE/VC style, commodities, distressed).",
      how:["Understand the asset's unique drivers and liquidity.","Analyze it with the right framework (cash flows, NAV, supply/demand).","Size for illiquidity and long lockups."],
      use:["Research the specific asset class deeply.","Diversify; expect long holding periods.","Account for limited liquidity in your plan."],
      pros:["Diversification; new return sources","Inflation hedges (some)"], cons:["Illiquid, complex","Harder to value"], risk:"med" },
    c21:{ chart:"uptrend", what:"a crypto / digital-asset strategy (spot, trend, DeFi, on-chain).",
      how:["Pick your approach (hold, trade, or earn yield).","Use on-chain and technical data for timing.","Manage extreme volatility and custody/security risk."],
      use:["Size small — volatility is very high.","Secure your keys; understand smart-contract risk.","Take profits into strength; don't over-leverage."],
      pros:["High growth potential; 24/7 markets","New yield mechanics"], cons:["Extreme volatility","Security/regulatory risk"], risk:"high" },
    c22:{ chart:"sentiment", what:"a behavioral approach exploiting crowd psychology and emotional extremes.",
      how:["Gauge crowd sentiment (fear vs. greed).","Lean against extremes when supported by evidence.","Manage the discomfort of being contrarian."],
      use:["Track sentiment gauges and positioning.","Buy panic, sell euphoria — with a stop.","Confirm with price; crowds can stay wrong a while."],
      pros:["Buys low, sells high by design","Edge at turning points"], cons:["Early = wrong; painful","Needs discipline"], risk:"med" },
    c23:{ chart:"risk", what:"a risk-management framework — the discipline that keeps you in the game.",
      how:["Decide how much you'll risk per trade and total.","Place stops and size positions from that risk.","Hedge tail risk and control drawdowns."],
      use:["Risk a fixed small % (e.g. 1%) per position.","Size = risk ÷ stop distance.","Cut losers, let winners run, review drawdowns."],
      pros:["Survival and longevity","Turns edge into results"], cons:["Requires discipline","Caps some upside"], risk:"low" },
    c24:{ chart:"allocation", what:"a portfolio-construction method for combining assets optimally.",
      how:["Define expected return, risk, and correlations.","Optimize weights for your objective.","Rebalance to maintain the design."],
      use:["Diversify across uncorrelated assets.","Choose a weighting scheme (equal, cap, risk, factor).","Rebalance periodically to stay on target."],
      pros:["Better risk-adjusted returns","Systematic, repeatable"], cons:["Estimates can be wrong","Needs maintenance"], risk:"low" },
  };

  // Specific overrides — richer lessons + exact diagrams for popular methods.
  const OVER = {
    "Trend Following":{chart:"uptrend"}, "Momentum Trading":{chart:"uptrend"}, "Breakout Momentum":{chart:"breakout"},
    "Moving Average Strategies":{chart:"ma"}, "Relative Strength Trading":{chart:"uptrend"},
    "Mean Reversion Trading":{chart:"meanrev"}, "Bollinger Band Reversion":{chart:"meanrev"}, "RSI Reversion":{chart:"oscillator"},
    "Support & Resistance Trading":{chart:"range"}, "Supply & Demand Trading":{chart:"range"}, "Wyckoff Method":{chart:"range"},
    "RSI Strategies":{chart:"oscillator"}, "MACD Strategies":{chart:"ma"}, "Stochastic Strategies":{chart:"oscillator"},
    "Bollinger Bands":{chart:"meanrev"}, "Ichimoku Cloud":{chart:"ma"},
    "Head and Shoulders":{chart:"hns"}, "Inverse Head and Shoulders":{chart:"invhns"},
    "Double Top":{chart:"doubletop"}, "Double Bottom":{chart:"doublebottom"},
    "Triple Top":{chart:"doubletop"}, "Triple Bottom":{chart:"doublebottom"},
    "Ascending Triangle":{chart:"triangle_asc"}, "Descending Triangle":{chart:"triangle_desc"},
    "Symmetrical Triangle":{chart:"triangle_sym"}, "Triangles":{chart:"triangle_sym"},
    "Wedges":{chart:"wedge"}, "Flags":{chart:"flag"}, "Pennants":{chart:"flag"},
    "Cup and Handle":{chart:"cuphandle"}, "Rectangle Patterns":{chart:"rectangle"}, "Classical Patterns":{chart:"doubletop"},
    "Volume Profile":{chart:"volume"}, "Market Profile":{chart:"volume"}, "VWAP":{chart:"ma"}, "VWAP Reversion":{chart:"meanrev"},
    "Breakout Trading":{chart:"breakout"},
    "Long Calls":{chart:"payoff:longcall"}, "Long Puts":{chart:"payoff:longput"},
    "Covered Calls":{chart:"payoff:coveredcall"}, "Protective Puts":{chart:"payoff:protectiveput"},
    "Cash Secured Puts":{chart:"payoff:cashput"}, "Bull Call Spread":{chart:"payoff:bullcall"},
    "Bear Put Spread":{chart:"payoff:bearput"}, "Bull Put Spread":{chart:"payoff:bullput"},
    "Bear Call Spread":{chart:"payoff:bearcall"}, "Iron Condor":{chart:"payoff:ironcondor"},
    "Iron Butterfly":{chart:"payoff:ironbutterfly"}, "Butterfly Spread":{chart:"payoff:butterfly"},
    "Condor Spread":{chart:"payoff:condor"}, "Straddle":{chart:"payoff:straddle"}, "Strangle":{chart:"payoff:strangle"},
    "Calendar Spread":{chart:"payoff:calendar"}, "Diagonal Spread":{chart:"payoff:calendar"},
    "Ratio Spread":{chart:"payoff:ratio"}, "Backspread":{chart:"payoff:backspread"},
    "Scalping":{chart:"timeframe"}, "Day Trading":{chart:"timeframe"}, "Swing Trading":{chart:"uptrend"},
    "Pairs Trading":{chart:"spread"}, "Statistical Arbitrage":{chart:"spread"},
    "Value Investing":{chart:"valuation"}, "DCF Analysis":{chart:"valuation"}, "Dividend Investing":{chart:"valuation"},
    "Kelly Criterion":{chart:"risk"}, "Stop Loss Systems":{chart:"risk"}, "Portfolio Hedging":{chart:"risk"},
    "Modern Portfolio Theory":{chart:"allocation"}, "Risk Parity":{chart:"allocation"},
    "Options Strategies":{chart:"payoff:bullcall"}, "Earnings Catalyst Strategy":{chart:"event"},
  };

  // Resolve the right illustrative diagram for any method/alias (used by the overlay).
  function chartForMethod(item) {
    const name = window.STRAT ? window.STRAT.canon(item) : item;
    let catKey = null;
    for (const g of window.METHOD_TAXONOMY) { if (g.items.includes(name) || g.items.includes(item)) { catKey = g.key; break; } }
    if (!catKey) catKey = "c3";
    const L = lessonFor(catKey, OVER[item] ? item : name);
    return diagram(L.chart);
  }

  function getCatKeyFor(catName) {
    const g = window.METHOD_TAXONOMY.find(x => x.cat === catName);
    return g ? g.key : null;
  }

  function lessonFor(catKey, item) {
    const base = CAT[catKey] || CAT.c1;
    const over = OVER[item] || {};
    const chart = over.chart || base.chart;
    const cat = (window.METHOD_TAXONOMY.find(g => g.key === catKey) || {}).cat || "";
    return {
      title: item, category: cat, chart,
      what: `${item} is ${base.what}`,
      how: base.how, use: base.use, pros: base.pros, cons: base.cons, risk: base.risk,
    };
  }

  function riskPill(r){ const m={low:["LOW","risk-low"],med:["MEDIUM","risk-med"],high:["HIGH","risk-high"]}[r]||["—","risk-med"];
    return `<span class="risk-pill ${m[1]}">${m[0]} difficulty/risk</span>`; }

  // Live "currently matching" mini-list using the strategy engine.
  function liveMatches(item) {
    if (!window.STRAT || !window.STOCK_UNIVERSE) return "";
    const top = window.STRAT.rankByStrategy(item, window.STOCK_UNIVERSE).slice(0, 3);
    return `<div class="live-matches">
      <div class="lm-head">📡 Currently matching this strategy</div>
      ${top.map(r => `<div class="lm-row" data-open="${esc(r.stock.symbol)}">
        <span class="lm-sym">${r.stock.symbol}</span>
        <span class="lm-name dim">${r.stock.name}</span>
        <span class="lm-score" style="color:${window.CHARTS.scoreColor(r.res.score)}">${r.res.score}</span>
      </div>`).join("")}
    </div>`;
  }

  function render(catKey, item) {
    const L = lessonFor(catKey, item);
    return `
      <div class="lesson">
        <div class="lesson-head">
          <div>
            <div class="faint" style="font-size:12px;text-transform:uppercase;letter-spacing:1px">${L.category}</div>
            <h2 style="margin:2px 0 6px">${L.title}</h2>
            ${riskPill(L.risk)}
          </div>
          <span class="badge" style="background:var(--panel-2);color:var(--accent)">🤖 AI Tutor</span>
        </div>
        <p class="lesson-what">${L.what}</p>
        <div class="lesson-actions">
          <button class="btn find-stocks-btn" data-find="${esc(L.title)}">⚡ Find Matching Stocks</button>
          <span class="drag-hint faint">Tip: open any stock to drag this strategy onto it.</span>
        </div>
        ${liveMatches(L.title)}
        <div class="lesson-chart">${diagram(L.chart)}</div>
        <h4>How it works</h4><ul>${L.how.map(x=>`<li>${x}</li>`).join("")}</ul>
        <h4>How to use it — step by step</h4><ol>${L.use.map(x=>`<li>${x}</li>`).join("")}</ol>
        <div class="lesson-pc">
          <div><h4 class="pos">✓ Pros</h4><ul>${L.pros.map(x=>`<li>${x}</li>`).join("")}</ul></div>
          <div><h4 class="neg">✕ Cons / pitfalls</h4><ul>${L.cons.map(x=>`<li>${x}</li>`).join("")}</ul></div>
        </div>
        <p class="faint" style="font-size:11.5px;margin-top:16px">⚠️ Educational explanation with an illustrative diagram — not financial advice or a signal to trade. Practice on paper first.</p>
      </div>`;
  }

  function welcome() {
    const featured = ["Trend Following","Breakout Momentum","RSI Strategies","Support & Resistance Trading","Iron Condor","Value Investing"];
    return `<div class="lesson">
      <div class="lesson-head"><h2 style="margin:0">🎓 Learn any method</h2>
        <span class="badge" style="background:var(--panel-2);color:var(--accent)">🤖 AI Tutor</span></div>
      <p class="lesson-what">Browse the full library on the left, or search for a method. Pick any one and the AI Tutor will explain how it works, walk you through using it step by step, and draw an illustrative graph.</p>
      <h4>Popular places to start</h4>
      <div class="learn-featured">
        ${featured.map(f=>`<button class="chip" data-feature="${esc(f)}">${f}</button>`).join("")}
      </div>
      <p class="faint" style="font-size:12px;margin-top:18px">Everything here is educational. Diagrams are illustrative, not live market data.</p>
    </div>`;
  }

  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  return { render, welcome, diagram, chartForMethod };
})();

window.LEARN = LEARN;
