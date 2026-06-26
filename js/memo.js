/* ============================================================
   memo.js — Plain-English AI investment memo generator
   Builds explanations, bull/bear cases, entry/exit zones,
   position sizing, and risk-management plans from model outputs.
   Educational use only — uncertainty is stated throughout.
   ============================================================ */

const MEMO = (() => {
  const pct = (x) => `${x.toFixed(1)}%`;
  const lvl = (v, hi = "high", mid = "moderate", lo = "low") => v >= 67 ? hi : v >= 40 ? mid : lo;

  // Short, profile-aware match explanation (used on cards).
  function explain(p, stock, comp) {
    const f = stock.fund, t = stock.tech;
    const bits = [];
    if (comp.growthFund > 65) bits.push("strong growth profile");
    if (comp.qualityFund > 70) bits.push("high-quality fundamentals");
    if (comp.valueFund > 60) bits.push("reasonable valuation");
    if (t.momentum > 70) bits.push("powerful momentum");
    if (t.trend > 70) bits.push("a healthy uptrend");
    if (f.divYield > 55) bits.push("an attractive dividend");
    if (!bits.length) bits.push("a mixed but balanced setup");
    const fit = comp.score >= 68 ? "aligns well with" : comp.score >= 52 ? "partially fits" : "does not fit";
    const volNote = t.volatility > comp.targetVol + 18
      ? " Note: it is more volatile than your stated comfort level."
      : t.volatility < comp.targetVol - 22 ? " It may feel slow for your risk appetite." : "";
    return `${stock.symbol} ${fit} your ${comp.riskBand.band.toLowerCase()} ${comp.horizon.label.toLowerCase()} profile thanks to ${listJoin(bits)}.${volNote}`;
  }

  function strengths(stock, comp) {
    const f = stock.fund, t = stock.tech, s = stock.sent, out = [];
    if (f.revGrowth > 60) out.push(`Revenue is growing fast (growth score ${f.revGrowth}/100).`);
    if (f.margin > 70) out.push(`Highly profitable with strong margins.`);
    if (f.roic > 70) out.push(`Excellent capital efficiency (high ROIC).`);
    if (f.debt < 35) out.push(`Conservative balance sheet with low debt.`);
    if (t.relStrength > 70) out.push(`Outperforming the broad market (relative strength).`);
    if (t.trend > 70) out.push(`In a confirmed uptrend.`);
    if (s.analyst > 80) out.push(`Strong analyst support.`);
    if (s.institutional > 82) out.push(`Heavy institutional ownership.`);
    if (f.divYield > 55) out.push(`Pays a meaningful, well-supported dividend.`);
    if (!out.length) out.push(`No standout strengths; profile is broadly average.`);
    return out.slice(0, 5);
  }

  function risks(stock, comp) {
    const f = stock.fund, t = stock.tech, s = stock.sent, out = [];
    if (t.volatility > 70) out.push(`Highly volatile — expect large price swings.`);
    if (f.debt > 65) out.push(`Elevated debt load increases downside risk.`);
    if (f.pe > 55) out.push(`Richly valued; little room for disappointment.`);
    if (f.epsGrowth < 10) out.push(`Earnings growth is weak or stalling.`);
    if (t.trend < 40) out.push(`Currently in a downtrend.`);
    if (s.news < 50) out.push(`Soft news sentiment recently.`);
    if (s.social > 88) out.push(`Crowded with retail attention — prone to sharp reversals.`);
    if (t.volatility > comp.targetVol + 18) out.push(`More volatile than your stated risk comfort.`);
    if (!out.length) out.push(`No major red flags, but all equities carry market risk.`);
    return out.slice(0, 5);
  }

  // Risks grouped by type, per spec (business / financial / market / sector).
  function risksByType(stock, comp) {
    const f = stock.fund, t = stock.tech;
    return {
      Business: f.epsGrowth < 15 ? "Slowing earnings growth and execution risk could pressure results."
        : f.revGrowth > 70 ? "Lofty growth expectations are priced in — any slowdown disappoints."
        : "Competitive pressure and execution are the main operational risks.",
      Financial: f.debt > 60 ? "Elevated leverage raises refinancing and balance-sheet risk."
        : f.pe > 55 ? "A stretched valuation leaves little margin of safety."
        : "Balance sheet looks manageable, but watch margins and cash flow.",
      Market: t.volatility > 70 ? "High beta means broad market drawdowns hit this name hard."
        : "Macro shifts (rates, liquidity, risk appetite) can move the whole tape.",
      Sector: `As a ${stock.sector} name, it carries sector-specific cyclicality and regulation risk; ` +
        `sector-wide rotation can override company fundamentals.`,
    };
  }

  function catalysts(stock) {
    const f = stock.fund, t = stock.tech, s = stock.sent, out = [];
    if (f.epsGrowth > 60) out.push(`Upcoming earnings could beat on strong growth momentum.`);
    if (t.breakout > 70) out.push(`Technical breakout above resistance is possible.`);
    if (s.analyst > 78) out.push(`Potential analyst upgrades / target raises.`);
    if (f.revGrowth > 70) out.push(`New product or segment expansion driving the top line.`);
    if (s.institutional > 82) out.push(`Continued institutional accumulation.`);
    if (!out.length) out.push(`Sector rotation or macro shifts could re-rate the stock.`);
    return out.slice(0, 4);
  }

  function avoidWhen(p, stock, comp) {
    const out = [];
    if (stock.tech.volatility > comp.targetVol + 15) out.push(`you cannot tolerate sharp drawdowns`);
    if (comp.horizon.idx >= 3 && stock.fund.pe > 55) out.push(`you are valuation-sensitive for long holds`);
    if (comp.horizon.idx <= 1 && stock.tech.volumeTrend < 50) out.push(`you need deep intraday liquidity`);
    if (stock.fund.divYield < 25 && (p.markets || []).includes("Dividend Stocks")) out.push(`income is your primary objective`);
    if (comp.score < 52) out.push(`you want a clean, high-conviction fit`);
    if (!out.length) out.push(`your portfolio is already concentrated in this sector`);
    return out;
  }

  // Exit / thesis-invalidation conditions (educational).
  function exitConditions(p, stock, comp, z) {
    const out = [];
    out.push(`Price closes decisively below the $${z.stop} stop level on rising volume.`);
    if (stock.fund.epsGrowth > 40) out.push(`Earnings growth decelerates materially or guidance is cut.`);
    if (stock.fund.pe > 50) out.push(`The premium valuation compresses as growth slows — multiple re-rating risk.`);
    if (stock.tech.trend > 60) out.push(`The uptrend breaks (lower highs / loss of key moving averages).`);
    if (stock.fund.divYield > 50) out.push(`The dividend is cut or coverage deteriorates.`);
    if (comp.horizon.idx <= 2) out.push(`Momentum and relative strength roll over versus the market.`);
    out.push(`The original reason you bought it no longer holds — exit, don't rationalize.`);
    return out.slice(0, 5);
  }

  // Where this fits in a diversified portfolio.
  function portfolioFit(p, stock, comp) {
    const size = comp.riskScore > 70 ? "a small, satellite" : comp.score >= 70 ? "a core" : "a modest";
    const role = stock.fund.divYield > 50 ? "income anchor"
      : comp.growthFund > 65 ? "growth engine"
      : comp.valueFund > 60 ? "value ballast"
      : stock.tech.volatility > 70 ? "high-beta tactical position" : "balanced holding";
    return `Best used as ${size} ${role} in the ${stock.sector} sleeve. ` +
      `Given its ${lvl(stock.tech.volatility, "high", "moderate", "low")} volatility, keep correlated ${stock.sector} ` +
      `exposure in check and pair it with lower-correlation names to smooth the overall ride.`;
  }

  // Entry/exit zones derived from price + support/resistance proxies.
  function zones(stock) {
    const px = stock.price;
    const vol = stock.tech.volatility / 100;
    const support = +(px * (1 - 0.05 - vol * 0.06)).toFixed(2);
    const resistance = +(px * (1 + 0.06 + vol * 0.07)).toFixed(2);
    const entryLo = +(px * (1 - 0.02 - vol * 0.03)).toFixed(2);
    const entryHi = +(px * (1 + 0.01)).toFixed(2);
    const stop = +(support * 0.985).toFixed(2);
    const target1 = +(px * (1 + 0.08 + vol * 0.05)).toFixed(2);
    const target2 = +(resistance * 1.04).toFixed(2);
    return { support, resistance, entryLo, entryHi, stop, target1, target2 };
  }

  // Position sizing: smaller for higher volatility / weaker fit / lower appetite.
  function positionSize(p, comp, stock) {
    const r = comp.riskBand.score;
    const conc = (p.concentration || 3);
    let base = 3 + r * 0.06 + conc * 1.2;             // % of portfolio
    base *= comp.score / 75;                           // scale by fit
    base *= 1 - (stock.tech.volatility / 100) * 0.4;   // shrink for volatility
    const sizePct = Math.max(1, Math.min(12, base));
    return `${sizePct.toFixed(1)}% of portfolio (suggested cap)`;
  }

  function riskPlan(p, comp, stock, z) {
    const stopPct = ((stock.price - z.stop) / stock.price * 100);
    return [
      `Use a stop near $${z.stop} (~${stopPct.toFixed(1)}% downside) to define your risk.`,
      `Size the position so a stop-out loses no more than 1–2% of total capital.`,
      `Scale in within the $${z.entryLo}–$${z.entryHi} entry zone rather than all at once.`,
      comp.horizon.idx <= 2
        ? `Trim into strength near $${z.target1}; trail the remainder.`
        : `Review the thesis each earnings season; add on confirmation, not hope.`,
      `Re-check this match as conditions change — model scores are estimates, not predictions.`,
    ];
  }

  // Full memo object.
  function buildMemo(p, stock) {
    const comp = ENGINE.compatibility(p, stock);
    const z = zones(stock);
    const f = stock.fund, t = stock.tech;
    const strat = ENGINE.strategySuitability(p, stock);
    const topStrat = strat.slice(0, 3);

    const exec = `${stock.symbol} (${stock.name}) scores ${comp.score}/100 for your ${comp.riskBand.band.toLowerCase()} ` +
      `${comp.horizon.label.toLowerCase()} profile — a ${comp.verdict.label.toLowerCase()}. ` +
      `It shows ${lvl(comp.growthFund)} growth, ${lvl(comp.qualityFund)} quality, and ${lvl(t.momentum)} momentum, ` +
      `with ${lvl(t.volatility)} volatility. The strongest fits are ${topStrat.map(s => s.name).join(", ").toLowerCase()}.`;

    const bull = `If ${stock.name} keeps executing, ${lvl(f.revGrowth, "rapid", "steady", "slow")} revenue growth and ` +
      `${lvl(f.margin, "wide", "decent", "thin")} margins could compound value. ` +
      `${t.trend > 60 ? "The uptrend and " : ""}${t.relStrength > 60 ? "market-beating relative strength suggest buyers remain in control." : "stabilizing technicals could attract new buyers."}`;

    const bear = `The bear case rests on ${f.pe > 50 ? "a stretched valuation that leaves no margin for error" : "execution and macro risk"}` +
      `${f.debt > 60 ? ", a heavy debt load" : ""}${t.volatility > 70 ? ", and outsized volatility that can punish poor timing" : ""}. ` +
      `A sentiment shift could compress the multiple quickly.`;

    const valuation = `Valuation looks ${f.pe < 35 ? "reasonable to attractive" : f.pe < 55 ? "full but not extreme" : "expensive"} ` +
      `(P/E score ${f.pe}/100, PEG ${f.peg}/100). ${f.divYield > 45 ? `It also offers an income cushion.` : `Returns would lean on price appreciation rather than yield.`}`;

    const technical = `Technically, trend is ${lvl(t.trend)}, momentum ${lvl(t.momentum)}, and breakout potential ${lvl(t.breakout)}. ` +
      `Support sits near $${z.support} and resistance near $${z.resistance}.`;

    const sentiment = `Sentiment is ${lvl(stock.sent.news)} on news, with ${lvl(stock.sent.analyst)} analyst support and ` +
      `${lvl(stock.sent.institutional)} institutional backing. Social attention is ${lvl(stock.sent.social)}.`;

    const investorType = comp.score >= 68
      ? `Best suited to ${comp.horizon.label.toLowerCase()}s with a ${comp.riskBand.band.toLowerCase()} appetite — like you.`
      : `Better suited to a different profile than yours; treat any position as opportunistic.`;

    return {
      comp, zones: z, strategies: strat,
      strategyFit: ENGINE.strategyFitSummary(p, stock),
      executive: exec, bull, bear, valuation, technical, sentiment,
      growthDrivers: catalysts(stock),
      keyRisks: risks(stock, comp),
      keyRisksByType: risksByType(stock, comp),
      strengths: strengths(stock, comp),
      catalysts: catalysts(stock),
      avoidWhen: avoidWhen(p, stock, comp),
      exitConditions: exitConditions(p, stock, comp, z),
      portfolioFit: portfolioFit(p, stock, comp),
      investorType,
      positionSize: positionSize(p, comp, stock),
      riskPlan: riskPlan(p, comp, stock, z),
      verdict: comp.verdict,
      explainShort: explain(p, stock, comp),
    };
  }

  function listJoin(arr) {
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
  }

  return { buildMemo, explain, strengths, risks, catalysts, avoidWhen, zones };
})();

window.MEMO = MEMO;
