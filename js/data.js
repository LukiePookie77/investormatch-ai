/* ============================================================
   data.js — Curated stock universe (illustrative seed data)
   --------------------------------------------------------------
   NOTE: Figures are realistic illustrative values for a model
   demonstration, NOT live market data. No network calls are made.
   Metrics are normalized 0–100 unless otherwise noted.
   ============================================================ */

// Deterministic price-history generator so charts are stable across reloads.
function genHistory(symbol, trend, vol, last) {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i) * (i + 1);
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const n = 60;
  const drift = (trend - 50) / 50 * (last * 0.004);     // trend bias
  const sigma = (vol / 100) * (last * 0.022) + last * 0.004;
  let price = last - drift * n;                          // back out a start
  const out = [];
  for (let i = 0; i < n; i++) {
    price += drift + (rnd() - 0.5) * 2 * sigma;
    if (price < last * 0.3) price = last * 0.3;
    out.push(+price.toFixed(2));
  }
  out[out.length - 1] = last;                            // pin to current
  return out;
}

// Multinationals with meaningful non-US revenue exposure (for geo preference).
const GLOBAL_SYMS = new Set(["AAPL","MSFT","NVDA","GOOGL","META","KO","PG","JNJ","XOM","V","AVGO","LLY","MRK","CAT","COST","SHOP"]);
// Base ESG score by sector (0–100), nudged per-symbol below.
const ESG_BY_SECTOR = {
  "Technology":68,"Healthcare":62,"Financials":58,"Consumer Staples":66,
  "Consumer Disc.":55,"Communication":56,"Energy":28,"Industrials":46,"Real Estate":54,
};

