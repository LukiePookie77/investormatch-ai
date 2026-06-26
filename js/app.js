/* ============================================================
   app.js — State, routing, views, and wiring.
   ============================================================ */

/* ---------------- State (localStorage) ---------------- */
const STORE_KEY = "ima_state_v1";
let STATE = loadState();

function loadState() {
  let st = { profile: null, watchlist: [], portfolio: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) st = JSON.parse(raw);
  } catch (e) {}
  if (!st.workspace) st.workspace = {};   // { symbol: [strategyItems] }
  if (!st.framework) st.framework = [];   // [{ item, weight }]
  return st;
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(STATE)); } catch (e) {}
}

/* Shared namespace for the chat assistant */
window.IMA = {
  profile: () => STATE.profile,
  watchlist: () => STATE.watchlist,
  portfolio: () => STATE.portfolio,
  openStock: (sym) => navigate("detail", sym),
};

/* ---------------- DOM refs ---------------- */
const $ = (s) => document.querySelector(s);
const content = $("#content");
const nav = $("#mainnav");

/* ---------------- Toast ---------------- */
function APP_toast(msg) {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}
window.APP_toast = APP_toast;

/* ---------------- Router ---------------- */
let currentView = "dashboard";
let currentSym = null;

// Strategy Overlay Analysis state
let overlayStrategies = [];
let overlaySym = null;
let contentDropBound = false;
const DOCK_STRATEGIES = ["Momentum Trading","Swing Trading","Breakout Trading","Mean Reversion",
  "Value Investing","Dividend Investing","RSI Strategy","MACD Strategy","Bollinger Band Strategy",
  "Earnings Catalyst Strategy","Options Strategies","Trend Following"];

function navigate(view, sym) {
  currentView = view;
  currentSym = sym || null;
  // toggle chrome
  const hasProfile = !!STATE.profile;
  nav.classList.toggle("hidden", !hasProfile);
  $("#disclaimer-banner").classList.toggle("hidden", !hasProfile);
  $("#chat-toggle").classList.toggle("hidden", !hasProfile);
  $("#retake-btn").classList.toggle("hidden", !hasProfile);
  const onDetail = hasProfile && view === "detail";
  $("#strategy-dock").classList.toggle("hidden", !onDetail);
  document.body.classList.toggle("dock-open", onDetail);
  if (view !== "detail") closeOverlay();
  // nav active
  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.view === view));
  // render
  if (!hasProfile) return renderSurvey();
  switch (view) {
    case "dashboard": return renderDashboard();
    case "scanner": return renderScanner();
    case "builder": return renderBuilder();
    case "learn": return renderLearn();
    case "detail": return renderDetail(sym);
    case "watchlist": return renderWatchlist();
    case "portfolio": return renderPortfolio();
    case "profile": return renderProfile();
    default: return renderDashboard();
  }
  window.scrollTo(0, 0);
}

/* ---------------- Survey ---------------- */
function renderSurvey() {
  nav.classList.add("hidden");
  SURVEY.start(content, (profile) => {
    STATE.profile = profile;
    saveState();
    navigate("dashboard");
    APP_toast("Profile created — discovering your matches…");
  }, STATE.profile);
}

/* ---------------- Dashboard ---------------- */
let dashFilter = { q: "", market: "all", sort: "score", verdict: "all" };

function renderDashboard() {
  const p = STATE.profile;
  const r = ENGINE.riskProfile(p);
  const h = ENGINE.timeHorizon(p);
  const arch = ENGINE.classifyInvestor(p);

  const archChips = arch.map(a =>
    `<span class="chip">${a.name} <span class="conf">${a.confidence}%</span></span>`).join("");

  const summary = `
    <div class="profile-summary">
      <div class="card ps-card">
        <div class="section-title">🧬 Your Investor DNA</div>
        <div class="ps-archetypes">${archChips}</div>
        <p class="dim" style="margin:14px 0 0;font-size:13px">
          Confidence reflects how strongly your answers match each archetype.
        </p>
      </div>
      <div class="card ps-card" style="text-align:center">
        <div class="section-title">Risk profile</div>
        ${CHARTS.riskGauge(r.score, r.band)}
      </div>
      <div class="card ps-card">
        <div class="section-title">Your style</div>
        <div style="font-size:22px;font-weight:800;margin-bottom:4px">${h.label}</div>
        <div class="dim" style="font-size:13px">Typical hold: ${h.hold}</div>
        <div style="margin-top:12px">
          <span class="badge badge-${r.key}">${r.band}</span>
        </div>
        <div class="dim" style="font-size:12.5px;margin-top:12px">
          Markets: ${(p.markets || []).join(", ") || "—"}
        </div>
      </div>
    </div>`;

  const toolbar = `
    <div class="toolbar">
      <input type="search" id="dash-search" placeholder="Search symbol or name…" value="${dashFilter.q}">
      <select id="dash-market">
        <option value="all">All markets</option>
        <option value="Large Cap">Large Cap</option>
        <option value="Mid Cap">Mid Cap</option>
        <option value="Small Cap">Small Cap</option>
      </select>
      <select id="dash-verdict">
        <option value="all">All verdicts</option>
        <option value="strong">Strong Match</option>
        <option value="match">Match</option>
        <option value="neutral">Neutral</option>
        <option value="weak">Weak Match</option>
        <option value="avoid">Avoid</option>
      </select>
      <div class="spacer"></div>
      <div class="seg" id="dash-sort">
        <button data-sort="score" class="${dashFilter.sort==='score'?'active':''}">Best Match</button>
        <button data-sort="momentum" class="${dashFilter.sort==='momentum'?'active':''}">Momentum</button>
        <button data-sort="div" class="${dashFilter.sort==='div'?'active':''}">Yield</button>
      </div>
    </div>`;

  let ranked = ENGINE.rankUniverse(p, STOCK_UNIVERSE);

  // filters
  if (dashFilter.q) {
    const q = dashFilter.q.toLowerCase();
    ranked = ranked.filter(x => x.stock.symbol.toLowerCase().includes(q) || x.stock.name.toLowerCase().includes(q));
  }
  if (dashFilter.market !== "all") ranked = ranked.filter(x => x.stock.cap === dashFilter.market);
  if (dashFilter.verdict !== "all") ranked = ranked.filter(x => x.comp.verdict.key === dashFilter.verdict);
  if (dashFilter.sort === "momentum") ranked.sort((a,b)=>b.stock.tech.momentum - a.stock.tech.momentum);
  else if (dashFilter.sort === "div") ranked.sort((a,b)=>b.stock.fund.divYield - a.stock.fund.divYield);

  const cards = ranked.map(matchCard).join("") ||
    `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">🔍</div>No stocks match these filters.</div>`;

  content.innerHTML = `
    <div class="page-head">
      <div><h1>AI Recommendation Feed</h1>
      <p>${ranked.length} opportunities discovered & ranked for your profile. Click any card for the full memo.</p></div>
    </div>
    ${summary}
    ${toolbar}
    <div class="match-grid">${cards}</div>`;

  // wire
  $("#dash-search").addEventListener("input", e => { dashFilter.q = e.target.value; debouncedDash(); });
  $("#dash-market").value = dashFilter.market;
  $("#dash-market").addEventListener("change", e => { dashFilter.market = e.target.value; renderDashboard(); });
  $("#dash-verdict").value = dashFilter.verdict;
  $("#dash-verdict").addEventListener("change", e => { dashFilter.verdict = e.target.value; renderDashboard(); });
  $("#dash-sort").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => { dashFilter.sort = b.dataset.sort; renderDashboard(); }));
  content.querySelectorAll(".match-card").forEach(c =>
    c.addEventListener("click", (e) => {
      if (e.target.closest(".star-btn")) return;
      navigate("detail", c.dataset.sym);
    }));
  content.querySelectorAll(".star-btn").forEach(b =>
    b.addEventListener("click", (e) => { e.stopPropagation(); toggleWatch(b.dataset.sym); renderDashboard(); }));
}

let _dashT;
function debouncedDash() { clearTimeout(_dashT); _dashT = setTimeout(renderDashboard, 220); }

function matchCard({ stock, comp }) {
  const memo = MEMO.explain(STATE.profile, stock, comp);
  const chg = stock.chgPct >= 0 ? `+${stock.chgPct}%` : `${stock.chgPct}%`;
  const starred = STATE.watchlist.includes(stock.symbol);
  return `<div class="card match-card" data-sym="${stock.symbol}">
    <div class="mc-top">
      <div>
        <div class="mc-sym">${stock.symbol}
          <button class="star-btn ghost-btn btn-sm" data-sym="${stock.symbol}" title="Watchlist"
            style="padding:2px 7px;margin-left:6px">${starred ? "★" : "☆"}</button>
        </div>
        <div class="mc-name">${stock.name}</div>
      </div>
      <div class="mc-price">
        <div class="px">$${stock.price}</div>
        <div class="chg ${stock.chgPct>=0?'pos':'neg'}">${chg}</div>
      </div>
    </div>
    <div class="mc-mid">
      ${CHARTS.scoreMeter(comp.score, 78, "Match")}
      <div style="flex:1">
        <div class="mc-verdict ${comp.verdict.cls}">${comp.verdict.label}</div>
        <div class="dim" style="font-size:12px;margin-top:3px">${stock.sector} · ${stock.cap}</div>
        <div class="mc-tags">
          <span class="tag">Risk ${ENGINE._clamp(Math.round(stock.tech.volatility))}</span>
          <span class="tag">${comp.horizon.label}</span>
          ${stock.fund.divYield>45?'<span class="tag">Dividend</span>':''}
        </div>
      </div>
    </div>
    ${CHARTS.sparkline(stock.history)}
    <div class="mc-explain">${memo}</div>
  </div>`;
}

