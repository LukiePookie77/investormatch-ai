/* ============================================================
   engine.js — InvestorMatch AI scoring & classification engine
   --------------------------------------------------------------
   Deterministic, transparent models (NOT a black box and NOT
   live-trained). Every score is reproducible from inputs so the
   reasoning can be explained to the user. Educational use only.
   ============================================================ */

const ENGINE = (() => {

  const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const round = (x) => Math.round(x);

  /* -------- Risk profile -------- */
  // Inputs are 1–5 Likert scores. Returns 0–100 risk appetite + band.
  function riskProfile(p) {
    const tol = (p.riskTolerance - 1) / 4 * 100;
    const dd  = (p.maxDrawdown - 1) / 4 * 100;          // willingness to accept drawdown
    const vol = 100 - (p.volatilityReaction - 1) / 4 * 100; // calm under volatility = higher appetite
    const con = (p.concentration - 1) / 4 * 100;        // concentrated = higher appetite
    const grw = (p.preservationVsGrowth - 1) / 4 * 100; // growth-leaning = higher appetite
    let score = round(tol * 0.30 + dd * 0.22 + vol * 0.20 + con * 0.12 + grw * 0.16);
    // experience nudges capacity
    const expAdj = { Beginner: -6, Intermediate: 0, Advanced: 4, Professional: 8 }[p.experience] || 0;
    score = clamp(score + expAdj);
    let band, key;
    if (score < 30)      { band = "Conservative"; key = "conservative"; }
    else if (score < 55) { band = "Moderate";     key = "moderate"; }
    else if (score < 78) { band = "Aggressive";   key = "aggressive"; }
    else                 { band = "Speculative";  key = "speculative"; }
    return { score, band, key, parts: { tol, dd, vol, con, grw } };
  }

  /* -------- Time horizon -------- */
  const HORIZONS = {
    "Scalper":          { idx: 0, hold: "Seconds–minutes", maxVol: 100, label: "Scalper" },
    "Day Trader":       { idx: 1, hold: "Intraday",        maxVol: 100, label: "Day Trader" },
    "Swing Trader":     { idx: 2, hold: "Days–weeks",      maxVol: 85,  label: "Swing Trader" },
    "Position Trader":  { idx: 3, hold: "Weeks–months",    maxVol: 70,  label: "Position Trader" },
    "Long-Term Investor":{ idx: 4, hold: "Years",          maxVol: 60,  label: "Long-Term Investor" },
  };
  function timeHorizon(p) {
    const h = HORIZONS[p.horizon] || HORIZONS["Swing Trader"];
    return { ...h, key: p.horizon };
  }

  /* -------- Profile normalizer (back-compat for older saved profiles) -------- */
  function num(v, d) { return (v == null || isNaN(v)) ? d : v; }
  function pref(p) {
    return {
      growthValue: num(p.growthValue, 3),        // 1 deep value .. 5 pure growth
      dividendPref: num(p.dividendPref, 3),       // 1 none .. 5 must-have income
      esgPref: num(p.esgPref, 3),                 // 1 ignore .. 5 critical
      marketCap: p.marketCapPref || "No preference",
      industries: p.industries || [],
      geo: p.geo || "No preference",
      analysisStyle: p.analysisStyle || "Balanced",
      tradingFrequency: p.tradingFrequency || "Occasionally",
    };
  }

  /* -------- Investor classification (16 archetypes) --------
     Each archetype has a scorer over the profile. Confidence is the
     normalized strength of the match. Returns sorted list. */
  const ARCHETYPES = [
    { name: "Long-Term Investor", scorer: (p, r, f) =>
        (p.horizon === "Long-Term Investor" ? 48 : 8) + goal(p, "Wealth") * 16 + (r.key === "moderate" ? 12 : 4) },
    { name: "Growth Investor", scorer: (p, r, f) =>
        sel(p.markets, "Growth Stocks") * 26 + (f.growthValue >= 4 ? 30 : 8) + r.score * 0.30 },
    { name: "Value Investor", scorer: (p, r, f) =>
        sel(p.markets, "Value Stocks") * 30 + (f.growthValue <= 2 ? 28 : 6) + (p.experience !== "Beginner" ? 14 : 4) },
    { name: "Dividend Investor", scorer: (p, r, f) =>
        sel(p.markets, "Dividend Stocks") * 28 + (f.dividendPref >= 4 ? 34 : 6) + (r.score < 50 ? 14 : 4) },
    { name: "Momentum Trader", scorer: (p, r, f) =>
        (horizonIdx(p) <= 2 ? 24 : 6) + r.score * 0.36 + (f.tradingFrequency === "Daily" || f.tradingFrequency === "Weekly" ? 16 : 4) },
    { name: "Swing Trader", scorer: (p, r, f) =>
        (p.horizon === "Swing Trader" ? 50 : 8) + (p.experience !== "Beginner" ? 14 : 4) },
    { name: "Day Trader", scorer: (p, r, f) =>
        (p.horizon === "Day Trader" ? 52 : 4) + (f.tradingFrequency === "Daily" ? 22 : 2) + (p.experience === "Professional" ? 12 : 0) },
    { name: "Position Trader", scorer: (p, r, f) =>
        (p.horizon === "Position Trader" ? 50 : 8) + (f.analysisStyle === "Technical" || f.analysisStyle === "Balanced" ? 12 : 4) },
    { name: "Macro Investor", scorer: (p, r, f) =>
        (f.geo === "Global" ? 26 : 6) + (p.experience === "Advanced" || p.experience === "Professional" ? 22 : 4) + (f.analysisStyle === "Fundamental" ? 12 : 2) },
    { name: "Quantitative Investor", scorer: (p, r, f) =>
        (f.analysisStyle === "Quantitative" ? 40 : 6) + (p.experience === "Professional" || p.experience === "Advanced" ? 18 : 4) + goal(p, "Systematic") * 16 },
    { name: "Event Driven Investor", scorer: (p, r, f) =>
        (horizonIdx(p) === 2 || horizonIdx(p) === 3 ? 18 : 6) + (p.experience !== "Beginner" ? 20 : 4) + r.score * 0.18 },
    { name: "Options Trader", scorer: (p, r, f) =>
        (p.experience === "Professional" || p.experience === "Advanced" ? 28 : 4) + (r.score > 55 ? 20 : 4) + (f.tradingFrequency === "Daily" || f.tradingFrequency === "Weekly" ? 12 : 2) },
    { name: "Conservative Wealth Builder", scorer: (p, r, f) =>
        (r.key === "conservative" ? 40 : r.key === "moderate" ? 18 : 2) + goal(p, "Preservation") * 22 + (p.horizon === "Long-Term Investor" ? 12 : 2) },
    { name: "Aggressive Growth Seeker", scorer: (p, r, f) =>
        (r.key === "aggressive" ? 34 : 6) + (f.growthValue >= 4 ? 26 : 6) + goal(p, "Growth") * 18 },
    { name: "Income Investor", scorer: (p, r, f) =>
        goal(p, "Income") * 30 + (f.dividendPref >= 4 ? 28 : 6) + (r.score < 45 ? 14 : 4) },
    { name: "Speculative Trader", scorer: (p, r, f) =>
        (r.key === "speculative" ? 44 : r.key === "aggressive" ? 18 : 2) + sel(p.markets, "Small Caps") * 14 + goal(p, "Speculation") * 18 },
  ];
  // Methods are stored as composite "<catKey>§<item>"; each selected item
  // boosts the archetypes mapped to its category (window.METHOD_CAT_ARCH).
  function methodBoost(archName, methods) {
    if (!methods || !methods.length || !window.METHOD_CAT_ARCH) return 0;
    let b = 0;
    for (const m of methods) {
      const catKey = (window.methodCatKey ? window.methodCatKey(m) : "");
      const arch = window.METHOD_CAT_ARCH[catKey];
      if (arch && arch.includes(archName)) b += 12;
    }
    return Math.min(b, 40);
  }

  function classifyInvestor(p) {
    const r = riskProfile(p);
    const f = pref(p);
    let scored = ARCHETYPES.map(a => ({ name: a.name, raw: clamp(a.scorer(p, r, f) + methodBoost(a.name, p.methods), 0, 140) }));
    const max = Math.max(...scored.map(s => s.raw), 1);
    scored = scored
      .map(s => ({ name: s.name, confidence: round(clamp(s.raw / max * 100)) }))
      .filter(s => s.confidence >= 45)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4);
    if (!scored.length) scored = [{ name: "Balanced Investor", confidence: 60 }];
    return scored;
  }

  // helpers for classification
  function sel(arr, v) { return arr && arr.includes(v) ? 1 : 0; }
  function goal(p, kw) { return (p.goals || []).some(g => g.toLowerCase().includes(kw.toLowerCase())) ? 1 : 0; }
  function horizonIdx(p) { return (HORIZONS[p.horizon] || HORIZONS["Swing Trader"]).idx; }

  /* ============================================================
     COMPATIBILITY SCORE (0–100) per stock
     ============================================================ */
  function compatibility(p, stock) {
    const r = riskProfile(p);
    const h = timeHorizon(p);
    const f = stock.fund, t = stock.tech, s = stock.sent;

    // ---- Fundamentals fit ----
    const growthFund = avg([f.revGrowth, f.epsGrowth, f.fcfYield]);
    const qualityFund = avg([f.margin, f.roe, f.roic, 100 - f.debt]);
    const valueFund = avg([100 - f.pe, 100 - f.peg]); // cheaper = better
    const fundamentalsFit = clamp(growthFund * 0.4 + qualityFund * 0.4 + valueFund * 0.2);

    // ---- Technicals fit ----
    const technicalsFit = clamp(avg([t.trend, t.relStrength, t.momentum, t.breakout]));

    // ---- Sentiment fit ----
    const sentimentFit = clamp(avg([s.news, s.analyst, s.institutional, s.social]));

    // ---- Risk fit: align stock volatility to user appetite ----
    const targetVol = 15 + r.score * 0.75;            // appetite -> tolerated volatility
    const riskFit = clamp(100 - Math.abs(t.volatility - targetVol) * 1.4);

    // ---- Horizon fit: short horizons reward liquidity/momentum/vol; long horizons reward quality ----
    let horizonFit;
    if (h.idx <= 1)      horizonFit = clamp(avg([t.volumeTrend, t.volatility, t.momentum, t.relStrength]));
    else if (h.idx === 2) horizonFit = clamp(avg([t.momentum, t.trend, t.breakout, t.relStrength]));
    else if (h.idx === 3) horizonFit = clamp(avg([t.trend, qualityFund, t.momentum]));
    else                  horizonFit = clamp(avg([qualityFund, growthFund, 100 - t.volatility]));

    // ---- Investor-DNA preference fit ----
    const f2 = pref(p);
    const M = p.markets || [];
    const prefHits = [];

    // growth vs value tilt
    const styleFit = clamp(f2.growthValue >= 4 ? growthFund : f2.growthValue <= 2 ? valueFund : (growthFund + valueFund) / 2);
    if (f2.growthValue >= 4 && growthFund > 60) prefHits.push("growth");
    if (f2.growthValue <= 2 && valueFund > 55) prefHits.push("value");

    // dividend preference vs actual yield
    const divTarget = (f2.dividendPref - 1) / 4 * 100;
    const dividendFit = clamp(100 - Math.abs(f.divYield - divTarget) * 0.7);
    if (f2.dividendPref >= 4 && f.divYield > 45) prefHits.push("dividend");

    // ESG preference
    const esgFit = f2.esgPref >= 4 ? clamp(stock.esg)
                 : f2.esgPref <= 2 ? 60 : clamp(50 + (stock.esg - 50) * 0.4);
    if (f2.esgPref >= 4 && stock.esg > 62) prefHits.push("ESG");

    // industry / sector interest
    const sectorFit = f2.industries.length ? (f2.industries.includes(stock.sector) ? 92 : 38) : 55;
    if (f2.industries.includes(stock.sector)) prefHits.push(stock.sector.toLowerCase());

    // geography
    const geoFit = f2.geo === "No preference" ? 60
      : f2.geo === "Global" ? (stock.region === "Global" ? 90 : 46)
      : f2.geo === "US" ? (stock.region === "US" ? 82 : 62)
      : f2.geo === "International" ? (stock.region === "Global" ? 80 : 38) : 60;
    if (f2.geo === "Global" && stock.region === "Global") prefHits.push("global");

    // market cap
    const capFit = f2.marketCap === "No preference" ? 60 : (f2.marketCap === stock.cap ? 90 : 34);
    if (f2.marketCap === stock.cap && f2.marketCap !== "No preference") prefHits.push(stock.cap.toLowerCase());
    if (M.includes("Small Caps") && stock.cap === "Small Cap") prefHits.push("small-cap");
    if (M.includes("Large Caps") && stock.cap === "Large Cap") prefHits.push("large-cap");

    const prefFit = clamp(styleFit * 0.30 + sectorFit * 0.18 + capFit * 0.16 + geoFit * 0.14 + dividendFit * 0.12 + esgFit * 0.10);

    // ---- Income fit ----
    const wantsIncome = f2.dividendPref >= 4 || M.includes("Dividend Stocks") || goal(p, "Income");
    const incomeFit = wantsIncome ? clamp(f.divYield) : 50;

    // ---- Weighting by horizon ----
    let w;
    if (h.idx <= 1) w = { fundamentalsFit: .08, technicalsFit: .34, sentimentFit: .14, riskFit: .16, horizonFit: .18, prefFit: .06, incomeFit: .04 };
    else if (h.idx === 2) w = { fundamentalsFit: .16, technicalsFit: .28, sentimentFit: .14, riskFit: .14, horizonFit: .16, prefFit: .08, incomeFit: .04 };
    else if (h.idx === 3) w = { fundamentalsFit: .30, technicalsFit: .18, sentimentFit: .10, riskFit: .14, horizonFit: .14, prefFit: .10, incomeFit: .04 };
    else w = { fundamentalsFit: .40, technicalsFit: .06, sentimentFit: .08, riskFit: .14, horizonFit: .14, prefFit: .10, incomeFit: .08 };

    // analysis-style tilt
    if (f2.analysisStyle === "Technical") { w.technicalsFit += .08; w.fundamentalsFit = Math.max(.04, w.fundamentalsFit - .08); }
    else if (f2.analysisStyle === "Fundamental") { w.fundamentalsFit += .08; w.technicalsFit = Math.max(.02, w.technicalsFit - .08); }
    else if (f2.analysisStyle === "Quantitative") { w.riskFit += .04; w.fundamentalsFit += .04; w.sentimentFit = Math.max(.02, w.sentimentFit - .06); }

    const parts = { fundamentalsFit, technicalsFit, sentimentFit, riskFit, horizonFit, prefFit, incomeFit };
    let score = 0, wsum = 0; for (const k in w) { score += parts[k] * w[k]; wsum += w[k]; }
    score = clamp(round(score / wsum));

    // ---- Explicit Confidence / Risk / Reward scores ----
    const rewardScore = clamp(round(stock.rewardRaw * 0.5 + growthFund * 0.25 + technicalsFit * 0.25));
    const riskScore = clamp(round(t.volatility * 0.6 + f.debt * 0.25 + (100 - stock.liquidity) * 0.15));
    const confidenceScore = clamp(round(54 + (sentimentFit - 50) * 0.28 + (stock.liquidity - 50) * 0.20
      + (100 - Math.abs(fundamentalsFit - technicalsFit)) * 0.12 - 6));

    const verdict = scoreToVerdict(score);
    return { score, verdict, parts, prefHits, growthFund, qualityFund, valueFund, targetVol,
      riskBand: r, horizon: h, rewardScore, riskScore, confidenceScore };
  }

  function scoreToVerdict(score) {
    if (score >= 82) return { key: "strong", label: "Strong Match", cls: "verdict-strong" };
    if (score >= 68) return { key: "match", label: "Match", cls: "verdict-match" };
    if (score >= 52) return { key: "neutral", label: "Neutral", cls: "verdict-neutral" };
    if (score >= 38) return { key: "weak", label: "Weak Match", cls: "verdict-weak" };
    return { key: "avoid", label: "Avoid", cls: "verdict-avoid" };
  }

  /* ============================================================
     STRATEGY SUITABILITY ENGINE
     Each strategy declares which metrics it favors + base text.
     Suitability = weighted blend of favored metrics, adjusted by
     the user's horizon distance and risk appetite.
     ============================================================ */
  const STRATEGIES = [
    // ---- Time Horizon Methods ----
    cat("Time Horizon Methods"),
    strat("Scalping", 0, "high", ["volumeTrend","volatility","momentum"], "Seconds–minutes",
      ["Very high intraday liquidity","Tight, fast-moving ranges to exploit"],
      ["Extreme execution & fee sensitivity","Requires full-time screen attention"]),
    strat("Day Trading", 1, "high", ["volumeTrend","volatility","relStrength","momentum"], "Intraday",
      ["Strong intraday volume and range","Reacts cleanly to news catalysts"],
      ["No overnight edge captured","High emotional/discipline demand"]),
    strat("Swing Trading", 2, "med", ["momentum","trend","breakout","relStrength"], "Days–weeks",
      ["Clean multi-day momentum and trend","Defined breakout levels"],
      ["Overnight gap risk","Whipsaw in choppy regimes"]),
    strat("Position Trading", 3, "med", ["trend","momentum","qualityFund"], "Weeks–months",
      ["Durable primary trend","Backed by improving fundamentals"],
      ["Larger drawdowns between trims","Slower to react to regime change"]),
    strat("High-Frequency Trading (educational)", 0, "high", ["volumeTrend","volatility"], "Sub-second",
      ["Illustrative only — needs co-located infra","High liquidity profile"],
      ["Not achievable for retail traders","Educational reference only"]),

    // ---- Analytical Edge Methods ----
    cat("Analytical Edge Methods"),
    strat("Price Action Trading", 2, "med", ["trend","breakout","relStrength"], "Days–weeks",
      ["Readable swing structure","Clear support/resistance reaction"],
      ["Subjective interpretation","Less reliable in low-volume names"]),
    strat("RSI / Oscillator Analysis", 2, "med", ["momentum","volatility"], "Days–weeks",
      ["Defined overbought/oversold swings","Useful mean-reversion signals"],
      ["Fails in strong trends","Frequent false signals when choppy"]),
    strat("Stochastic Analysis", 2, "med", ["momentum","volatility"], "Days–weeks",
      ["Sensitive to short-term turning points","Good for range conditions"],
      ["Noisy in trends","Needs confirmation"]),
    strat("Ichimoku Analysis", 3, "low", ["trend","momentum","relStrength"], "Weeks",
      ["All-in-one trend/support framework","Clear cloud-based bias"],
      ["Complex to read","Lags in fast reversals"]),
    strat("MACD / Trend Indicators", 3, "low", ["trend","momentum"], "Weeks",
      ["Confirms established momentum shifts","Lagging but dependable"],
      ["Late entries and exits","Weak in sideways markets"]),
    strat("Moving Average Systems", 3, "low", ["trend","relStrength"], "Weeks–months",
      ["Smooth, persistent trend to ride","Clear crossover signals"],
      ["Whipsaws in range-bound names","Lags sharp reversals"]),
    strat("Bollinger Band Analysis", 2, "med", ["volatility","momentum"], "Days–weeks",
      ["Volatility expansion/contraction is tradable","Mean-reversion edges at bands"],
      ["Band-walking in strong trends","Needs volatility context"]),
    strat("Classical Chart Patterns", 2, "med", ["breakout","trend","volumeTrend"], "Days–weeks",
      ["Recognizable continuation/reversal patterns","Volume confirms breakouts"],
      ["Pattern failure risk","Hindsight bias in identification"]),
    strat("Harmonic Pattern Recognition", 2, "high", ["breakout","volatility"], "Days–weeks",
      ["Precise Fibonacci-based reversal zones","Defined risk at pattern completion"],
      ["Subjective measurement","Lower base-rate, needs confirmation"]),
    strat("Volume Profile Analysis", 1, "med", ["volumeTrend","volatility"], "Intraday–days",
      ["Rich volume distribution to map value","Clear acceptance/rejection zones"],
      ["Data-intensive","Less meaningful in thin names"]),
    strat("Market Profile Analysis", 1, "med", ["volumeTrend","liquidityProxy"], "Intraday–days",
      ["Maps time-at-price for value areas","Useful for auction context"],
      ["Steep learning curve","Best with deep liquidity"]),
    strat("Tape Reading / Order Flow (concept)", 0, "high", ["volumeTrend","volatility"], "Intraday",
      ["High activity to read order flow","Fast feedback on supply/demand"],
      ["Requires live L2 data & focus","Educational concept for retail"]),
    strat("Quantitative / Factor Analysis", 4, "low", ["qualityFund","growthFund","valueFund"], "Months+",
      ["Strong, rankable factor exposures","Systematic and repeatable"],
      ["Requires backtesting rigor","Factor crowding risk"]),
    strat("Earnings Catalyst Analysis", 2, "high", ["growthFund","momentum","news"], "Around events",
      ["High earnings-driven expectation gaps","Active analyst revisions"],
      ["Binary event risk","Elevated implied volatility cost"]),
    strat("Global Macro Analysis", 4, "med", ["trend","qualityFund"], "Months–years",
      ["Sensitive to macro regime shifts","Liquid enough to express macro views"],
      ["Top-down calls are hard to time","Wide outcome dispersion"]),

    // ---- Strategic Mechanics ----
    cat("Strategic Mechanics Methods"),
    strat("Trend Following", 3, "med", ["trend","relStrength","momentum"], "Weeks–months",
      ["Strong, persistent directional trend","High relative strength vs market"],
      ["Painful in trend reversals","Underperforms in chop"]),
    strat("Momentum Trading", 2, "high", ["momentum","relStrength","breakout"], "Days–weeks",
      ["Top-decile momentum profile","Buyers in control"],
      ["Sharp momentum reversals","Crowded-trade risk"]),
    strat("Mean Reversion", 2, "med", ["volatility","valueFund"], "Days–weeks",
      ["Stretched moves tend to revert","Identifiable extremes"],
      ["Catching falling knives","Trends can persist longer than expected"]),
    strat("Breakout Trading", 2, "high", ["breakout","volumeTrend","momentum"], "Days–weeks",
      ["High breakout potential with volume","Defined trigger levels"],
      ["False breakouts (fakeouts)","Requires fast execution"]),
    strat("Reversal Trading", 2, "high", ["volatility","momentum"], "Days–weeks",
      ["Volatile swings create reversal setups","Sentiment extremes present"],
      ["Low base-rate of success","Timing tops/bottoms is hard"]),
    strat("Gap Trading", 1, "high", ["volatility","volumeTrend","news"], "Intraday–days",
      ["Frequent gaps from news flow","Strong follow-through volume"],
      ["Gaps can reverse violently","Overnight exposure risk"]),
    strat("Event-Driven Trading", 2, "high", ["news","momentum","growthFund"], "Around events",
      ["Active catalyst pipeline","Repricing opportunities"],
      ["Headline whipsaw","Hard to size positions"]),
    strat("News-Driven Trading", 1, "high", ["news","social","volatility"], "Intraday–days",
      ["Strong news flow to trade","Fast sentiment-driven moves"],
      ["Reversal risk after headlines","Slippage on spikes"]),

    // ---- Relative Value ----
    cat("Relative Value Methods"),
    strat("Statistical Arbitrage", 4, "high", ["volatility","qualityFund"], "Days–weeks",
      ["Mean-reverting statistical relationships","Liquid for pairing"],
      ["Model/spread breakdown risk","Needs robust infrastructure"]),
    strat("Pairs Trading", 3, "med", ["volatility","trend"], "Days–weeks",
      ["Sector peer to hedge against","Market-neutral expression"],
      ["Correlation can break down","Double the transaction costs"]),
    strat("Relative Value Analysis", 4, "low", ["valueFund","qualityFund"], "Months",
      ["Attractive valuation vs peers","Quality supports re-rating"],
      ["Value can stay cheap","Requires peer benchmarking"]),
    strat("Sector Comparison", 4, "low", ["valueFund","qualityFund","relStrength"], "Months",
      ["Ranks well within its sector","Relative strength vs peers"],
      ["Sector-wide drawdowns still hurt","Needs sector benchmark data"]),
    strat("Competitor Comparison", 4, "low", ["qualityFund","growthFund"], "Months",
      ["Stronger fundamentals than rivals","Durable competitive position"],
      ["Disruption risk","Requires peer modeling"]),
    strat("Arbitrage Concepts (educational)", 3, "high", ["valueFund","volatility"], "Days–weeks",
      ["Illustrative mispricing relationships","Market-neutral framing"],
      ["Not retail-executable at scale","Spread/model risk"]),

    // ---- Options ----
    cat("Options Strategy Analysis"),
    strat("Bull Call Spread", 3, "med", ["trend","momentum"], "Weeks–months",
      ["Defined-risk bullish exposure","Trend supports directional thesis"],
      ["Capped upside","Time decay against you"]),
    strat("Bear Put Spread", 2, "med", ["volatility"], "Weeks",
      ["Defined-risk bearish hedge","Useful if thesis turns negative"],
      ["Capped payoff","Wrong-way risk if trend up"]),
    strat("Straddle / Strangle", 2, "high", ["volatility","news"], "Around events",
      ["High realized volatility potential","Profits from large moves either way"],
      ["Expensive premium / IV crush","Needs a big move to pay off"]),
    strat("Iron Condor", 4, "med", ["valueFund"], "Weeks",
      ["Range-bound, low-volatility names suit it","Collects premium in calm tape"],
      ["Limited profit, larger tail risk","Hurt by volatility spikes"]),
    strat("Iron Butterfly", 4, "med", ["valueFund"], "Weeks",
      ["Tight range premium capture","Defined risk structure"],
      ["Narrow profit zone","Needs price to pin a strike"]),
    strat("Gamma Exposure (concept)", 2, "high", ["volatility","volumeTrend"], "Days",
      ["High volatility makes gamma meaningful","Liquid options context"],
      ["Advanced, dealer-positioning concept","Educational reference only"]),

    // ---- Modern Market ----
    cat("Modern Market Methods"),
    strat("Algorithmic / Systematic Trading", 3, "med", ["trend","volumeTrend","momentum"], "Varies",
      ["Rules-based signals are clear","Sufficient liquidity to automate"],
      ["Overfitting risk","Requires monitoring & infra"]),
    strat("Social / Sentiment Trading", 1, "high", ["social","news","momentum"], "Days",
      ["Strong retail/social attention","Sentiment momentum present"],
      ["Crowd reversals are brutal","Manipulation/pump risk"]),
    strat("Quantitative Systems", 4, "low", ["qualityFund","growthFund","valueFund"], "Months",
      ["Rankable multi-factor signal","Diversifiable & systematic"],
      ["Needs validation & discipline","Regime dependence"]),
    strat("DeFi / On-Chain (reference)", 4, "high", ["volatility","social"], "Varies",
      ["Illustrative cross-asset reference only","High-attention, high-volatility profile"],
      ["Not applicable to listed equities","Educational reference only"]),
  ];

  function cat(name) { return { __cat: name }; }
  function strat(name, horizonIdxIdeal, riskLevel, metrics, hold, pros, cons) {
    return { name, horizonIdxIdeal, riskLevel, metrics, hold, pros, cons };
  }

  // Map a metric key to a 0–100 value for a stock (incl. composite fundamentals).
  function metricValue(comp, stock, key) {
    const t = stock.tech, s = stock.sent;
    switch (key) {
      case "qualityFund": return comp.qualityFund;
      case "growthFund":  return comp.growthFund;
      case "valueFund":   return comp.valueFund;
      case "trend": return t.trend; case "relStrength": return t.relStrength;
      case "momentum": return t.momentum; case "volatility": return t.volatility;
      case "volumeTrend": return t.volumeTrend; case "breakout": return t.breakout;
      case "news": return s.news; case "social": return s.social;
      case "analyst": return s.analyst; case "institutional": return s.institutional;
      case "liquidityProxy": return stock.liquidity;
      default: return 50;
    }
  }

  function strategySuitability(p, stock) {
    const comp = compatibility(p, stock);
    const h = timeHorizon(p);
    const r = comp.riskBand;
    const out = [];
    let currentCat = "General";
    for (const item of STRATEGIES) {
      if (item.__cat) { currentCat = item.__cat; continue; }
      const base = avg(item.metrics.map(m => metricValue(comp, stock, m)));
      // horizon alignment: closer to user's horizon = higher
      const hAlign = clamp(100 - Math.abs(item.horizonIdxIdeal - h.idx) * 22);
      // risk alignment: aggressive strategies suit higher appetite
      const stratRisk = { low: 30, med: 55, high: 82 }[item.riskLevel];
      const rAlign = clamp(100 - Math.abs(stratRisk - r.score) * 0.8);
      const score = clamp(round(base * 0.6 + hAlign * 0.25 + rAlign * 0.15));
      let conf = clamp(round(60 + (base - 50) * 0.5 + (hAlign - 50) * 0.3));
      out.push({
        name: item.name, category: currentCat, score,
        confidence: conf, riskLevel: item.riskLevel, hold: item.hold,
        pros: item.pros, cons: item.cons,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  /* -------- Strategy-Fit summary (compact named ratings) -------- */
  function strategyFitSummary(p, stock) {
    const comp = compatibility(p, stock);
    const t = stock.tech, f = stock.fund;
    return [
      { name: "Long-Term Investing", score: clamp(round(avg([comp.qualityFund, comp.growthFund, 100 - t.volatility]))) },
      { name: "Swing Trading",       score: clamp(round(avg([t.momentum, t.trend, t.breakout, t.relStrength]))) },
      { name: "Momentum Trading",    score: clamp(round(avg([t.momentum, t.relStrength, t.breakout]))) },
      { name: "Value Investing",     score: clamp(round(comp.valueFund)) },
      { name: "Dividend Investing",  score: clamp(round(f.divYield)) },
      { name: "Options Strategies",  score: clamp(round(avg([t.volatility, stock.liquidity, t.volumeTrend]))) },
    ];
  }

  /* -------- Rank the whole universe -------- */
  function rankUniverse(p, universe) {
    return universe
      .map(stock => ({ stock, comp: compatibility(p, stock) }))
      .sort((a, b) => b.comp.score - a.comp.score);
  }

  return {
    riskProfile, timeHorizon, classifyInvestor, compatibility,
    strategySuitability, strategyFitSummary, rankUniverse, scoreToVerdict,
    HORIZONS, pref,
    _clamp: clamp, _avg: avg,
  };
})();

window.ENGINE = ENGINE;
