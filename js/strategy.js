/* ============================================================
   strategy.js — Strategy-as-a-layer scoring engine.
   Turns any method/strategy into screening criteria, scores it
   against a stock, explains the match, and ranks the universe.
   Powers "Find Matching Stocks", the drag-drop workspace, and
   the multi-strategy framework builder. Educational only.
   ============================================================ */

const STRAT = (() => {
  const clamp = (x) => Math.max(0, Math.min(100, x));
  const round = Math.round;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  // Curated draggable palette (the popular strategies users layer onto stocks).
  const PALETTE = [
    "Momentum Trading", "RSI Strategies", "Trend Following", "MACD Strategies",
    "Bollinger Bands", "Breakout Trading", "Value Investing", "Earnings Growth Analysis",
    "Dividend Growth Investing", "Quality Investing", "Wyckoff Method",
    "Mean Reversion Trading", "Swing Trading", "Relative Strength Trading",
  ];

  // Flatten each stock into named 0–100 metrics.
  function metrics(s) {
    const f = s.fund, t = s.tech, se = s.sent;
    const growth = avg([f.revGrowth, f.epsGrowth, f.fcfYield]);
    const quality = avg([f.margin, f.roe, f.roic, 100 - f.debt]);
    const value = avg([100 - f.pe, 100 - f.peg]);
    return {
      "Momentum": t.momentum, "Relative Strength": t.relStrength, "Trend": t.trend,
      "Breakout": t.breakout, "Volatility": t.volatility, "Volume": t.volumeTrend,
      "Revenue Growth": f.revGrowth, "Earnings Growth": f.epsGrowth, "Margins": f.margin,
      "ROE": f.roe, "ROIC": f.roic, "Low Debt": 100 - f.debt, "Free Cash Flow": f.fcfYield,
      "Valuation": value, "Dividend Yield": f.divYield, "Quality": quality, "Growth": growth,
      "Value": value, "News Sentiment": se.news, "Analyst": se.analyst,
      "Institutional": se.institutional, "Social": se.social, "Liquidity": s.liquidity,
      "Oversold": clamp(100 - t.momentum), "Reversal Potential": avg([t.volatility, 100 - t.momentum]),
    };
  }

  // Aliases so lesson/palette names resolve to a canonical scorer.
  const ALIAS = {
    "RSI Analysis": "RSI Strategies", "RSI Oversold": "RSI Strategies", "RSI Reversion": "RSI Strategies",
    "MACD Crossovers": "MACD Strategies", "Momentum": "Momentum Trading", "Trend": "Trend Following",
    "Earnings Growth": "Earnings Growth Analysis", "Dividend Growth": "Dividend Growth Investing",
    "Mean Reversion": "Mean Reversion Trading", "Technical Breakout": "Breakout Trading",
    "Relative Strength": "Relative Strength Trading", "Breakout Momentum": "Breakout Trading",
    "RSI Strategy": "RSI Strategies", "MACD Strategy": "MACD Strategies",
    "Bollinger Band Strategy": "Bollinger Bands", "Earnings Catalyst Strategy": "Earnings Growth Analysis",
  };

  // Explicit metric recipes for popular methods.
  const DEFS = {
    "Momentum Trading": ["Momentum", "Relative Strength", "Breakout"],
    "Trend Following": ["Trend", "Relative Strength", "Momentum"],
    "Relative Strength Trading": ["Relative Strength", "Momentum"],
    "Breakout Trading": ["Breakout", "Volume", "Momentum"],
    "RSI Strategies": ["Oversold", "Reversal Potential", "Volatility"],
    "Stochastic Strategies": ["Oversold", "Reversal Potential"],
    "MACD Strategies": ["Trend", "Momentum"],
    "Moving Average Strategies": ["Trend", "Relative Strength"],
    "Bollinger Bands": ["Reversal Potential", "Volatility"],
    "Mean Reversion Trading": ["Reversal Potential", "Volatility", "Oversold"],
    "Value Investing": ["Value", "Quality"],
    "Deep Value Investing": ["Value"],
    "Quality Investing": ["Quality", "ROIC", "Margins"],
    "Earnings Growth Analysis": ["Earnings Growth", "Revenue Growth"],
    "Revenue Growth Analysis": ["Revenue Growth"],
    "Dividend Growth Investing": ["Dividend Yield", "Quality", "Free Cash Flow"],
    "Dividend Investing": ["Dividend Yield", "Quality"],
    "Wyckoff Method": ["Volume", "Trend", "Breakout"],
    "Swing Trading": ["Momentum", "Trend", "Breakout", "Relative Strength"],
    "Volume Profile": ["Volume", "Liquidity"],
    "VWAP": ["Volume", "Liquidity"],
    "Ichimoku Cloud": ["Trend", "Momentum", "Relative Strength"],
    "Global Macro": ["Trend", "Quality"],
    "Pairs Trading": ["Volatility", "Trend"],
    "Statistical Arbitrage": ["Volatility", "Quality"],
    "Covered Calls": ["Quality", "Volatility", "Dividend Yield"],
    "Sentiment Trading": ["Social", "News Sentiment", "Reversal Potential"],
    "Options Strategies": ["Volatility", "Liquidity", "Momentum"],
  };

  // Short plain-English overview for overlay panels.
  const OVERVIEW = {
    "Momentum Trading": "Buys stocks already moving strongly, aiming to ride the move while buyers stay in control.",
    "Swing Trading": "Holds for days to weeks to capture a single multi-day swing in price.",
    "Breakout Trading": "Enters as price clears a key resistance level on expanding volume.",
    "Mean Reversion Trading": "Fades stretched moves, betting price snaps back toward its average.",
    "Value Investing": "Buys businesses trading below estimated intrinsic value with a margin of safety.",
    "Dividend Investing": "Targets durable, well-covered dividends for income plus modest growth.",
    "RSI Strategies": "Uses the RSI oscillator to time oversold bounces and overbought fades.",
    "MACD Strategies": "Follows MACD momentum shifts and crossovers to confirm trend changes.",
    "Bollinger Bands": "Trades volatility expansion/contraction and reversion at the bands.",
    "Earnings Growth Analysis": "Targets accelerating revenue/earnings, often around earnings catalysts.",
    "Trend Following": "Rides an established trend, staying in until the trend structure breaks.",
    "Quality Investing": "Owns highly profitable, capital-efficient businesses with strong moats.",
    "Dividend Growth Investing": "Focuses on companies steadily raising well-covered dividends.",
    "Relative Strength Trading": "Favors stocks outperforming the broad market.",
    "Options Strategies": "Uses defined-risk option structures to express directional or volatility views.",
  };
  function overview(item) { const n = ALIAS[item] || item; return OVERVIEW[n] || OVERVIEW[item] || `A ${item} approach evaluated against this stock's current characteristics.`; }

  // Per-category fallback recipes (every taxonomy method is covered).
  const CAT_DEFS = {
    c1: ["Value", "Quality", "Growth"], c2: ["Momentum", "Trend", "Volume"],
    c3: ["Trend", "Momentum", "Relative Strength"], c4: ["Reversal Potential", "Volatility", "Oversold"],
    c5: ["Trend", "Breakout", "Volume"], c6: ["Momentum", "Trend", "Volatility"],
    c7: ["Breakout", "Trend", "Volume"], c8: ["Volume", "Liquidity"],
    c9: ["Volume", "Liquidity", "Volatility"], c10: ["Quality", "Value", "Earnings Growth"],
    c11: ["Trend", "Quality"], c12: ["News Sentiment", "Earnings Growth", "Volatility"],
    c13: ["Quality", "Growth", "Value"], c14: ["Volatility", "Quality"],
    c15: ["Volatility", "Liquidity"], c16: ["Trend", "Momentum", "Volatility"],
    c17: ["Liquidity", "Volume"], c18: ["Trend", "Momentum", "Volume"],
    c19: ["Quality", "Low Debt"], c20: ["Quality", "Value"],
    c21: ["Momentum", "Volatility", "Social"], c22: ["Social", "News Sentiment", "Reversal Potential"],
    c23: ["Low Debt", "Quality"], c24: ["Quality", "Low Debt", "Value"],
  };

  // Illustrative historical "edge" base-rates by category (clearly not guarantees).
  const SUCCESS = { c1: 56, c3: 44, c4: 58, c5: 48, c6: 46, c7: 47, c10: 56, c11: 42, c12: 49, c13: 51, c15: 50 };

  function canon(item) { return ALIAS[item] || item; }
  function catKeyOf(item) {
    if (!window.METHOD_TAXONOMY) return null;
    const it = ALIAS[item] && false ? item : item;
    const g = window.METHOD_TAXONOMY.find(x => x.items.includes(it) || x.items.includes(canon(it)));
    return g ? g.key : null;
  }
  function labelsFor(item) {
    const name = canon(item);
    if (DEFS[name]) return DEFS[name];
    const ck = catKeyOf(item);
    return (ck && CAT_DEFS[ck]) || ["Growth", "Quality", "Trend"];
  }

  // Score one strategy on one stock + full explainability.
  function score(item, stock) {
    const M = metrics(stock);
    const labels = labelsFor(item);
    const drivers = labels.map(l => ({ name: l, val: round(M[l] != null ? M[l] : 50) }));
    const sc = clamp(round(avg(drivers.map(d => d.val))));
    const why = drivers.filter(d => d.val >= 62).map(d => `${d.name} is strong (${d.val}/100).`);
    const against = drivers.filter(d => d.val < 45).map(d => `${d.name} is weak (${d.val}/100).`);
    if (!why.length) why.push(`No standout driver — this is a middling fit.`);
    if (!against.length) against.push(`No major weakness across the screened metrics.`);

    const risks = [];
    if (stock.tech.volatility > 70) risks.push("High volatility — use wider stops and smaller size.");
    if (stock.fund.debt > 60) risks.push("Elevated debt amplifies downside.");
    if (stock.tech.trend < 40 && labels.includes("Trend")) risks.push("Fighting a downtrend lowers odds.");
    risks.push("Any strategy fails in the wrong market regime — confirm before acting.");

    const ck = catKeyOf(item);
    const successRate = SUCCESS[ck] != null ? SUCCESS[ck] : 50;
    const spread = Math.max(...drivers.map(d => d.val)) - Math.min(...drivers.map(d => d.val));
    const confidence = clamp(round(60 + (stock.liquidity - 50) * 0.3 - spread * 0.25));
    const t = stock.tech;
    const conditions = `Tape: ${t.trend > 55 ? "uptrend" : t.trend < 45 ? "downtrend" : "range-bound"}, ` +
      `volatility ${t.volatility > 60 ? "elevated" : "subdued"}, volume ${t.volumeTrend > 55 ? "rising" : "flat"}.`;

    return { item, canonical: canon(item), score: sc, drivers, why, against, risks, confidence, successRate, conditions };
  }

  function verdict(sc) {
    if (sc >= 80) return { label: "Excellent fit", cls: "verdict-strong" };
    if (sc >= 65) return { label: "Good fit", cls: "verdict-match" };
    if (sc >= 50) return { label: "Partial fit", cls: "verdict-neutral" };
    if (sc >= 38) return { label: "Weak fit", cls: "verdict-weak" };
    return { label: "Poor fit", cls: "verdict-avoid" };
  }

  // Rank the whole universe by a single strategy.
  function rankByStrategy(item, universe) {
    return universe.map(s => ({ stock: s, res: score(item, s) }))
      .sort((a, b) => b.res.score - a.res.score);
  }

  // Combine multiple strategy layers into an overall fit (weighted).
  function scoreStack(layers, stock) {
    if (!layers.length) return { overall: 0, parts: [] };
    const wsum = layers.reduce((a, l) => a + (l.weight || 1), 0) || 1;
    const parts = layers.map(l => {
      const r = score(l.item, stock);
      return { item: l.item, weight: l.weight || 1, score: r.score, res: r };
    });
    const overall = clamp(round(parts.reduce((a, p) => a + p.score * p.weight, 0) / wsum));
    return { overall, parts };
  }

  function rankByStack(layers, universe) {
    return universe.map(s => ({ stock: s, ...scoreStack(layers, s) }))
      .sort((a, b) => b.overall - a.overall);
  }

  return { PALETTE, metrics, score, verdict, rankByStrategy, scoreStack, rankByStack, canon, overview };
})();

window.STRAT = STRAT;