/* ---------------- Learn (AI Tutor) ---------------- */
let learnQuery = "";
let learnSel = null;      // { catKey, item }
let learnExpanded = null; // Set of open category keys

function escAttr(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function hlMethod(t, qy){ if(!qy) return t; const i=t.toLowerCase().indexOf(qy); if(i<0) return t;
  return t.slice(0,i)+"<mark>"+t.slice(i,i+qy.length)+"</mark>"+t.slice(i+qy.length); }

function buildLearnList() {
  const qy = learnQuery.trim().toLowerCase();
  const groups = window.METHOD_TAXONOMY.map(g => {
    const vis = qy ? g.items.filter(it => it.toLowerCase().includes(qy)) : g.items;
    if (qy && !vis.length) return "";
    const open = qy ? true : learnExpanded.has(g.key);
    const body = open ? `<div class="mtree-body">${vis.map(it => {
      const on = learnSel && learnSel.catKey === g.key && learnSel.item === it;
      return `<button class="opt mtree-item ${on ? "selected" : ""}" data-learn="${escAttr(g.key + "§" + it)}">${hlMethod(it, qy)}</button>`;
    }).join("")}</div>` : "";
    return `<div class="mtree-cat"><div class="mtree-head" data-lcat="${g.key}">
      <span><span class="mtree-caret">${open ? "▾" : "▸"}</span> ${g.cat}</span>
      <span class="mtree-count faint">/${g.items.length}</span></div>${body}</div>`;
  }).join("");
  return groups || `<div class="empty-state" style="padding:24px"><div class="es-icon">🔍</div>No methods match “${escAttr(learnQuery)}”.</div>`;
}

function renderLearn() {
  if (!learnExpanded) learnExpanded = new Set((window.METHOD_TAXONOMY || []).map(g => g.key));
  content.innerHTML = pageHead("Learn — AI Tutor",
    "Browse or search every method. Pick one and the AI Tutor explains how it works, how to use it step by step, with an illustrative graph.") +
    `<div class="learn-grid">
      <div class="card panel learn-browse">
        <input id="learn-search" class="mtree-search" type="search" placeholder="🔍 Search methods to learn…" value="${escAttr(learnQuery)}">
        <div class="mtree" id="learn-list">${buildLearnList()}</div>
      </div>
      <div class="card panel" id="learn-lesson">${learnSel ? LEARN.render(learnSel.catKey, learnSel.item) : LEARN.welcome()}</div>
    </div>`;

  const s = $("#learn-search");
  s.addEventListener("input", e => { learnQuery = e.target.value; rebuildLearnList(); });
  bindLearnListItems();
  bindLearnFeatures();
  bindLessonActions();
}

function bindLessonActions() {
  const panel = $("#learn-lesson");
  if (!panel) return;
  panel.querySelectorAll("[data-find]").forEach(b =>
    b.addEventListener("click", () => openMatchesModal(b.getAttribute("data-find"))));
  panel.querySelectorAll("[data-open]").forEach(r =>
    r.addEventListener("click", () => navigate("detail", r.getAttribute("data-open"))));
}

// Modal listing stocks ranked by a single strategy (the "Find Matching Stocks" flow).
function openMatchesModal(item) {
  const ranked = STRAT.rankByStrategy(item, STOCK_UNIVERSE).slice(0, 12);
  openModal(`
    <h3 style="margin-bottom:4px">⚡ Stocks matching <span class="accent">${item}</span></h3>
    <p class="dim" style="font-size:12.5px;margin:0 0 14px">Ranked by how strongly each stock exhibits this strategy's characteristics. Click one to open it (the strategy is added to its workspace).</p>
    <div class="match-list">
      ${ranked.map(r => `
        <div class="ml-row" data-sym="${r.stock.symbol}">
          <span style="font-weight:800;width:64px">${r.stock.symbol}</span>
          <span class="dim" style="flex:1;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.stock.name}</span>
          <span style="width:90px">${CHARTS.meter(r.res.score)}</span>
          <span class="mono" style="width:34px;text-align:right;color:${CHARTS.scoreColor(r.res.score)};font-weight:800">${r.res.score}</span>
        </div>`).join("")}
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" id="mm-close">Close</button></div>`);
  $("#modal-panel").classList.add("glass");
  $("#mm-close").addEventListener("click", () => { $("#modal-panel").classList.remove("glass"); closeModal(); });
  $("#modal-panel").querySelectorAll(".ml-row").forEach(row =>
    row.addEventListener("click", () => {
      const sym = row.getAttribute("data-sym");
      addLayerForSym(sym, item);
      $("#modal-panel").classList.remove("glass");
      closeModal();
      navigate("detail", sym);
    }));
}

function addLayerForSym(sym, item) {
  STATE.workspace[sym] = STATE.workspace[sym] || [];
  if (!STATE.workspace[sym].includes(item)) STATE.workspace[sym].push(item);
  saveState();
}

function rebuildLearnList() {
  const box = $("#learn-list");
  if (!box) return;
  box.innerHTML = buildLearnList();
  bindLearnListItems();
}

function selectLesson(catKey, item) {
  learnSel = { catKey, item };
  $("#learn-lesson").innerHTML = LEARN.render(catKey, item);
  bindLessonActions();
  rebuildLearnList();
  $("#learn-lesson").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function bindLearnListItems() {
  content.querySelectorAll("[data-learn]").forEach(el =>
    el.addEventListener("click", () => {
      const v = el.getAttribute("data-learn"); const i = v.indexOf("§");
      selectLesson(v.slice(0, i), v.slice(i + 1));
    }));
  content.querySelectorAll("[data-lcat]").forEach(el =>
    el.addEventListener("click", () => {
      const k = el.getAttribute("data-lcat");
      if (learnExpanded.has(k)) learnExpanded.delete(k); else learnExpanded.add(k);
      rebuildLearnList();
    }));
}

function bindLearnFeatures() {
  content.querySelectorAll("[data-feature]").forEach(el =>
    el.addEventListener("click", () => {
      const item = el.getAttribute("data-feature");
      const g = window.METHOD_TAXONOMY.find(x => x.items.includes(item));
      if (g) selectLesson(g.key, item);
    }));
}

/* ---------------- Multi-Strategy Builder ---------------- */
let builderScope = "universe";

function addFw(item) {
  if (!STATE.framework.some(l => l.item === item)) STATE.framework.push({ item, weight: 25 });
  saveState(); renderBuilder();
}
function shortName(s) { return s.length > 14 ? s.slice(0, 12) + "…" : s; }

function renderBuilder() {
  const fw = STATE.framework;
  let universe = STOCK_UNIVERSE;
  if (builderScope === "watchlist") universe = STOCK_UNIVERSE.filter(s => STATE.watchlist.includes(s.symbol));
  if (builderScope === "portfolio") universe = STOCK_UNIVERSE.filter(s => (STATE.portfolio || []).some(h => h.symbol === s.symbol));
  const wsum = fw.reduce((a, l) => a + (l.weight || 0), 0) || 1;

  const palette = STRAT.PALETTE.map(it => `<button class="strat-chip" data-add="${escAttr(it)}">+ ${it}</button>`).join("");
  const allOpts = window.METHOD_TAXONOMY.map(g =>
    `<optgroup label="${g.cat}">${g.items.map(it => `<option value="${escAttr(it)}">${it}</option>`).join("")}</optgroup>`).join("");

  const fwHtml = fw.length ? fw.map((l, idx) => `
    <div class="fw-row">
      <span class="fw-name">${l.item}</span>
      <input class="fw-weight" type="number" min="0" max="100" value="${l.weight}" data-wi="${idx}">
      <span class="fw-pct mono">${Math.round((l.weight || 0) / wsum * 100)}%</span>
      <button class="wsl-rm" data-fwrm="${idx}" title="Remove">✕</button>
    </div>`).join("") : `<div class="ws-empty">Add strategies (click a chip or use the dropdown) to build your framework.</div>`;

  let results;
  if (fw.length && universe.length) {
    const ranked = STRAT.rankByStack(fw, universe).slice(0, 20);
    results = `<div style="overflow-x:auto"><table class="list-table">
      <thead><tr><th>#</th><th>Symbol</th>${fw.map(l => `<th title="${escAttr(l.item)}">${shortName(l.item)}</th>`).join("")}<th>Overall</th></tr></thead>
      <tbody>${ranked.map((r, i) => `<tr data-sym="${r.stock.symbol}">
        <td class="dim">${i + 1}</td>
        <td style="font-weight:800">${r.stock.symbol}<div class="dim" style="font-size:11px;font-weight:400">${r.stock.sector}</div></td>
        ${r.parts.map(p => `<td><span style="color:${CHARTS.scoreColor(p.score)};font-weight:700">${p.score}</span></td>`).join("")}
        <td><span style="color:${CHARTS.scoreColor(r.overall)};font-weight:800;font-size:16px">${r.overall}</span></td>
      </tr>`).join("")}</tbody></table></div>`;
  } else if (!fw.length) {
    results = `<div class="empty-state"><div class="es-icon">🧱</div>Build a framework to rank stocks by your custom weights.</div>`;
  } else {
    results = `<div class="empty-state"><div class="es-icon">📭</div>No stocks in this scope yet.</div>`;
  }

  content.innerHTML = pageHead("Multi-Strategy Builder",
    "Stack strategies with weights to create a custom screener, then rank stocks by your own framework. Saved automatically.") +
    `<div class="detail-grid">
      <div class="card panel">
        <h3>Your framework</h3>
        <p class="dim" style="font-size:12.5px;margin-top:-6px">Weights are normalized to 100%.</p>
        <div class="strat-palette">${palette}</div>
        <div style="display:flex;gap:8px;margin:12px 0">
          <select id="fw-select" class="fw-select">${allOpts}</select>
          <button class="btn btn-sm" id="fw-addsel">Add</button>
        </div>
        <div class="fw-list">${fwHtml}</div>
        ${fw.length ? `<button class="btn btn-ghost btn-sm" id="fw-clear" style="margin-top:12px">Clear all</button>` : ""}
      </div>
      <div class="card panel">
        <div class="toolbar"><h3 style="margin:0">Ranked results</h3><div class="spacer"></div>
          <div class="seg" id="fw-scope">
            <button data-scope="universe" class="${builderScope === 'universe' ? 'active' : ''}">Universe</button>
            <button data-scope="watchlist" class="${builderScope === 'watchlist' ? 'active' : ''}">Watchlist</button>
            <button data-scope="portfolio" class="${builderScope === 'portfolio' ? 'active' : ''}">Portfolio</button>
          </div>
        </div>
        ${results}
      </div>
    </div>`;

  content.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => addFw(b.getAttribute("data-add"))));
  if ($("#fw-addsel")) $("#fw-addsel").addEventListener("click", () => { const v = $("#fw-select").value; if (v) addFw(v); });
  content.querySelectorAll("[data-wi]").forEach(inp => inp.addEventListener("change", () => {
    const i = +inp.getAttribute("data-wi"); STATE.framework[i].weight = Math.max(0, +inp.value || 0); saveState(); renderBuilder();
  }));
  content.querySelectorAll("[data-fwrm]").forEach(b => b.addEventListener("click", () => {
    STATE.framework.splice(+b.getAttribute("data-fwrm"), 1); saveState(); renderBuilder();
  }));
  if ($("#fw-clear")) $("#fw-clear").addEventListener("click", () => { STATE.framework = []; saveState(); renderBuilder(); });
  content.querySelectorAll("#fw-scope button").forEach(b => b.addEventListener("click", () => { builderScope = b.getAttribute("data-scope"); renderBuilder(); }));
  content.querySelectorAll("tr[data-sym]").forEach(tr => tr.addEventListener("click", () => navigate("detail", tr.dataset.sym)));
}