const STOCK_UNIVERSE = [
  // sym, name, sector, cap(B), price, chgPct,
  // fundamentals: revGrowth, epsGrowth, margin, roe, roic, debt(0=low risk..100=high), fcfYield, pe, peg, divYield
  // technicals: trend, relStrength, momentum, volatility, volumeTrend, breakout
  // sentiment: news, analyst(0-100), institutional, social
  mk("AAPL","Apple Inc.","Technology",3100,212.4,0.6,
     {revGrowth:42,epsGrowth:48,margin:88,roe:95,roic:90,debt:35,fcfYield:62,pe:32,peg:55,divYield:8},
     {trend:78,relStrength:72,momentum:68,volatility:38,volumeTrend:60,breakout:64},
     {news:74,analyst:82,institutional:88,social:80}),

  mk("MSFT","Microsoft Corp.","Technology",3300,452.1,0.9,
     {revGrowth:55,epsGrowth:58,margin:90,roe:88,roic:84,debt:28,fcfYield:55,pe:36,peg:60,divYield:14},
     {trend:82,relStrength:80,momentum:74,volatility:34,volumeTrend:58,breakout:62},
     {news:80,analyst:90,institutional:92,social:72}),

  mk("NVDA","NVIDIA Corp.","Technology",3050,128.7,2.1,
     {revGrowth:96,epsGrowth:97,margin:92,roe:96,roic:94,debt:20,fcfYield:48,pe:52,peg:30,divYield:2},
     {trend:94,relStrength:95,momentum:93,volatility:78,volumeTrend:90,breakout:88},
     {news:88,analyst:93,institutional:90,social:96}),

  mk("AMZN","Amazon.com Inc.","Consumer Disc.",1900,186.3,-0.4,
     {revGrowth:60,epsGrowth:85,margin:48,roe:55,roic:50,debt:42,fcfYield:40,pe:44,peg:38,divYield:0},
     {trend:74,relStrength:70,momentum:66,volatility:48,volumeTrend:62,breakout:60},
     {news:72,analyst:88,institutional:85,social:74}),

  mk("GOOGL","Alphabet Inc.","Communication",2100,178.9,0.3,
     {revGrowth:58,epsGrowth:62,margin:72,roe:78,roic:74,debt:18,fcfYield:58,pe:26,peg:42,divYield:5},
     {trend:70,relStrength:66,momentum:60,volatility:42,volumeTrend:55,breakout:58},
     {news:70,analyst:85,institutional:86,social:68}),

  mk("META","Meta Platforms","Communication",1300,498.2,1.4,
     {revGrowth:64,epsGrowth:88,margin:68,roe:80,roic:76,debt:22,fcfYield:60,pe:28,peg:34,divYield:4},
     {trend:80,relStrength:78,momentum:76,volatility:56,volumeTrend:68,breakout:70},
     {news:66,analyst:84,institutional:82,social:78}),

  mk("TSLA","Tesla Inc.","Consumer Disc.",780,243.1,-1.8,
     {revGrowth:35,epsGrowth:20,margin:38,roe:42,roic:40,debt:30,fcfYield:25,pe:62,peg:80,divYield:0},
     {trend:48,relStrength:44,momentum:50,volatility:92,volumeTrend:84,breakout:74},
     {news:54,analyst:58,institutional:64,social:94}),

  mk("JPM","JPMorgan Chase","Financials",560,201.5,0.5,
     {revGrowth:30,epsGrowth:28,margin:60,roe:64,roic:50,debt:55,fcfYield:50,pe:14,peg:50,divYield:48},
     {trend:68,relStrength:64,momentum:58,volatility:40,volumeTrend:52,breakout:54},
     {news:66,analyst:78,institutional:84,social:50}),

  mk("V","Visa Inc.","Financials",560,275.8,0.2,
     {revGrowth:38,epsGrowth:42,margin:82,roe:86,roic:84,debt:24,fcfYield:52,pe:30,peg:48,divYield:16},
     {trend:72,relStrength:70,momentum:62,volatility:32,volumeTrend:48,breakout:52},
     {news:70,analyst:86,institutional:88,social:48}),

  mk("JNJ","Johnson & Johnson","Healthcare",380,158.2,0.1,
     {revGrowth:18,epsGrowth:14,margin:65,roe:58,roic:54,debt:38,fcfYield:54,pe:15,peg:70,divYield:62},
     {trend:52,relStrength:46,momentum:40,volatility:26,volumeTrend:40,breakout:38},
     {news:60,analyst:70,institutional:80,social:42}),

  mk("UNH","UnitedHealth Group","Healthcare",480,512.6,-0.6,
     {revGrowth:32,epsGrowth:30,margin:42,roe:66,roic:60,debt:40,fcfYield:50,pe:18,peg:46,divYield:30},
     {trend:58,relStrength:54,momentum:48,volatility:44,volumeTrend:50,breakout:46},
     {news:58,analyst:80,institutional:86,social:44}),

  mk("PG","Procter & Gamble","Consumer Staples",390,167.4,0.0,
     {revGrowth:14,epsGrowth:16,margin:58,roe:60,roic:52,debt:36,fcfYield:48,pe:26,peg:75,divYield:50},
     {trend:54,relStrength:48,momentum:42,volatility:22,volumeTrend:38,breakout:36},
     {news:58,analyst:68,institutional:78,social:38}),

  mk("KO","Coca-Cola Co.","Consumer Staples",270,62.3,0.2,
     {revGrowth:16,epsGrowth:18,margin:62,roe:64,roic:50,debt:48,fcfYield:46,pe:24,peg:72,divYield:64},
     {trend:50,relStrength:44,momentum:38,volatility:20,volumeTrend:36,breakout:34},
     {news:56,analyst:66,institutional:80,social:46}),

  mk("XOM","Exxon Mobil","Energy",480,113.7,1.1,
     {revGrowth:22,epsGrowth:24,margin:46,roe:54,roic:48,debt:34,fcfYield:64,pe:13,peg:55,divYield:66},
     {trend:62,relStrength:58,momentum:56,volatility:50,volumeTrend:54,breakout:56},
     {news:60,analyst:64,institutional:74,social:48}),

  mk("HD","Home Depot","Consumer Disc.",380,358.9,0.4,
     {revGrowth:20,epsGrowth:22,margin:50,roe:90,roic:70,debt:58,fcfYield:50,pe:23,peg:62,divYield:48},
     {trend:60,relStrength:56,momentum:50,volatility:34,volumeTrend:46,breakout:48},
     {news:62,analyst:74,institutional:82,social:46}),

  mk("COST","Costco Wholesale","Consumer Staples",380,852.4,0.7,
     {revGrowth:28,epsGrowth:30,margin:40,roe:78,roic:68,debt:26,fcfYield:38,pe:48,peg:70,divYield:14},
     {trend:80,relStrength:76,momentum:68,volatility:30,volumeTrend:50,breakout:54},
     {news:72,analyst:80,institutional:86,social:56}),

  mk("AVGO","Broadcom Inc.","Technology",780,168.2,1.6,
     {revGrowth:50,epsGrowth:54,margin:74,roe:72,roic:66,debt:52,fcfYield:56,pe:34,peg:44,divYield:24},
     {trend:86,relStrength:84,momentum:80,volatility:58,volumeTrend:72,breakout:76},
     {news:74,analyst:88,institutional:84,social:70}),

  mk("AMD","Advanced Micro Devices","Technology",240,148.5,2.4,
     {revGrowth:52,epsGrowth:70,margin:50,roe:40,roic:38,debt:18,fcfYield:32,pe:46,peg:36,divYield:0},
     {trend:64,relStrength:62,momentum:70,volatility:74,volumeTrend:78,breakout:80},
     {news:68,analyst:78,institutional:76,social:84}),

  mk("CRM","Salesforce Inc.","Technology",260,268.1,-0.7,
     {revGrowth:44,epsGrowth:60,margin:58,roe:46,roic:42,debt:28,fcfYield:44,pe:40,peg:40,divYield:6},
     {trend:62,relStrength:58,momentum:54,volatility:52,volumeTrend:56,breakout:58},
     {news:64,analyst:80,institutional:80,social:60}),

  mk("PLTR","Palantir Technologies","Technology",110,42.8,3.2,
     {revGrowth:78,epsGrowth:90,margin:62,roe:30,roic:28,debt:10,fcfYield:28,pe:78,peg:48,divYield:0},
     {trend:90,relStrength:92,momentum:90,volatility:88,volumeTrend:92,breakout:90},
     {news:70,analyst:60,institutional:62,social:98}),

  mk("SOFI","SoFi Technologies","Financials",9,8.4,4.1,
     {revGrowth:70,epsGrowth:60,margin:34,roe:18,roic:16,debt:62,fcfYield:18,pe:70,peg:52,divYield:0},
     {trend:66,relStrength:70,momentum:78,volatility:94,volumeTrend:88,breakout:86},
     {news:58,analyst:56,institutional:54,social:90}),

  mk("ENPH","Enphase Energy","Energy",12,98.6,-2.6,
     {revGrowth:24,epsGrowth:10,margin:44,roe:48,roic:44,debt:40,fcfYield:30,pe:30,peg:60,divYield:0},
     {trend:34,relStrength:30,momentum:36,volatility:90,volumeTrend:70,breakout:62},
     {news:46,analyst:58,institutional:60,social:66}),

  mk("DIS","Walt Disney Co.","Communication",200,109.5,0.3,
     {revGrowth:18,epsGrowth:34,margin:36,roe:24,roic:22,debt:50,fcfYield:34,pe:22,peg:44,divYield:12},
     {trend:48,relStrength:44,momentum:46,volatility:46,volumeTrend:48,breakout:50},
     {news:54,analyst:70,institutional:74,social:58}),

  mk("PFE","Pfizer Inc.","Healthcare",160,28.3,-0.5,
     {revGrowth:8,epsGrowth:6,margin:48,roe:30,roic:26,debt:56,fcfYield:40,pe:12,peg:80,divYield:78},
     {trend:30,relStrength:26,momentum:28,volatility:42,volumeTrend:44,breakout:32},
     {news:44,analyst:58,institutional:70,social:40}),

  mk("T","AT&T Inc.","Communication",140,19.8,0.1,
     {revGrowth:6,epsGrowth:8,margin:40,roe:34,roic:24,debt:78,fcfYield:62,pe:10,peg:78,divYield:88},
     {trend:46,relStrength:42,momentum:36,volatility:30,volumeTrend:38,breakout:34},
     {news:48,analyst:56,institutional:68,social:36}),

  mk("O","Realty Income Corp.","Real Estate",50,58.7,0.2,
     {revGrowth:20,epsGrowth:8,margin:30,roe:20,roic:18,debt:70,fcfYield:44,pe:38,peg:82,divYield:92},
     {trend:44,relStrength:40,momentum:34,volatility:28,volumeTrend:34,breakout:30},
     {news:52,analyst:62,institutional:72,social:38}),

  mk("LLY","Eli Lilly & Co.","Healthcare",760,798.2,1.2,
     {revGrowth:62,epsGrowth:84,margin:60,roe:88,roic:80,debt:44,fcfYield:34,pe:64,peg:42,divYield:12},
     {trend:88,relStrength:86,momentum:82,volatility:50,volumeTrend:64,breakout:72},
     {news:80,analyst:90,institutional:88,social:76}),

  mk("WMT","Walmart Inc.","Consumer Staples",560,69.4,0.3,
     {revGrowth:18,epsGrowth:24,margin:34,roe:62,roic:48,debt:46,fcfYield:42,pe:30,peg:66,divYield:22},
     {trend:76,relStrength:72,momentum:64,volatility:26,volumeTrend:46,breakout:50},
     {news:68,analyst:80,institutional:84,social:50}),

  mk("BA","Boeing Co.","Industrials",110,182.6,-1.2,
     {revGrowth:12,epsGrowth:-5,margin:18,roe:10,roic:8,debt:90,fcfYield:10,pe:80,peg:90,divYield:0},
     {trend:32,relStrength:28,momentum:30,volatility:64,volumeTrend:60,breakout:44},
     {news:38,analyst:54,institutional:66,social:52}),

  mk("CAT","Caterpillar Inc.","Industrials",170,345.1,0.6,
     {revGrowth:22,epsGrowth:26,margin:42,roe:72,roic:58,debt:54,fcfYield:48,pe:16,peg:54,divYield:30},
     {trend:70,relStrength:66,momentum:60,volatility:42,volumeTrend:50,breakout:56},
     {news:64,analyst:72,institutional:80,social:46}),

  mk("MRK","Merck & Co.","Healthcare",300,128.9,0.4,
     {revGrowth:24,epsGrowth:40,margin:54,roe:60,roic:52,debt:42,fcfYield:46,pe:20,peg:48,divYield:42},
     {trend:60,relStrength:56,momentum:50,volatility:34,volumeTrend:46,breakout:48},
     {news:62,analyst:76,institutional:82,social:44}),

  mk("SHOP","Shopify Inc.","Technology",90,68.3,1.9,
     {revGrowth:66,epsGrowth:74,margin:52,roe:28,roic:26,debt:14,fcfYield:30,pe:72,peg:46,divYield:0},
     {trend:72,relStrength:74,momentum:78,volatility:80,volumeTrend:76,breakout:82},
     {news:66,analyst:72,institutional:70,social:80}),
];

