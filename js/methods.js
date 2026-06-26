/* ============================================================
   methods.js — Full strategy/method taxonomy (24 categories,
   ~250 named approaches) used by the onboarding survey and the
   classification engine.

   Each item's stored value is a composite "<catKey>§<item>" so
   that strategies appearing in more than one category (e.g.
   "Statistical Arbitrage", "Swing Trading") stay distinct.
   ============================================================ */

const METHOD_TAXONOMY = [
  { key:"c1", cat:"Investing Styles", arch:["Value Investor","Growth Investor","Long-Term Investor","Conservative Wealth Builder","Dividend Investor","Income Investor"], items:[
    "Value Investing","Growth Investing","GARP (Growth at a Reasonable Price)","Dividend Investing",
    "Dividend Growth Investing","Income Investing","Quality Investing","Contrarian Investing",
    "Deep Value Investing","Activist Investing","Index Investing","Passive Investing","Factor Investing",
    "ESG Investing","Impact Investing","Thematic Investing","Sector Rotation Investing","Buy and Hold Investing",
    "Compounder Investing","Asset Allocation Investing","Risk Parity Investing","Core-Satellite Investing",
    "Family Office Style Investing","Endowment Model Investing"] },

  { key:"c2", cat:"Time Horizon Trading", arch:["Day Trader","Swing Trader","Position Trader","Long-Term Investor"], items:[
    "High-Frequency Trading (HFT)","Scalping","Micro Scalping","Day Trading","Intraday Trading",
    "Swing Trading","Position Trading","Medium-Term Trading","Long-Term Trading","Multi-Year Investing"] },

  { key:"c3", cat:"Trend & Momentum Trading", arch:["Momentum Trader","Swing Trader"], items:[
    "Trend Following","Momentum Trading","Relative Strength Trading","Dual Momentum","Time Series Momentum",
    "Cross-Sectional Momentum","Moving Average Strategies","Breakout Momentum","Trend Acceleration Trading"] },

  { key:"c4", cat:"Mean Reversion Strategies", arch:["Swing Trader"], items:[
    "Mean Reversion Trading","Statistical Mean Reversion","Bollinger Band Reversion","VWAP Reversion",
    "RSI Reversion","Oversold Bounce Trading","Overbought Reversal Trading"] },

  { key:"c5", cat:"Price Action Trading", arch:["Day Trader","Swing Trader","Speculative Trader"], items:[
    "Naked Chart Trading","Support & Resistance Trading","Supply & Demand Trading","Market Structure Trading",
    "Candlestick Trading","Order Flow Trading","Liquidity Grab Trading","Smart Money Concepts (SMC)",
    "ICT Concepts","Wyckoff Method"] },

  { key:"c6", cat:"Technical Indicator Trading", arch:["Swing Trader","Momentum Trader"], items:[
    "RSI Strategies","MACD Strategies","Stochastic Strategies","Bollinger Bands","Ichimoku Cloud","ADX Trading",
    "ATR Trading","Parabolic SAR","CCI Trading","Williams %R","Keltner Channels","Donchian Channels",
    "SuperTrend","OBV Trading","Chaikin Money Flow"] },

  { key:"c7", cat:"Chart Pattern Trading", arch:["Swing Trader"], items:[
    "Classical Patterns","Head and Shoulders","Inverse Head and Shoulders","Double Top","Double Bottom",
    "Triple Top","Triple Bottom","Triangles","Ascending Triangle","Descending Triangle","Symmetrical Triangle",
    "Wedges","Flags","Pennants","Cup and Handle","Rectangle Patterns","Harmonic Patterns","Gartley","Bat",
    "Butterfly","Crab","Shark","Cypher"] },

  { key:"c8", cat:"Volume-Based Trading", arch:["Day Trader"], items:[
    "Volume Profile","Market Profile","Volume Spread Analysis (VSA)","Accumulation Distribution",
    "OBV Strategies","Relative Volume Trading","Block Trade Analysis"] },

  { key:"c9", cat:"Order Flow Trading", arch:["Day Trader"], items:[
    "Tape Reading","Time and Sales Analysis","DOM Trading","Level II Trading","Footprint Charts",
    "Auction Market Theory","Liquidity Mapping","Order Book Imbalance Trading"] },

  { key:"c10", cat:"Fundamental Analysis", arch:["Value Investor","Long-Term Investor"], items:[
    "Earnings Growth Analysis","Revenue Growth Analysis","Cash Flow Analysis","Balance Sheet Analysis",
    "Valuation Investing","DCF Analysis","Comparable Company Analysis","Economic Moat Analysis",
    "Insider Activity Analysis"] },

  { key:"c11", cat:"Macro Trading", arch:["Macro Investor"], items:[
    "Global Macro","Top-Down Investing","Economic Cycle Investing","Central Bank Trading","Interest Rate Trading",
    "Inflation Trading","Currency Macro Trading","Geopolitical Trading"] },

  { key:"c12", cat:"Event-Driven Trading", arch:["Event Driven Investor"], items:[
    "Earnings Trading","Earnings Drift","Merger Arbitrage","Acquisition Trading","IPO Trading","Spin-Off Investing",
    "Bankruptcy Investing","Special Situations","Regulatory Event Trading"] },

  { key:"c13", cat:"Quantitative Trading", arch:["Quantitative Investor"], items:[
    "Statistical Arbitrage","Quant Factor Models","Machine Learning Models","AI-Powered Trading",
    "Predictive Analytics Trading","Alternative Data Trading","Signal-Based Trading","Systematic Trading"] },

  { key:"c14", cat:"Arbitrage Strategies", arch:["Quantitative Investor","Event Driven Investor"], items:[
    "Pure Arbitrage","Statistical Arbitrage","Pairs Trading","Basket Arbitrage","Merger Arbitrage",
    "Convertible Arbitrage","Fixed Income Arbitrage","Index Arbitrage","ETF Arbitrage","Volatility Arbitrage",
    "Triangular Arbitrage"] },

  { key:"c15", cat:"Options Trading", arch:["Options Trader"], items:[
    "Long Calls","Long Puts","Covered Calls","Protective Puts","Cash Secured Puts","Bull Call Spread",
    "Bear Put Spread","Bull Put Spread","Bear Call Spread","Calendar Spread","Diagonal Spread","Iron Condor",
    "Iron Butterfly","Butterfly Spread","Condor Spread","Straddle","Strangle","Ratio Spread","Backspread",
    "Gamma Scalping","Vega Trading"] },

  { key:"c16", cat:"Futures Trading", arch:["Speculative Trader","Macro Investor"], items:[
    "Commodity Futures","Equity Index Futures","Bond Futures","Currency Futures","Managed Futures",
    "CTA Trend Following"] },

  { key:"c17", cat:"Market Making", arch:["Day Trader","Quantitative Investor"], items:[
    "Market Making","Liquidity Provision","Spread Capture","Inventory Management Strategies"] },

  { key:"c18", cat:"Algorithmic Trading", arch:["Quantitative Investor"], items:[
    "Rule-Based Trading","Algorithmic Trading","Automated Trading","High-Frequency Trading","Smart Order Routing",
    "Execution Algorithms","TWAP","VWAP","POV Algorithms"] },

  { key:"c19", cat:"Institutional Strategies", arch:["Quantitative Investor","Conservative Wealth Builder"], items:[
    "Risk Parity","Volatility Targeting","Factor Rotation","Portfolio Optimization","Smart Beta",
    "Black-Litterman Allocation"] },

  { key:"c20", cat:"Alternative Asset Strategies", arch:["Long-Term Investor","Macro Investor"], items:[
    "REIT Investing","Private Equity Style Analysis","Venture Capital Style Analysis","Distressed Asset Investing",
    "Commodity Investing"] },

  { key:"c21", cat:"Crypto & Digital Assets", arch:["Speculative Trader"], items:[
    "Spot Trading","Crypto Swing Trading","Crypto Trend Trading","DeFi Yield Farming","Liquidity Providing",
    "AMM Strategies","Staking","Validator Operations","On-Chain Analysis","NFT Market Analysis",
    "Cross-Chain Arbitrage"] },

  { key:"c22", cat:"Behavioral & Psychological", arch:["Value Investor","Speculative Trader"], items:[
    "Contrarian Trading","Sentiment Trading","Fear & Greed Analysis","Crowd Psychology",
    "Behavioral Finance Models","Reflexivity Analysis"] },

  { key:"c23", cat:"Risk Management Frameworks", arch:["Conservative Wealth Builder","Quantitative Investor"], items:[
    "Kelly Criterion","Fixed Fractional Position Sizing","Volatility Position Sizing","Risk-Reward Analysis",
    "Portfolio Hedging","Tail Risk Hedging","Drawdown Control","Stop Loss Systems","Dynamic Risk Allocation"] },

  { key:"c24", cat:"Portfolio Construction", arch:["Conservative Wealth Builder","Quantitative Investor"], items:[
    "Modern Portfolio Theory","Efficient Frontier Optimization","Risk Parity (MPT)","Equal Weight",
    "Market Cap Weighting","Smart Beta (PC)","Factor Tilt Portfolios","Multi-Asset Allocation"] },
];

// catKey -> archetypes (for the engine's classification boost)
const METHOD_CAT_ARCH = {};
METHOD_TAXONOMY.forEach(g => { METHOD_CAT_ARCH[g.key] = g.arch; });

// Helpers for composite values "<catKey>§<item>"
function methodValue(catKey, item) { return catKey + "§" + item; }
function methodItemLabel(v) { const i = v.indexOf("§"); return i < 0 ? v : v.slice(i + 1); }
function methodCatKey(v) { const i = v.indexOf("§"); return i < 0 ? "" : v.slice(0, i); }

window.METHOD_TAXONOMY = METHOD_TAXONOMY;
window.METHOD_CAT_ARCH = METHOD_CAT_ARCH;
window.methodValue = methodValue;
window.methodItemLabel = methodItemLabel;
window.methodCatKey = methodCatKey;