/* ---------------- Market Opportunity Scanner ---------------- */
let scanPreset = "all";
const SCAN_PRESETS = [
  { k: "all",      label: "All matches",        f: () => true,                                    sort: r => r.comp.score },
  { k: "momentum", label: "🚀 High momentum",   f: r => r.stock.tech.momentum >= 70,              sort: r => r.stock.tech.momentum },
  { k: "growth",   label: "📈 High growth",     f: r => r.comp.growthFund >= 65,                  sort: r => r.comp.growthFund },
  { k: "value",    label: "💎 Deep value",      f: r => r.comp.valueFund >= 55,                   sort: r => r.comp.valueFund },
  { k: "income",   label: "💵 High yield",      f: r => r.stock.fund.divYield >= 45,              sort: r => r.stock.fund.divYield },
  { k: "quality",  label: "🛡️ Quality & low vol", f: r => r.comp.qualityFund >= 65 && r.stock.tech.volatility <= 45, sort: r => r.comp.qualityFund },
  { k: "breakout", label: "⚡ Breakout watch",  f: r => r.stock.tech.breakout >= 70,              sort: r => r.stock.tech.breakout },
  { k: "small",    label: "🔬 Small / mid caps", f: r => r.stock.cap !== "Large Cap",             sort: r => r.comp.score },
];

function renderScanner() {
  const p = STATE.profile;
  const preset = SCAN_PRESETS.find(x => x.k === scanPreset) || SCAN_PRESETS[0];
  let rows = ENGINE.rankUniverse(p, STOCK_UNIVERSE).filter(preset.f);
  rows.sort((a, b) => preset.sort(b) - preset.sort(a));

  const chips = SCAN_PRESETS.map(x =>
    `<button class="opt ${x.k===scanPreset?'selected':''}" data-preset="${x.k}" style="display:inline-block;width:auto;margin:0 6px 8px 0;padding:8px 14px">${x.label}</button>`).join("");

  const table = rows.length ? `
    <table class="list-table">
      <thead><tr><th>Symbol</th><th>Sector</th><th>Cap</th><th>Match</th><th>Reward</th><th>Risk</th><th class="num">Yield</th><th class="num">Price</th></tr></thead>
      <tbody>${rows.map(({stock,comp}) => `
        <tr data-sym="${stock.symbol}">
          <td style="font-weight:800">${stock.symbol}<div class="dim" style="font-size:11px;font-weight:400">${stock.name}</div></td>
          <td class="dim">${stock.sector}</td>
          <td class="dim">${stock.cap}</td>
          <td><span style="color:${CHARTS.scoreColor(comp.score)};font-weight:800">${comp.score}</span></td>
          <td><span style="color:${CHARTS.scoreColor(comp.rewardScore)}">${comp.rewardScore}</span></td>
          <td><span style="color:${CHARTS.scoreColor(100-comp.riskScore)}">${comp.riskScore}</span></td>
          <td class="num mono">${stock.fund.divYield>0?(stock.fund.divYield/12).toFixed(1)+'%':'—'}</td>
          <td class="num mono">$${stock.price}</td>
        </tr>`).join("")}
      </tbody>
    </table>` :
    `<div class="empty-state"><div class="es-icon">🔍</div>No opportunities match this screen right now.</div>`;

  content.innerHTML = pageHead("Market Opportunity Scanner",
    "AI screens the whole universe and surfaces opportunities — you never need to know what to search for.") +
    `<div class="card panel" style="margin-bottom:18px"><div class="section-title">Opportunity screens</div>${chips}</div>
     <div class="card panel">
       <h3>${rows.length} opportunit${rows.length===1?'y':'ies'} found · ${preset.label}</h3>
       ${table}
       <p class="faint" style="font-size:11px;margin-top:12px">Yield shown is an illustrative annualized estimate. Educational only.</p>
     </div>`;

  content.querySelectorAll("[data-preset]").forEach(b =>
    b.addEventListener("click", () => { scanPreset = b.dataset.preset; renderScanner(); }));
  content.querySelectorAll("tr[data-sym]").forEach(tr =>
    tr.addEventListener("click", () => navigate("detail", tr.dataset.sym)));
}

/* ---------------- Live quote cache (Yahoo via backend) ---------------- */
const QUOTES = {};
const _qReq = new Set();
function fetchQuote(sym) {
  if (!window.__BACKEND || _qReq.has(sym)) return;
  _qReq.add(sym);
  fetch("api/quote?symbol=" + encodeURIComponent(sym))
    .then(r => r.ok ? r.json() : null)
    .then(q => { if (q && q.price) { QUOTES[sym] = q; if (currentView === "detail" && currentSym === sym) renderDetail(sym); } })
    .catch(() => {});
}
function liveFields(stock) {
  const q = QUOTES[stock.symbol];
  const price = q ? +q.price : stock.price;
  const pct = q && q.changePct != null ? q.changePct : stock.chgPct;
  const dollar = q && q.change != null ? q.change : price * pct / 100;
  const vol = q && q.volume ? q.volume : dayVolume(stock);
  return { q, price, pct, dollar, vol };
}