function symHash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))&0x7fffffff; return h; }

// Builder: attaches price history + categorical flags + derived discovery fields.
function mk(symbol, name, sector, capB, price, chgPct, fund, tech, sent) {
  const cap = capB >= 200 ? "Large Cap" : capB >= 10 ? "Mid Cap" : "Small Cap";
  const hv = (symHash(symbol) % 17) - 8;                  // -8..+8 jitter
  const region = GLOBAL_SYMS.has(symbol) ? "Global" : "US";
  const esg = clamp100((ESG_BY_SECTOR[sector] || 50) + hv);
  // liquidity: bigger + higher volume trend = deeper market
  const liquidity = clamp100((cap === "Large Cap" ? 88 : cap === "Mid Cap" ? 66 : 46) + (tech.volumeTrend - 50) * 0.35);
  // insider activity: net buying signal (50 = neutral)
  const insider = clamp100(48 + ((symHash(symbol) % 41) - 20));
  // risk-adjusted return potential proxy (reward vs volatility)
  const reward = clamp100((fund.revGrowth*0.3 + fund.epsGrowth*0.3 + tech.momentum*0.25 + tech.breakout*0.15));
  sent = { ...sent, insider };
  return {
    symbol, name, sector, industry: sector, capB, cap, price, chgPct,
    region, esg, liquidity, rewardRaw: reward,
    fund, tech, sent,
    history: genHistory(symbol, tech.trend, tech.volatility, price),
  };
}
function clamp100(x){ return Math.max(0, Math.min(100, Math.round(x))); }

// expose
window.STOCK_UNIVERSE = STOCK_UNIVERSE;
