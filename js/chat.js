/* ============================================================
   chat.js — Profile-aware AI assistant (rule-based reasoning).
   Reads the user's profile, watchlist, and portfolio from
   window.IMA and answers using the same engine that powers the
   dashboard, so its answers are consistent with the rankings.

   NOTE: This runs fully offline. To upgrade to a live LLM, wire
   CHAT.callLLM() to the Claude API (hook left below) — no key is
   bundled, and nothing is sent anywhere by default.
   ============================================================ */

const CHAT = (() => {

  const SUGGESTIONS = [
    "Find me aggressive growth stocks",
    "Show stocks for my profile",
    "Which fit a dividend strategy?",
    "Compare AAPL MSFT NVDA",
    "Explain my investor profile",
  ];

  function ranked() {
    const p = IMA.profile();
    return ENGINE.rankUniverse(p, STOCK_UNIVERSE);
  }
  function findSymbols(text) {
    const up = text.toUpperCase();
    return STOCK_UNIVERSE.filter(s => new RegExp(`\\b${s.symbol}\\b`).test(up)).map(s => s.symbol);
  }
  function topList(list, n = 5) {
    return list.slice(0, n).map(r =>
      `• ${r.stock.symbol} — ${r.stock.name} · ${r.comp.score}/100 (${r.comp.verdict.label})`).join("\n");
  }

  function respond(text) {
    const p = IMA.profile();
    if (!p) return "Complete the investor assessment first, then I can tailor answers to your profile.";
    const t = text.toLowerCase();
    const syms = findSymbols(text);

    // ----- compare -----
    if ((t.includes("compare") || syms.length >= 2) && syms.length >= 2) {
      return compare(p, syms);
    }
    // ----- why match / poor match for a symbol -----
    if (syms.length === 1 && (t.includes("why") || t.includes("match") || t.includes("fit") || t.includes("good") || t.includes("bad") || t.includes("poor"))) {
      return whyMatch(p, syms[0]);
    }
    // ----- explain profile -----
    if (t.includes("my profile") || t.includes("my investor") || t.includes("who am i") || t.includes("explain my")) {
      return explainProfile(p);
    }
    // ----- dividend / income -----
    if (t.includes("dividend") || t.includes("income") || t.includes("yield")) {
      const list = ranked().filter(r => r.stock.fund.divYield > 45).slice(0, 6);
      return `Top income ideas for you (educational):\n\n${topList(list, 6)}\n\nThese carry the highest, best-supported yields in the universe. Always check payout sustainability.`;
    }
    // ----- ESG / sustainable -----
    if (t.includes("esg") || t.includes("sustainab") || t.includes("ethical")) {
      const list = ranked().filter(r => r.stock.esg >= 62).slice(0, 6);
      return `Higher-ESG names in the universe (illustrative scores):\n\n` +
        list.map(r => `• ${r.stock.symbol} — ESG ${r.stock.esg}/100 · match ${r.comp.score}`).join("\n") +
        `\n\nESG scores here are illustrative, not from a ratings provider.`;
    }
    // ----- aggressive / growth / momentum -----
    if (t.includes("aggressive") || t.includes("growth") || t.includes("momentum") || t.includes("high risk")) {
      const list = ranked().filter(r => r.comp.growthFund > 60 || r.stock.tech.momentum > 70).slice(0, 6);
      return `Aggressive growth / momentum candidates for your profile:\n\n${topList(list, 6)}\n\nThese run hotter and more volatile — size positions accordingly.`;
    }
    // ----- value -----
    if (t.includes("value") || t.includes("cheap") || t.includes("undervalued")) {
      const list = ranked().filter(r => r.comp.valueFund > 55).slice(0, 6);
      return `Value-leaning ideas screened for you:\n\n${topList(list, 6)}\n\nValue can stay cheap for a while — pair with a catalyst.`;
    }
    // ----- swing / day / scalp horizon -----
    if (t.includes("swing")) return horizonList(p, "Swing Trader", "swing-trading");
    if (t.includes("day trad")) return horizonList(p, "Day Trader", "day-trading");
    if (t.includes("scalp")) return horizonList(p, "Scalper", "scalping");
    if (t.includes("long-term") || t.includes("long term") || t.includes("buy and hold")) return horizonList(p, "Long-Term Investor", "long-term");
    // ----- watchlist / portfolio -----
    if (t.includes("watchlist")) {
      const w = IMA.watchlist();
      if (!w.length) return "Your watchlist is empty. Tap ☆ on any match to add it.";
      const list = ranked().filter(r => w.includes(r.stock.symbol));
      return `Your watchlist, scored for you:\n\n${topList(list, list.length)}`;
    }
    if (t.includes("portfolio")) {
      const pf = IMA.portfolio();
      if (!pf.length) return "Your portfolio is empty. Add holdings from the Portfolio tab to see diversification and risk.";
      return `You hold ${pf.length} position(s). Open the Portfolio tab for diversification, sector exposure, and a health score.`;
    }
    // ----- top matches / recommend -----
    if (t.includes("top") || t.includes("best") || t.includes("recommend") || t.includes("find") || t.includes("show")) {
      return `Your top matches right now:\n\n${topList(ranked(), 6)}\n\nOpen any symbol for the full AI memo. Educational only — not advice.`;
    }
    // ----- fallback -----
    return `I can help you discover and understand matches. Try:\n` +
      SUGGESTIONS.map(s => `• "${s}"`).join("\n") +
      `\n\nOr ask "why is NVDA a match for me?"`;
  }

  function horizonList(p, horizon, key) {
    const tweaked = { ...p, horizon };
    const list = ENGINE.rankUniverse(tweaked, STOCK_UNIVERSE).slice(0, 6);
    return `Best ${horizon} candidates (scored as if your horizon were ${horizon}):\n\n` +
      list.map(r => `• ${r.stock.symbol} — ${r.comp.score}/100`).join("\n") +
      `\n\nRemember these are model estimates, not signals to act on.`;
  }

  function whyMatch(p, sym) {
    const stock = STOCK_UNIVERSE.find(s => s.symbol === sym);
    const memo = MEMO.buildMemo(p, stock);
    const good = memo.comp.score >= 60;
    return `**${sym} — ${memo.comp.score}/100 (${memo.verdict.label})**\n\n` +
      `${memo.explainShort}\n\n` +
      `Strengths:\n${memo.strengths.slice(0,3).map(s => "• " + s).join("\n")}\n\n` +
      `Risks:\n${memo.keyRisks.slice(0,3).map(s => "• " + s).join("\n")}\n\n` +
      (good ? `Best-fit strategies: ${memo.strategies.slice(0,3).map(s=>s.name).join(", ")}.`
            : `Avoid if ${memo.avoidWhen.slice(0,2).join(", or if ")}.`);
  }

  function compare(p, syms) {
    const rows = syms.map(sym => {
      const stock = STOCK_UNIVERSE.find(s => s.symbol === sym);
      if (!stock) return null;
      const c = ENGINE.compatibility(p, stock);
      return { sym, c, stock };
    }).filter(Boolean).sort((a, b) => b.c.score - a.c.score);
    if (!rows.length) return "I couldn't find those symbols in the universe.";
    const best = rows[0];
    let out = `Comparison for your ${best.c.riskBand.band.toLowerCase()} ${best.c.horizon.label.toLowerCase()} profile:\n\n`;
    out += rows.map(r =>
      `**${r.sym}** ${r.c.score}/100 (${r.c.verdict.label})\n   growth ${Math.round(r.c.growthFund)} · quality ${Math.round(r.c.qualityFund)} · momentum ${r.stock.tech.momentum} · vol ${r.stock.tech.volatility}`
    ).join("\n\n");
    out += `\n\n➡️ Best fit for you: **${best.sym}** (${best.c.score}/100). Educational only.`;
    return out;
  }

  function explainProfile(p) {
    const r = ENGINE.riskProfile(p);
    const h = ENGINE.timeHorizon(p);
    const arch = ENGINE.classifyInvestor(p);
    return `**Your investor profile**\n\n` +
      `• Risk appetite: ${r.band} (${r.score}/100)\n` +
      `• Time horizon: ${h.label} — typical hold ${h.hold}\n` +
      `• Top archetypes: ${arch.map(a => `${a.name} (${a.confidence}%)`).join(", ")}\n` +
      `• Preferred markets: ${(p.markets || []).join(", ") || "—"}\n\n` +
      `I rank stocks by how well their growth, quality, valuation, technicals, and volatility fit this profile.`;
  }

  // ---- Optional live-LLM hook (disabled by default) ----
  async function callLLM(/* messages */) {
    // To enable Claude: POST to https://api.anthropic.com/v1/messages with model
    // "claude-sonnet-4-6" from your own backend (never expose an API key in the browser).
    throw new Error("Live LLM not configured — using offline reasoning engine.");
  }

  return { respond, SUGGESTIONS, callLLM };
})();

window.CHAT = CHAT;