/* ---------------- Ticker helpers ---------------- */
function fmtCap(b) { return b >= 1000 ? "$" + (b / 1000).toFixed(2) + "T" : "$" + b.toFixed(0) + "B"; }
function fmtVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return "" + v;
}
function marketStatus() {
  const d = new Date(), day = d.getDay(), t = d.getHours() * 60 + d.getMinutes();
  const weekday = day >= 1 && day <= 5;
  const open = weekday && t >= 570 && t < 960; // ~9:30–16:00 local
  return open ? { open: true, label: "Open · Delayed" } : { open: false, label: weekday ? "Market Closed" : "Weekend · Closed" };
}
function dayVolume(stock) {
  const s = TIMELINE.series(stock, "Max").pts;
  return s[s.length - 1].volume;
}
function asOfLabel() {
  return new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function tickerBar(stock) {
  const st = marketStatus();
  const { price, pct, dollar, vol } = liveFields(stock);
  const dStr = (dollar >= 0 ? "+" : "−") + "$" + Math.abs(dollar).toFixed(2);
  const pStr = (pct >= 0 ? "+" : "") + (+pct).toFixed(2) + "%";
  const cls = pct >= 0 ? "pos" : "neg";
  return `<div class="ticker-bar">
    <span class="tk ${st.open ? "tk-live" : "tk-closed"}"><span class="tk-dot"></span>${st.label}</span>
    <span class="tk"><span class="tk-k">Last</span><span class="mono">$${(+price).toFixed(2)}</span></span>
    <span class="tk"><span class="tk-k">Change</span><span class="${cls}">${dStr} (${pStr})</span></span>
    <span class="tk"><span class="tk-k">Volume</span>${fmtVol(vol)}</span>
    <span class="tk"><span class="tk-k">Mkt Cap</span>${fmtCap(stock.capB)}</span>
    <span class="tk"><span class="tk-k">As of</span>${asOfLabel()}</span>
    <span class="tk-spacer"></span>
    ${dataSourceBadge()}
  </div>`;
}

function dataSourceBadge() {
  const b = window.__BACKEND;
  if (b && b.dataSource === "yahoo") return `<span class="tk tk-src" style="color:var(--pos);border-color:rgba(38,208,124,.4)" title="Live quotes from Yahoo Finance via the Python backend.">● Data: Yahoo Finance (live)</span>`;
  if (b && b.dataSource === "finnhub") return `<span class="tk tk-src" style="color:var(--pos);border-color:rgba(38,208,124,.4)" title="Live quotes from Finnhub via the Python backend.">● Data: Finnhub (live)</span>`;
  if (b) return `<span class="tk tk-src" style="color:var(--accent);border-color:rgba(61,214,196,.4)" title="Served by the Python backend, but Yahoo was unreachable — showing simulated quotes.">◷ Data: Python backend (simulated)</span>`;
  return `<span class="tk tk-src" title="Opened directly from a file — no backend. Run run_server.bat to start the Python backend for live Yahoo Finance prices.">◷ Data: Simulated (demo)</span>`;
}

/* ---------------- Stock Detail ---------------- */
function renderDetail(sym) {
  const stock = STOCK_UNIVERSE.find(s => s.symbol === sym);
  if (!stock) return navigate("dashboard");
  if (overlaySym !== sym) { overlayStrategies = []; overlaySym = sym; document.getElementById("overlay-root").classList.add("hidden"); }
  const p = STATE.profile;
  const memo = MEMO.buildMemo(p, stock);
  const c = memo.comp;
  const z = memo.zones;
  if (window.__BACKEND) fetchQuote(sym);
  const lf = liveFields(stock);
  const chg = lf.pct >= 0 ? `+${(+lf.pct).toFixed(2)}%` : `${(+lf.pct).toFixed(2)}%`;
  const starred = STATE.watchlist.includes(sym);

  const breakdown = [
    ["Fundamentals", c.parts.fundamentalsFit],
    ["Technicals", c.parts.technicalsFit],
    ["Risk alignment", c.parts.riskFit],
    ["Horizon fit", c.parts.horizonFit],
    ["Sentiment", c.parts.sentimentFit],
    ["Market preference", c.parts.prefFit],
  ].map(([label, v]) => `
    <div class="metric">
      <div class="m-label">${label}</div>
      <div class="m-val">${Math.round(v)}</div>
      <div class="m-bar">${CHARTS.meter(Math.round(v))}</div>
    </div>`).join("");

  const fundMetrics = [
    ["Revenue Growth", stock.fund.revGrowth], ["Earnings Growth", stock.fund.epsGrowth],
    ["Profit Margin", stock.fund.margin], ["ROE", stock.fund.roe], ["ROIC", stock.fund.roic],
    ["Debt Level", stock.fund.debt], ["FCF Yield", stock.fund.fcfYield],
    ["Valuation (P/E)", stock.fund.pe], ["Dividend Yield", stock.fund.divYield],
  ].map(([l,v]) => metricBox(l, v)).join("");

  const techMetrics = [
    ["Trend Strength", stock.tech.trend], ["Relative Strength", stock.tech.relStrength],
    ["Momentum", stock.tech.momentum], ["Volatility", stock.tech.volatility],
    ["Volume Trend", stock.tech.volumeTrend], ["Breakout Potential", stock.tech.breakout],
  ].map(([l,v]) => metricBox(l, v)).join("");

  const sentMetrics = [
    ["News Sentiment", stock.sent.news], ["Analyst Rating", stock.sent.analyst],
    ["Institutional", stock.sent.institutional], ["Social Sentiment", stock.sent.social],
  ].map(([l,v]) => metricBox(l, v)).join("");

  // strategy table grouped by category
  const stratByCat = {};
  memo.strategies.forEach(s => { (stratByCat[s.category] = stratByCat[s.category] || []).push(s); });
  const stratHtml = Object.entries(stratByCat).map(([catName, list]) => `
    <div class="strat-cat">${catName}</div>
    <table class="strat-table">
      <thead><tr><th>Strategy</th><th>Suitability</th><th>Confidence</th><th>Risk</th><th>Hold</th></tr></thead>
      <tbody>${list.map(s => `
        <tr title="${[...s.pros.map(x=>'+ '+x),...s.cons.map(x=>'− '+x)].join('\n')}">
          <td>${s.name}</td>
          <td><span class="strat-score" style="color:${CHARTS.scoreColor(s.score)}">${s.score}</span>
              <span style="display:inline-block;width:60px;vertical-align:middle">${CHARTS.meter(s.score)}</span></td>
          <td class="mono">${s.confidence}%</td>
          <td><span class="risk-pill risk-${s.riskLevel}">${s.riskLevel.toUpperCase()}</span></td>
          <td class="dim" style="font-size:12px">${s.hold}</td>
        </tr>`).join("")}
      </tbody>
    </table>`).join("");

  content.innerHTML = `
    <button class="ghost-btn btn-sm" id="back-btn" style="margin-bottom:16px">← Back to feed</button>
    <div class="detail-head">
      <div class="dh-left">
        <h1>${stock.symbol} <span class="${c.verdict.cls}" style="font-size:15px">● ${c.verdict.label}</span></h1>
        <p class="co">${stock.name} · ${stock.sector} · ${stock.cap}</p>
      </div>
      <div class="dh-px">
        <div class="px">$${(+lf.price).toFixed(2)}</div>
        <div class="chg ${lf.pct>=0?'pos':'neg'}" style="font-weight:700">${(lf.pct>=0?'+':'−')}$${Math.abs(lf.dollar).toFixed(2)} (${chg}) today</div>
        <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
          <button class="ghost-btn btn-sm" id="d-watch">${starred ? "★ In watchlist" : "☆ Watchlist"}</button>
          <button class="btn btn-sm" id="d-add">+ Add to portfolio</button>
        </div>
      </div>
    </div>

    ${tickerBar(stock)}

    <div class="port-stats" style="margin-bottom:18px">
      ${statCard(c.score, "Overall Rating", CHARTS.scoreColor(c.score))}
      ${statCard(c.confidenceScore + "%", "Confidence", CHARTS.scoreColor(c.confidenceScore))}
      ${statCard(c.rewardScore, "Reward Potential", CHARTS.scoreColor(c.rewardScore))}
      ${statCard(c.riskScore, "Risk Score", CHARTS.scoreColor(100 - c.riskScore))}
    </div>

    <div class="detail-grid">
      <div>
        <div class="card panel">
          <h3>Interactive Timeline <span class="dim" style="font-size:12px;font-weight:400">· zoom across timeframes</span></h3>
          <div id="d-timeline"></div>
          <div id="d-tf-summary" class="tf-summary"></div>
        </div>

        <div class="card panel">
          <h3>Why this score — compatibility breakdown</h3>
          <div class="metric-grid">${breakdown}</div>
        </div>

        <div id="ws-panel">${renderWorkspacePanel(sym)}</div>

        <div class="card panel memo">
          <h3>AI Investment Memo <span class="dim" style="font-size:12px;font-weight:400">· educational</span></h3>
          <h4>Executive Summary</h4><p>${memo.executive}</p>
          <h4>Bull Case</h4><p>${memo.bull}</p>
          <h4>Bear Case</h4><p>${memo.bear}</p>
          <h4>Key Strengths</h4><ul>${memo.strengths.map(li).join("")}</ul>
          <h4>Key Risks</h4><ul>${memo.keyRisks.map(li).join("")}</ul>
          <h4>Risks by Type</h4>
          <ul>${Object.entries(memo.keyRisksByType).map(([k,v]) => `<li><strong>${k}:</strong> ${v}</li>`).join("")}</ul>
          <h4>Growth Drivers & Catalysts</h4><ul>${memo.growthDrivers.map(li).join("")}</ul>
          <h4>Valuation</h4><p>${memo.valuation}</p>
          <h4>Technical Outlook</h4><p>${memo.technical}</p>
          <h4>Market Sentiment</h4><p>${memo.sentiment}</p>
          <h4>Recommended Investor Type</h4><p>${memo.investorType}</p>
          <h4>Avoid Investing If…</h4><p>You should be cautious if ${memo.avoidWhen.join(", or if ")}.</p>

          <h4>Suggested Entry / Exit Zones</h4>
          <div class="zones">
            <div class="zone"><div class="z-label">Entry zone</div><div class="z-val">$${z.entryLo}–$${z.entryHi}</div></div>
            <div class="zone"><div class="z-label">Stop / risk</div><div class="z-val neg">$${z.stop}</div></div>
            <div class="zone"><div class="z-label">Target 1</div><div class="z-val pos">$${z.target1}</div></div>
            <div class="zone"><div class="z-label">Support</div><div class="z-val">$${z.support}</div></div>
            <div class="zone"><div class="z-label">Resistance</div><div class="z-val">$${z.resistance}</div></div>
            <div class="zone"><div class="z-label">Target 2</div><div class="z-val pos">$${z.target2}</div></div>
          </div>

          <h4>Exit Conditions / Thesis Invalidation</h4>
          <ul>${memo.exitConditions.map(li).join("")}</ul>

          <h4>Suggested Position Size</h4><p>${memo.positionSize}</p>
          <h4>Portfolio Fit</h4><p>${memo.portfolioFit}</p>
          <h4>Risk Management Plan</h4><ul>${memo.riskPlan.map(li).join("")}</ul>

          <h4>Final Verdict</h4>
          <p><span class="${c.verdict.cls}" style="font-weight:800;font-size:16px">${c.verdict.label}</span>
          — compatibility ${c.score}/100 for your profile.</p>
          <p class="faint" style="font-size:12px;margin-top:10px">
            ⚠️ This memo is an automated, model-generated estimate for education only. It is not financial advice,
            contains uncertainty, and does not guarantee any outcome. Do your own research.
          </p>
        </div>
      </div>

      <div>
        <div class="card panel"><h3>Fundamental Metrics <span class="dim" style="font-size:11px">/100</span></h3>
          <div class="metric-grid">${fundMetrics}</div></div>
        <div class="card panel"><h3>Technical Metrics</h3><div class="metric-grid">${techMetrics}</div></div>
        <div class="card panel"><h3>Sentiment Metrics</h3><div class="metric-grid">${sentMetrics}</div></div>
        <div class="card panel">
          <h3>Strategy Fit</h3>
          <p class="dim" style="font-size:12.5px;margin-top:-6px">How compatible this stock is with each broad approach.</p>
          ${memo.strategyFit.map(s => `
            <div class="sector-row" style="grid-template-columns:150px 1fr 40px">
              <span class="dim">${s.name}</span>
              ${CHARTS.meter(s.score)}
              <span class="mono" style="color:${CHARTS.scoreColor(s.score)}">${s.score}</span>
            </div>`).join("")}
        </div>
        <div class="card panel">
          <h3>Strategy Suitability</h3>
          <p class="dim" style="font-size:12.5px;margin-top:-6px">Hover a row for pros & cons. Scored for your horizon & risk.</p>
          ${stratHtml}
        </div>
      </div>
    </div>`;

  $("#back-btn").addEventListener("click", () => navigate("dashboard"));
  $("#d-watch").addEventListener("click", () => { toggleWatch(sym); renderDetail(sym); });
  $("#d-add").addEventListener("click", () => addHoldingModal(sym));
  bindWorkspace(sym);
  setupStrategyDock(sym);
  TIMELINE.mount(document.getElementById("d-timeline"), stock, {
    initialTf: "1Y",
    onChange: st => {
      const el = document.getElementById("d-tf-summary");
      if (el) el.innerHTML = `<div class="tf-sum-head">📊 AI analysis · <span class="accent">${st.tf}</span>${st.zoomed ? " (zoomed)" : ""}</div>` + tfSummaryHTML(st.summary);
    },
  });
  window.scrollTo(0, 0);
}

function tfSummaryHTML(s) {
  return `<div class="tf-sum-grid">
    <div><span class="tf-k">Trend</span>${s.trend}</div>
    <div><span class="tf-k">Momentum</span>${s.momentum}</div>
    <div><span class="tf-k">Volatility</span>${s.volatility}</div>
    <div><span class="tf-k">Volume</span>${s.volume}</div>
    <div><span class="tf-k">Support / Resistance</span>${s.sr}</div>
    <div><span class="tf-k">Entry / Exit</span>${s.entry}</div>
    <div><span class="tf-k">Risk</span>${s.risk}</div>
  </div>`;
}

/* ---------------- Strategy Overlay Analysis (dock + glass overlay) ---------------- */
function tier(s) {
  if (s >= 90) return { label: "Excellent Match", color: "#26d07c" };
  if (s >= 75) return { label: "Strong Match", color: "#3dd6c4" };
  if (s >= 60) return { label: "Moderate Match", color: "#ffb547" };
  return { label: "Weak Match", color: "#ff5d6c" };
}

function setupStrategyDock(sym) {
  const dock = document.getElementById("strategy-dock");
  dock.innerHTML = `<div class="dock-inner">
    <div class="dock-label">⠿ Strategy Library<span class="faint"> — drag a card onto ${sym}, or tap it</span></div>
    <div class="dock-cards">${DOCK_STRATEGIES.map(it => `<div class="dock-card" draggable="true" data-card="${escAttr(it)}">${it}</div>`).join("")}</div>
  </div>`;
  dock.querySelectorAll(".dock-card").forEach(c => {
    c.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", c.getAttribute("data-card"));
      e.dataTransfer.setData("application/x-strategy-card", "1");
      e.dataTransfer.effectAllowed = "copy"; c.classList.add("dragging");
    });
    c.addEventListener("dragend", () => c.classList.remove("dragging"));
    c.addEventListener("click", () => openOverlay(sym, c.getAttribute("data-card")));
  });
  if (!contentDropBound) {
    const isCard = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("application/x-strategy-card");
    content.addEventListener("dragover", e => { if (isCard(e)) { e.preventDefault(); content.classList.add("page-drop"); } });
    content.addEventListener("dragleave", e => { if (e.target === content) content.classList.remove("page-drop"); });
    content.addEventListener("drop", e => {
      if (!isCard(e)) return;
      content.classList.remove("page-drop");
      if (e.target.closest("#ws-drop")) return; // workspace handles its own drop
      e.preventDefault();
      const it = e.dataTransfer.getData("text/plain");
      if (currentView === "detail" && it) openOverlay(currentSym, it);
    });
    contentDropBound = true;
  }
  if (overlayStrategies.length) renderOverlay(sym);
}

function openOverlay(sym, item) {
  const root = document.getElementById("overlay-root");
  const wasOpen = !root.classList.contains("hidden") && overlaySym === sym && overlayView;
  if (overlaySym !== sym) { overlayStrategies = []; overlaySym = sym; }
  if (!overlayStrategies.includes(item)) overlayStrategies.push(item);
  root.classList.remove("hidden");
  if (wasOpen) updateOverlayBody(sym); else renderOverlay(sym);
}
function closeOverlay() {
  overlayStrategies = [];
  overlayView = null;
  const r = document.getElementById("overlay-root");
  if (r) { r.classList.add("hidden"); r.innerHTML = ""; }
}
function removeOverlayStrat(item) {
  overlayStrategies = overlayStrategies.filter(x => x !== item);
  if (!overlayStrategies.length) closeOverlay();
  else if (overlayView) updateOverlayBody(overlaySym);
  else renderOverlay(overlaySym);
}

function overlayMeter(score) {
  const t = tier(score), r = 50, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  return `<div class="ov-meter">
    <div class="ov-ring-wrap">
      <svg width="118" height="118">
        <circle cx="59" cy="59" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="9"/>
        <circle cx="59" cy="59" r="${r}" fill="none" stroke="${t.color}" stroke-width="9" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 59 59)" class="ov-ring"/>
      </svg>
      <div class="ov-meter-num" style="color:${t.color}">${score}<span>%</span></div>
    </div>
    <div class="ov-tier" style="color:${t.color}">${t.label}</div>
  </div>`;
}

let overlayView = null; // { tf, points, summary }

function overlayTicker(stock) {
  if (window.__BACKEND) fetchQuote(stock.symbol);
  const st = marketStatus();
  const { price, pct, dollar, vol } = liveFields(stock);
  const cls = pct >= 0 ? "pos" : "neg";
  const dStr = (pct >= 0 ? "+" : "−") + "$" + Math.abs(dollar).toFixed(2);
  const srcTxt = window.__BACKEND ? (window.__BACKEND.dataSource === "yahoo" ? "Yahoo Finance (live)" : window.__BACKEND.dataSource === "finnhub" ? "Finnhub (live)" : "Python backend") : "Simulated data";
  return `<div class="ov-ticker">
    <span class="mono" style="font-size:17px;font-weight:800">$${(+price).toFixed(2)}</span>
    <span class="${cls}" style="font-weight:700">${dStr} (${pct >= 0 ? "+" : ""}${(+pct).toFixed(2)}%)</span>
    <span class="tk ${st.open ? "tk-live" : "tk-closed"}"><span class="tk-dot"></span>${st.label}</span>
    <span class="faint">Vol ${fmtVol(vol)} · ${fmtCap(stock.capB)} · ${srcTxt}</span>
  </div>`;
}

function overlayColumn(sym, stock, item, res, tf) {
  const t = tier(res.score), z = MEMO.zones(stock);
  const rr = (z.target1 - z.entryHi) / (z.entryHi - z.stop);
  const techRows = [["Trend", stock.tech.trend], ["Volume", stock.tech.volumeTrend], ["Volatility", stock.tech.volatility],
    ["Relative Strength", stock.tech.relStrength], ["Momentum", stock.tech.momentum],
    ["Market Structure", Math.round((stock.tech.trend + stock.tech.breakout) / 2)]];
  return `<div class="ov-col">
    <div class="ov-col-head"><span class="ov-col-name">${item}</span>
      <button class="wsl-rm" data-ovrm="${escAttr(item)}" title="Remove">✕</button></div>
    <div class="ov-mtf faint">Match on <b class="accent">${tf || "1Y"}</b></div>
    ${overlayMeter(res.score)}
    <div class="ov-section"><h5>Strategy Overview</h5><p>${STRAT.overview(item)}</p></div>
    <div class="ov-section"><h5>Example Graph</h5><div class="ov-chart">${LEARN.chartForMethod(item)}</div></div>
    <div class="ov-section"><h5>Why It Matches</h5><ul>${res.why.map(w => `<li>${w}</li>`).join("")}</ul></div>
    <div class="ov-section"><h5>Technical Alignment</h5>
      ${techRows.map(([n, v]) => `<div class="ov-bar"><span>${n}</span>${CHARTS.meter(v)}<span class="mono">${v}</span></div>`).join("")}</div>
    <div class="ov-section"><h5>Trade Setup</h5>
      <div class="ov-setup">
        <div><span class="faint">Entry zone</span><b>$${z.entryLo}–$${z.entryHi}</b></div>
        <div><span class="faint">Stop concept</span><b class="neg">$${z.stop}</b></div>
        <div><span class="faint">Target concept</span><b class="pos">$${z.target1}</b></div>
        <div><span class="faint">Risk / reward</span><b>${rr > 0 ? "≈ 1 : " + rr.toFixed(1) : "—"}</b></div>
      </div></div>
    <div class="ov-section"><h5 class="neg">⚠ Why It May Fail</h5><ul>${res.against.concat(res.risks.slice(0, 1)).map(w => `<li>${w}</li>`).join("")}</ul></div>
    <div class="ov-conf"><span class="faint">Confidence</span> <b style="color:${t.color}">${res.confidence}%</b> · <span class="faint">illustrative edge ${res.successRate}%</span></div>
    <div class="ov-cond faint">${res.conditions}</div>
  </div>`;
}

function renderOverlay(sym) {
  const stock = STOCK_UNIVERSE.find(s => s.symbol === sym);
  const root = document.getElementById("overlay-root");
  overlayView = null;
  root.innerHTML = `<div class="ov-backdrop" id="ov-backdrop"></div>
    <div class="ov-panel glass">
      <div class="ov-head">
        <div><div class="ov-kicker">⬡ Strategy Overlay Analysis</div>
          <h2 class="ov-title">${sym} · <span class="dim">${stock.name}</span></h2>
          ${overlayTicker(stock)}</div>
        <button class="ghost-btn" id="ov-close">✕ Close</button>
      </div>
      <div class="ov-timeline" id="ov-timeline"></div>
      <div class="tf-summary" id="ov-summary"></div>
      <div class="ov-cols" id="ov-cols"></div>
      <div class="ov-foot faint">⠿ Drag more cards from the dock to compare · change the timeframe to test the strategy short vs long term · Educational only.</div>
    </div>`;
  document.getElementById("ov-close").addEventListener("click", closeOverlay);
  document.getElementById("ov-backdrop").addEventListener("click", closeOverlay);

  TIMELINE.mount(document.getElementById("ov-timeline"), stock, {
    initialTf: "1Y",
    onChange: stv => { overlayView = stv; updateOverlayBody(sym); },
  });
}

function updateOverlayBody(sym) {
  const stock = STOCK_UNIVERSE.find(s => s.symbol === sym);
  if (!stock || !overlayView) return;
  const tfStock = TIMELINE.stockAt(stock, overlayView.points);
  const tf = overlayView.tf;
  const scored = overlayStrategies.map(item => ({ item, res: STRAT.score(item, tfStock) }))
    .sort((a, b) => b.res.score - a.res.score);

  const sumEl = document.getElementById("ov-summary");
  if (sumEl) sumEl.innerHTML = `<div class="tf-sum-head">📊 ${sym} on <span class="accent">${tf}</span>${overlayView.zoomed ? " (zoomed)" : ""}</div>` + tfSummaryHTML(overlayView.summary);

  const colsEl = document.getElementById("ov-cols");
  if (colsEl) {
    const compare = scored.length > 1
      ? `<div class="ov-compare">Best fit on ${tf}: <strong style="color:${tier(scored[0].res.score).color}">${scored[0].item} (${scored[0].res.score}%)</strong></div>` : "";
    colsEl.innerHTML = compare + `<div class="ov-cols-row">${scored.map(({ item, res }) => overlayColumn(sym, stock, item, res, tf)).join("")}</div>`;
    colsEl.querySelectorAll("[data-ovrm]").forEach(b => b.addEventListener("click", () => removeOverlayStrat(b.getAttribute("data-ovrm"))));
  }
}

/* ---------------- Strategy Workspace (drag & drop onto a stock) ---------------- */
function renderWorkspacePanel(sym) {
  const stock = STOCK_UNIVERSE.find(s => s.symbol === sym);
  const layers = STATE.workspace[sym] || [];
  const stack = STRAT.scoreStack(layers.map(i => ({ item: i, weight: 1 })), stock);
  const palette = STRAT.PALETTE.map(it =>
    `<button class="strat-chip" draggable="true" data-chip="${escAttr(it)}">⠿ ${it}</button>`).join("");

  const layersHtml = layers.length ? stack.parts.map(p => {
    const r = p.res, v = STRAT.verdict(p.score);
    return `<div class="ws-layer">
      <div class="wsl-top">
        <span class="wsl-name">${p.item}</span>
        <span class="wsl-score" style="color:${CHARTS.scoreColor(p.score)}">${p.score}<span class="faint" style="font-size:10px">/100</span></span>
        <button class="wsl-rm" data-rm="${escAttr(p.item)}" title="Remove layer">✕</button>
      </div>
      ${CHARTS.meter(p.score)}
      <div class="wsl-why"><strong class="pos">✓ Matches:</strong> ${r.why[0]}</div>
      <div class="wsl-why"><strong class="neg">✕ Watch:</strong> ${r.against[0]}</div>
      <div class="wsl-meta faint">Confidence ${r.confidence}% · illustrative edge ${r.successRate}% · ${r.conditions}</div>
    </div>`;
  }).join("") : `<div class="ws-empty">⠿ Drag a strategy here — or click one above — to add an AI analysis layer onto ${sym}.</div>`;

  const overall = layers.length ? `
    <div class="ws-overall glass">
      <div style="min-width:130px">
        <div class="faint" style="font-size:11px;text-transform:uppercase;letter-spacing:1px">Combined fit</div>
        <div style="font-size:32px;font-weight:800;font-family:var(--mono);color:${CHARTS.scoreColor(stack.overall)}">${stack.overall}<span style="font-size:15px;color:var(--text-faint)">/100</span></div>
        <div class="${STRAT.verdict(stack.overall).cls}" style="font-weight:800;font-size:13px">${STRAT.verdict(stack.overall).label}</div>
      </div>
      <div class="dim" style="font-size:12.5px;flex:1">${wsExplain(stock, stack)}</div>
    </div>` : "";

  return `<div class="card panel">
    <h3>🧪 Strategy Workspace <span class="dim" style="font-size:12px;font-weight:400">· drag strategies onto ${sym}</span></h3>
    <div class="strat-palette">${palette}</div>
    <div class="ws-dropzone glass" id="ws-drop">${layersHtml}</div>
    ${overall}
  </div>`;
}

function wsExplain(stock, stack) {
  if (!stack.parts.length) return "";
  const parts = [...stack.parts];
  const best = parts.slice().sort((a, b) => b.score - a.score)[0];
  const worst = parts.slice().sort((a, b) => a.score - b.score)[0];
  let s = `${stock.name} aligns most with <strong>${best.item}</strong> (${best.score}/100)`;
  if (best.res.why[0]) s += ` — ${best.res.why[0].toLowerCase().replace(/\.$/, "")}.`;
  else s += ".";
  if (worst.item !== best.item) s += ` It fits <strong>${worst.item}</strong> least (${worst.score}/100).`;
  s += ` Combined fit across ${parts.length} layer(s): <strong>${stack.overall}/100</strong>.`;
  return s;
}

function bindWorkspace(sym) {
  const drop = document.getElementById("ws-drop");
  if (!drop) return;
  document.querySelectorAll(".strat-chip").forEach(ch => {
    ch.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", ch.getAttribute("data-chip"));
      e.dataTransfer.effectAllowed = "copy";
      ch.classList.add("dragging");
    });
    ch.addEventListener("dragend", () => ch.classList.remove("dragging"));
    ch.addEventListener("click", () => { addLayerForSym(sym, ch.getAttribute("data-chip")); refreshWorkspace(sym); });
  });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", e => {
    e.preventDefault(); drop.classList.remove("drag-over");
    const it = e.dataTransfer.getData("text/plain");
    if (it) { addLayerForSym(sym, it); refreshWorkspace(sym); }
  });
  drop.querySelectorAll("[data-rm]").forEach(b =>
    b.addEventListener("click", () => {
      STATE.workspace[sym] = (STATE.workspace[sym] || []).filter(x => x !== b.getAttribute("data-rm"));
      saveState(); refreshWorkspace(sym);
    }));
}

function refreshWorkspace(sym) {
  const el = document.getElementById("ws-panel");
  if (el) { el.innerHTML = renderWorkspacePanel(sym); bindWorkspace(sym); }
}

function metricBox(label, v) {
  return `<div class="metric"><div class="m-label">${label}</div>
    <div class="m-val" style="color:${CHARTS.scoreColor(label.includes('Debt')||label.includes('Volatility')?100-v:v)}">${v}</div>
    <div class="m-bar">${CHARTS.meter(v)}</div></div>`;
}
function li(x) { return `<li>${x}</li>`; }
function metricBoxStr(l, v) { return metricBox(l, v); }

/* ---------------- Watchlist ---------------- */
function toggleWatch(sym) {
  const i = STATE.watchlist.indexOf(sym);
  if (i >= 0) { STATE.watchlist.splice(i, 1); APP_toast(`${sym} removed from watchlist`); }
  else { STATE.watchlist.push(sym); APP_toast(`${sym} added to watchlist`); }
  saveState();
}

function renderWatchlist() {
  const p = STATE.profile;
  if (!STATE.watchlist.length) {
    content.innerHTML = pageHead("Watchlist", "Stocks you're tracking.") +
      `<div class="card"><div class="empty-state"><div class="es-icon">☆</div>
       Your watchlist is empty.<br>Tap the star on any recommendation to track it here.</div></div>`;
    return;
  }
  const rows = STATE.watchlist
    .map(sym => STOCK_UNIVERSE.find(s => s.symbol === sym)).filter(Boolean)
    .map(stock => ({ stock, comp: ENGINE.compatibility(p, stock) }))
    .sort((a,b)=>b.comp.score - a.comp.score);

  content.innerHTML = pageHead("Watchlist", `${rows.length} stock(s) tracked, scored for your profile.`) +
    `<div class="card panel"><table class="list-table">
      <thead><tr><th>Symbol</th><th>Name</th><th>Match</th><th>Verdict</th><th class="num">Price</th><th class="num">Today</th><th></th></tr></thead>
      <tbody>${rows.map(({stock,comp}) => `
        <tr data-sym="${stock.symbol}">
          <td style="font-weight:800">${stock.symbol}</td>
          <td class="dim">${stock.name}</td>
          <td><span style="color:${CHARTS.scoreColor(comp.score)};font-weight:800">${comp.score}</span></td>
          <td><span class="${comp.verdict.cls}" style="font-weight:700;font-size:12px">${comp.verdict.label}</span></td>
          <td class="num mono">$${stock.price}</td>
          <td class="num ${stock.chgPct>=0?'pos':'neg'}">${stock.chgPct>=0?'+':''}${stock.chgPct}%</td>
          <td><button class="ghost-btn btn-sm rm" data-sym="${stock.symbol}">✕</button></td>
        </tr>`).join("")}
      </tbody></table></div>`;

  content.querySelectorAll("tr[data-sym]").forEach(tr =>
    tr.addEventListener("click", e => { if (e.target.closest(".rm")) return; navigate("detail", tr.dataset.sym); }));
  content.querySelectorAll(".rm").forEach(b =>
    b.addEventListener("click", e => { e.stopPropagation(); toggleWatch(b.dataset.sym); renderWatchlist(); }));
}

/* ---------------- Portfolio ---------------- */
function renderPortfolio() {
  const p = STATE.profile;
  const pf = STATE.portfolio;
  if (!pf.length) {
    content.innerHTML = pageHead("Portfolio Builder", "Build and stress-test a portfolio.") +
      `<div class="card"><div class="empty-state"><div class="es-icon">📊</div>
       No holdings yet.<br>Open a stock and tap "Add to portfolio", or
       <a href="#" id="pf-quick">add one now</a>.</div></div>`;
    $("#pf-quick") && $("#pf-quick").addEventListener("click", e => { e.preventDefault(); addHoldingModal(); });
    return;
  }

  const enriched = pf.map(h => {
    const stock = STOCK_UNIVERSE.find(s => s.symbol === h.symbol);
    const value = stock ? stock.price * h.shares : 0;
    const comp = stock ? ENGINE.compatibility(p, stock) : null;
    return { ...h, stock, value, comp };
  }).filter(x => x.stock);

  const total = enriched.reduce((a, h) => a + h.value, 0) || 1;

  // sector exposure
  const sectors = {};
  enriched.forEach(h => sectors[h.stock.sector] = (sectors[h.stock.sector] || 0) + h.value);
  const sectorRows = Object.entries(sectors).sort((a,b)=>b[1]-a[1]).map(([sec, v]) => {
    const pc = Math.round(v / total * 100);
    return `<div class="sector-row"><span class="dim">${sec}</span>${CHARTS.meter(pc, CHARTS.scoreColor(100-pc))}<span class="mono">${pc}%</span></div>`;
  }).join("");

  // scores
  const nSectors = Object.keys(sectors).length;
  const concentration = Math.max(...Object.values(sectors)) / total;          // 0..1
  const diversification = ENGINE._clamp(Math.round(nSectors * 14 + (1 - concentration) * 50));
  const wVol = enriched.reduce((a, h) => a + h.stock.tech.volatility * h.value, 0) / total;
  const riskScore = ENGINE._clamp(Math.round(wVol));
  const wFit = enriched.reduce((a, h) => a + (h.comp ? h.comp.score : 50) * h.value, 0) / total;
  const wGrowth = enriched.reduce((a, h) => a + ((h.stock.fund.revGrowth+h.stock.fund.epsGrowth)/2) * h.value, 0) / total;
  const expReturn = (3 + wGrowth * 0.12 - (riskScore-50)*0.02).toFixed(1);     // illustrative annualized %
  const health = ENGINE._clamp(Math.round(diversification * 0.35 + wFit * 0.45 + (100 - Math.abs(riskScore - ENGINE.riskProfile(p).score)) * 0.20));

  const stats = `
    <div class="port-stats">
      ${statCard(`$${Math.round(total).toLocaleString()}`, "Total Value")}
      ${statCard(diversification, "Diversification", CHARTS.scoreColor(diversification))}
      ${statCard(riskScore, "Risk Score", CHARTS.scoreColor(100-riskScore))}
      ${statCard(`~${expReturn}%`, "Est. Annual Return*", CHARTS.scoreColor(60))}
      ${statCard(health, "Health Score", CHARTS.scoreColor(health))}
    </div>`;

  content.innerHTML = pageHead("Portfolio Builder",
    `${enriched.length} holding(s). Diversification, risk, and health are model estimates.`) +
    stats +
    `<div class="detail-grid">
      <div class="card panel">
        <h3>Holdings</h3>
        <table class="list-table">
          <thead><tr><th>Symbol</th><th class="num">Shares</th><th class="num">Price</th><th class="num">Value</th><th class="num">Weight</th><th>Match</th><th></th></tr></thead>
          <tbody>${enriched.map(h => `
            <tr data-sym="${h.symbol}">
              <td style="font-weight:800">${h.symbol}<div class="dim" style="font-size:11px;font-weight:400">${h.stock.name}</div></td>
              <td class="num mono">${h.shares}</td>
              <td class="num mono">$${h.stock.price}</td>
              <td class="num mono">$${Math.round(h.value).toLocaleString()}</td>
              <td class="num mono">${Math.round(h.value/total*100)}%</td>
              <td><span style="color:${CHARTS.scoreColor(h.comp.score)};font-weight:800">${h.comp.score}</span></td>
              <td><button class="ghost-btn btn-sm rm" data-sym="${h.symbol}">✕</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
        <button class="btn btn-sm" id="pf-add" style="margin-top:14px">+ Add holding</button>
      </div>
      <div class="card panel">
        <h3>Sector Exposure</h3>
        <div class="sector-bars">${sectorRows}</div>

        <h3 style="margin-top:22px">Risk Analyzer</h3>
        <div class="sector-row" style="grid-template-columns:130px 1fr 46px">
          <span class="dim">Your appetite</span>${CHARTS.meter(ENGINE.riskProfile(p).score, '#5b8cff')}<span class="mono">${ENGINE.riskProfile(p).score}</span>
        </div>
        <div class="sector-row" style="grid-template-columns:130px 1fr 46px">
          <span class="dim">Portfolio risk</span>${CHARTS.meter(riskScore, CHARTS.scoreColor(100-riskScore))}<span class="mono">${riskScore}</span>
        </div>
        <p class="dim" style="font-size:12.5px;margin-top:8px">
          ${riskScore > ENGINE.riskProfile(p).score + 12 ? "Portfolio is riskier than your stated comfort."
            : riskScore < ENGINE.riskProfile(p).score - 15 ? "Portfolio is more conservative than your stated comfort."
            : "Portfolio risk is well aligned to your appetite."}
        </p>

        <h3 style="margin-top:22px">Portfolio Health</h3>
        <p class="dim" style="font-size:13px">
          ${healthNote(health, diversification, riskScore, p)}
        </p>

        <h3 style="margin-top:22px">Rebalancing Suggestions</h3>
        <ul style="margin:4px 0;padding-left:18px">
          ${rebalanceSuggestions(enriched, total, p, sectors, diversification, riskScore).map(s => `<li style="margin-bottom:7px;font-size:13px;color:var(--text-dim)">${s}</li>`).join("")}
        </ul>

        <p class="faint" style="font-size:11px;margin-top:14px">
          *Estimates are illustrative model outputs, not forecasts. No returns are guaranteed.
        </p>
      </div>
    </div>`;

  content.querySelectorAll("tr[data-sym]").forEach(tr =>
    tr.addEventListener("click", e => { if (e.target.closest(".rm")) return; navigate("detail", tr.dataset.sym); }));
  content.querySelectorAll(".rm").forEach(b =>
    b.addEventListener("click", e => { e.stopPropagation(); removeHolding(b.dataset.sym); renderPortfolio(); }));
  $("#pf-add").addEventListener("click", () => addHoldingModal());
}

function rebalanceSuggestions(enriched, total, p, sectors, diversification, riskScore) {
  const out = [];
  const target = ENGINE.riskProfile(p).score;
  const f = ENGINE.pref(p);
  // overweight single positions
  enriched.forEach(h => {
    const wt = h.value / total * 100;
    if (wt > 30) out.push(`⚖️ <strong>${h.symbol}</strong> is ${Math.round(wt)}% of the portfolio — consider trimming toward 15–20% to reduce single-stock risk.`);
  });
  // sector concentration
  const topSector = Object.entries(sectors).sort((a,b)=>b[1]-a[1])[0];
  if (topSector && topSector[1] / total > 0.45)
    out.push(`🧩 ${Math.round(topSector[1]/total*100)}% sits in ${topSector[0]} — add names from other sectors to cut correlation.`);
  // risk vs appetite
  if (riskScore > target + 18) out.push(`🌡️ Portfolio risk (${riskScore}) runs hotter than your ${target} appetite — rotate some high-volatility names into steadier holdings.`);
  else if (riskScore < target - 22) out.push(`🌡️ Portfolio is calmer (${riskScore}) than your ${target} appetite — you have room to add growth if desired.`);
  // diversification / count
  if (enriched.length < 4) out.push(`➕ Only ${enriched.length} holding(s). Adding 2–4 uncorrelated positions would improve diversification (currently ${diversification}/100).`);
  // weak matches
  const weak = enriched.filter(h => h.comp.score < 50);
  if (weak.length) out.push(`🔄 ${weak.map(h=>h.symbol).join(", ")} score below 50 for your profile — review whether they still belong.`);
  // income gap
  const wantsIncome = f.dividendPref >= 4 || (p.markets||[]).includes("Dividend Stocks");
  const yieldy = enriched.some(h => h.stock.fund.divYield > 45);
  if (wantsIncome && !yieldy) out.push(`💵 You favor income but hold no high-yield names — the Scanner's "High yield" screen can help.`);
  if (!out.length) out.push(`✅ This portfolio looks well-balanced for your profile. No rebalancing flagged right now.`);
  return out;
}

function healthNote(health, div, risk, p) {
  const target = ENGINE.riskProfile(p).score;
  const parts = [];
  parts.push(health >= 70 ? "Overall this portfolio looks healthy and well-aligned to you."
    : health >= 50 ? "This portfolio is reasonable but has room to improve."
    : "This portfolio has notable weaknesses to address.");
  if (div < 50) parts.push("Diversification is low — consider spreading across more sectors.");
  if (risk > target + 18) parts.push("It's riskier than your stated appetite — consider trimming volatile names.");
  else if (risk < target - 20) parts.push("It may be more conservative than you'd like for your goals.");
  return parts.join(" ");
}

function statCard(val, label, color) {
  return `<div class="card stat-card"><div class="s-val" ${color?`style="color:${color}"`:''}>${val}</div>
    <div class="s-label">${label}</div></div>`;
}

function removeHolding(sym) {
  STATE.portfolio = STATE.portfolio.filter(h => h.symbol !== sym);
  saveState(); APP_toast(`${sym} removed`);
}

function addHoldingModal(presetSym) {
  const opts = STOCK_UNIVERSE.map(s => `<option value="${s.symbol}" ${s.symbol===presetSym?'selected':''}>${s.symbol} — ${s.name}</option>`).join("");
  openModal(`
    <h3>Add holding</h3>
    <div class="q-block"><span class="q-label">Stock</span>
      <select id="m-sym" style="width:100%;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:10px">${opts}</select></div>
    <div class="q-block"><span class="q-label">Shares</span>
      <input id="m-shares" type="number" min="1" value="10" style="width:100%;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:10px"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="m-cancel">Cancel</button>
      <button class="btn" id="m-save">Add</button>
    </div>`);
  $("#m-cancel").addEventListener("click", closeModal);
  $("#m-save").addEventListener("click", () => {
    const sym = $("#m-sym").value;
    const shares = Math.max(1, parseInt($("#m-shares").value) || 1);
    const existing = STATE.portfolio.find(h => h.symbol === sym);
    if (existing) existing.shares += shares; else STATE.portfolio.push({ symbol: sym, shares });
    saveState(); closeModal(); APP_toast(`Added ${shares} ${sym}`);
    if (currentView === "portfolio") renderPortfolio();
  });
}

/* ---------------- Profile view ---------------- */
function renderProfile() {
  const p = STATE.profile;
  const r = ENGINE.riskProfile(p);
  const h = ENGINE.timeHorizon(p);
  const arch = ENGINE.classifyInvestor(p);
  const f = ENGINE.pref(p);
  const row = (k, v) => `<tr><td class="dim">${k}</td><td style="font-weight:600">${v || "—"}</td></tr>`;
  content.innerHTML = pageHead("🧬 Your Investor DNA", "How the AI sees you. Reassess any time.") +
    `<div class="detail-grid">
      <div class="card panel">
        <h3>Assessment answers</h3>
        <table class="list-table">
          ${row("Age range", p.ageRange)}
          ${row("Experience", p.experience)}
          ${row("Available capital", p.capital)}
          ${row("Annual income", p.income)}
          ${row("Goals", (p.goals||[]).join(", "))}
          ${row("Preferred markets", (p.markets||[]).join(", "))}
          ${row("Market-cap preference", f.marketCap)}
          ${row("Geographic preference", f.geo)}
          ${row("Industry interests", (p.industries||[]).join(", "))}
          ${row("Risk tolerance", p.riskTolerance + "/5")}
          ${row("Max drawdown comfort", p.maxDrawdown + "/5")}
          ${row("Volatility reaction", p.volatilityReaction + "/5")}
          ${row("Concentration", p.concentration + "/5")}
          ${row("Preservation→Growth", p.preservationVsGrowth + "/5")}
          ${row("Value→Growth tilt", f.growthValue + "/5")}
          ${row("Dividend preference", f.dividendPref + "/5")}
          ${row("ESG importance", f.esgPref + "/5")}
          ${row("Trading frequency", f.tradingFrequency)}
          ${row("Analysis style", f.analysisStyle)}
          ${row("Methods of interest", (p.methods||[]).map(window.methodItemLabel).join(", "))}
          ${row("Time horizon", p.horizon)}
        </table>
        <button class="btn" id="pf-retake" style="margin-top:16px">↻ Retake assessment</button>
      </div>
      <div class="card panel" style="text-align:center">
        <h3>AI classification</h3>
        ${CHARTS.riskGauge(r.score, r.band)}
        <div style="margin:16px 0"><span class="badge badge-${r.key}">${r.band}</span>
          <span class="badge" style="background:var(--panel-2);color:var(--text-dim)">${h.label}</span></div>
        <div class="section-title" style="margin-top:14px">Archetypes</div>
        <div class="ps-archetypes" style="justify-content:center">
          ${arch.map(a=>`<span class="chip">${a.name} <span class="conf">${a.confidence}%</span></span>`).join("")}
        </div>
      </div>
    </div>`;
  $("#pf-retake").addEventListener("click", () => renderSurvey());
}

/* ---------------- Helpers ---------------- */
function pageHead(title, sub) {
  return `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div></div>`;
}

/* ---------------- Modal ---------------- */
function openModal(html) {
  $("#modal-panel").innerHTML = html;
  $("#modal-root").classList.remove("hidden");
}
function closeModal() { $("#modal-root").classList.add("hidden"); }
$("#modal-backdrop").addEventListener("click", closeModal);

/* ---------------- Chat wiring ---------------- */
const chatDrawer = $("#chat-drawer");
function openChat() {
  chatDrawer.classList.remove("hidden");
  if (!$("#chat-messages").children.length) {
    pushChat("bot", "👋 I'm your AI analyst. I know your profile, watchlist, and portfolio. Ask me anything about your matches.");
    renderSuggestions();
  }
  $("#chat-input").focus();
}
function closeChat() { chatDrawer.classList.add("hidden"); }
function pushChat(role, text) {
  const m = document.createElement("div");
  m.className = "msg " + role;
  m.innerHTML = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  $("#chat-messages").appendChild(m);
  $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
}
function renderSuggestions() {
  $("#chat-suggestions").innerHTML = CHAT.SUGGESTIONS.map(s => `<button class="sugg">${s}</button>`).join("");
  $("#chat-suggestions").querySelectorAll(".sugg").forEach(b =>
    b.addEventListener("click", () => { sendChat(b.textContent); }));
}
function sendChat(text) {
  if (!text.trim()) return;
  pushChat("user", text);
  setTimeout(() => pushChat("bot", CHAT.respond(text)), 180);
}

$("#chat-toggle").addEventListener("click", openChat);
$("#chat-close").addEventListener("click", closeChat);
$("#chat-form").addEventListener("submit", e => {
  e.preventDefault();
  const inp = $("#chat-input");
  sendChat(inp.value);
  inp.value = "";
});

/* ---------------- Top nav wiring ---------------- */
document.querySelectorAll(".nav-btn").forEach(b =>
  b.addEventListener("click", () => navigate(b.dataset.view)));
$("#retake-btn").addEventListener("click", () => renderSurvey());
$("#disclaimer-more").addEventListener("click", e => {
  e.preventDefault();
  openModal(`<h3>⚠️ Important disclaimer</h3>
    <p class="dim" style="font-size:13.5px;line-height:1.6">
    InvestorMatch AI is an <strong>educational demonstration</strong>. It does <strong>not</strong> provide
    financial, investment, tax, or legal advice. All data shown is <strong>illustrative seed data</strong>,
    not live market data. Compatibility scores, memos, and strategy ratings are automated model estimates
    that contain uncertainty and may be wrong.</p>
    <p class="dim" style="font-size:13.5px;line-height:1.6;margin-top:8px">
    Nothing here is a recommendation to buy or sell any security. <strong>No outcome or return is guaranteed.</strong>
    Investing involves risk of loss. Always do your own research and consult a licensed professional.</p>
    <div class="modal-actions"><button class="btn" id="dm-ok">I understand</button></div>`);
  $("#dm-ok").addEventListener("click", closeModal);
});

/* ---------------- Backend probe (works when served via server.py) ---------------- */
fetch("api/health")
  .then(r => r.ok ? r.json() : null)
  .then(d => { if (d) { window.__BACKEND = d; if (currentView === "detail") renderDetail(currentSym); } })
  .catch(() => {/* no backend (file://) — stay in simulated mode */});

/* ---------------- Boot ---------------- */
navigate(STATE.profile ? "dashboard" : "survey");
