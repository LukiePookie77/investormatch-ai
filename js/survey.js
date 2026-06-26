/* ============================================================
   survey.js — Multi-step investor onboarding assessment.
   Renders steps, validates, and emits a profile object.
   ============================================================ */

const SURVEY = (() => {

  const STEPS = [
    {
      title: "Personal Investment Profile",
      sub: "Tell us who you are as an investor. This shapes every recommendation.",
      questions: [
        { id: "ageRange", type: "single", label: "Age range", cols: 4,
          options: ["18–29", "30–44", "45–59", "60+"] },
        { id: "experience", type: "single", label: "Investment experience", cols: 4,
          options: [
            { v: "Beginner", d: "New to markets" },
            { v: "Intermediate", d: "Some experience" },
            { v: "Advanced", d: "Confident & active" },
            { v: "Professional", d: "Industry / full-time" },
          ] },
        { id: "capital", type: "single", label: "Available capital to invest", cols: 4,
          options: ["< $5k", "$5k–$50k", "$50k–$250k", "$250k+"] },
        { id: "income", type: "single", label: "Annual income range", cols: 4,
          options: ["< $50k", "$50k–$100k", "$100k–$250k", "$250k+"] },
        { id: "goals", type: "multi", label: "Financial goals", help: "(pick all that apply)", cols: 2,
          options: [
            { v: "Long-term Wealth", d: "Compound over years" },
            { v: "Income", d: "Regular cash flow" },
            { v: "Capital Preservation", d: "Protect what I have" },
            { v: "Aggressive Growth", d: "Maximize upside" },
            { v: "Systematic / Quant", d: "Rules-based investing" },
            { v: "Speculation", d: "High-risk, high-reward" },
          ] },
        { id: "markets", type: "multi", label: "Preferred markets", help: "(pick all that apply)", cols: 4,
          options: ["US Stocks", "International Stocks", "ETFs", "Growth Stocks",
                    "Dividend Stocks", "Value Stocks", "Small Caps", "Large Caps"] },
        { id: "marketCapPref", type: "single", label: "Market-cap preference", cols: 4,
          options: ["No preference", "Large Cap", "Mid Cap", "Small Cap"] },
        { id: "geo", type: "single", label: "Geographic preference", cols: 4,
          options: [
            { v: "No preference", d: "Anywhere" },
            { v: "US", d: "US-focused" },
            { v: "Global", d: "Multinationals" },
            { v: "International", d: "Ex-US tilt" },
          ] },
        { id: "industries", type: "multi", optional: true, label: "Industry interests", help: "(optional — pick any)", cols: 3,
          options: ["Technology", "Healthcare", "Financials", "Consumer Disc.",
                    "Consumer Staples", "Communication", "Energy", "Industrials", "Real Estate"] },
      ],
    },
    {
      title: "Risk Assessment",
      sub: "Be honest — these answers calibrate how much volatility we put in front of you.",
      questions: [
        { id: "riskTolerance", type: "scale", label: "Overall risk tolerance",
          lo: "Very low", hi: "Very high" },
        { id: "maxDrawdown", type: "scale", label: "Maximum drawdown you could stomach",
          lo: "−5% hurts", hi: "−50%+ is fine" },
        { id: "volatilityReaction", type: "scale", label: "If your portfolio dropped 20% in a week, you would…",
          lo: "Sell it all", hi: "Buy more" },
        { id: "concentration", type: "scale", label: "Portfolio concentration preference",
          lo: "Very diversified", hi: "A few big bets" },
        { id: "preservationVsGrowth", type: "scale", label: "Capital preservation vs. growth",
          lo: "Preserve", hi: "Grow" },
        { id: "growthValue", type: "scale", label: "Value vs. growth style tilt",
          lo: "Deep value", hi: "Pure growth" },
        { id: "dividendPref", type: "scale", label: "Dividend / income preference",
          lo: "Don't need it", hi: "Must-have" },
        { id: "esgPref", type: "scale", label: "How important is ESG to you?",
          lo: "Not important", hi: "Very important" },
      ],
    },
    {
      title: "Time Horizon & Trading Style",
      sub: "How you trade shapes which opportunities we surface.",
      questions: [
        { id: "horizon", type: "single", label: "Your primary style", cols: 1,
          options: [
            { v: "Scalper", d: "Seconds to minutes · many trades per day" },
            { v: "Day Trader", d: "Intraday · no overnight positions" },
            { v: "Swing Trader", d: "Days to weeks · ride momentum" },
            { v: "Position Trader", d: "Weeks to months · trend + fundamentals" },
            { v: "Long-Term Investor", d: "Years · buy and hold quality" },
          ] },
        { id: "tradingFrequency", type: "single", label: "How often do you expect to trade?", cols: 4,
          options: ["Rarely", "Occasionally", "Weekly", "Daily"] },
        { id: "analysisStyle", type: "single", label: "Preferred analysis style", cols: 4,
          options: [
            { v: "Fundamental", d: "Business & financials" },
            { v: "Technical", d: "Charts & price action" },
            { v: "Quantitative", d: "Rules & factors" },
            { v: "Balanced", d: "A mix of all" },
          ] },
        { id: "methods", type: "methodtree", optional: true,
          label: "Which methods are you trying to use?",
          help: "(optional — expand a category and pick any strategies that interest you)" },
      ],
    },
  ];

  let answers = {};
  let step = 0;
  let onDone = null;
  let expanded = new Set();
  let methodQuery = "";

  function start(container, onComplete, existing) {
    answers = existing ? { ...existing } : {};
    step = 0;
    // Categories start OPEN so users can scroll/browse all strategies first.
    expanded = new Set((window.METHOD_TAXONOMY || []).map(g => g.key));
    methodQuery = "";
    onDone = onComplete;
    render(container);
  }

  // Rebuild ONLY the tree's groups (keeps the search box focused) + selected count.
  function rebuildTree(container) {
    const box = container.querySelector("#mtree-groups");
    if (!box) return;
    box.innerHTML = renderMethodGroups(answers.methods || []);
    const sc = container.querySelector("#mtree-selcount");
    if (sc) sc.textContent = (answers.methods || []).length ? (answers.methods || []).length + " selected" : "";
    bindTreeHandlers(container);
  }

  function bindTreeHandlers(container) {
    // toggle a strategy
    container.querySelectorAll("[data-mitem]").forEach(el =>
      el.addEventListener("click", () => {
        const v = el.getAttribute("data-mitem");
        answers.methods = answers.methods || [];
        const i = answers.methods.indexOf(v);
        if (i >= 0) answers.methods.splice(i, 1); else answers.methods.push(v);
        rebuildTree(container);
      }));
    // expand / collapse a category
    container.querySelectorAll("[data-cat-toggle]").forEach(el =>
      el.addEventListener("click", () => {
        const k = el.getAttribute("data-cat-toggle");
        if (expanded.has(k)) expanded.delete(k); else expanded.add(k);
        rebuildTree(container);
      }));
    // select / deselect all in a category
    container.querySelectorAll("[data-cat-all]").forEach(el =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const k = el.getAttribute("data-cat-all");
        const g = window.METHOD_TAXONOMY.find(x => x.key === k);
        answers.methods = answers.methods || [];
        const allVals = g.items.map(it => window.methodValue(k, it));
        const allSel = allVals.every(v => answers.methods.includes(v));
        if (allSel) answers.methods = answers.methods.filter(v => !allVals.includes(v));
        else allVals.forEach(v => { if (!answers.methods.includes(v)) answers.methods.push(v); });
        rebuildTree(container);
      }));
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(container) {
    const totalSteps = STEPS.length;
    const s = STEPS[step];
    const pct = Math.round((step / totalSteps) * 100);

    const intro = step === 0 ? `
      <div class="hero">
        <h1>Meet your AI hedge-fund analyst</h1>
        <p>Answer a few questions and InvestorMatch AI will discover and rank stocks that fit your goals, risk, and style — no screenshots, no manual searching.</p>
      </div>` : "";

    container.innerHTML = `
      <div class="survey-wrap">
        ${intro}
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">Step ${step + 1} of ${totalSteps}</div>
        <div class="card survey-card">
          <div class="survey-step">
            <h2>${s.title}</h2>
            <p class="step-sub">${s.sub}</p>
            ${s.questions.map(renderQuestion).join("")}
          </div>
          <div class="survey-nav">
            <button class="btn btn-ghost" id="sv-back" ${step === 0 ? "disabled" : ""}>← Back</button>
            <button class="btn" id="sv-next">${step === totalSteps - 1 ? "See my matches →" : "Continue →"}</button>
          </div>
        </div>
        <p class="faint" style="text-align:center;margin-top:16px;font-size:12px">
          🔒 Stored only in your browser. Educational tool — not financial advice.
        </p>
      </div>`;

    // wire option clicks
    container.querySelectorAll("[data-q]").forEach(el => {
      el.addEventListener("click", () => {
        const q = el.getAttribute("data-q");
        const v = el.getAttribute("data-v");
        const type = el.getAttribute("data-type");
        if (type === "multi") {
          answers[q] = answers[q] || [];
          const i = answers[q].indexOf(v);
          if (i >= 0) answers[q].splice(i, 1); else answers[q].push(v);
        } else {
          answers[q] = type === "scale" ? +v : v;
        }
        render(container);
      });
    });

    // method-tree: live search (rebuilds groups only, keeps input focused)
    const search = container.querySelector("#mtree-search");
    if (search) {
      search.addEventListener("input", (e) => { methodQuery = e.target.value; rebuildTree(container); });
      bindTreeHandlers(container);
    }

    container.querySelector("#sv-back").addEventListener("click", () => { if (step > 0) { step--; render(container); } });
    container.querySelector("#sv-next").addEventListener("click", () => next(container));
  }

  function highlight(text, qy) {
    if (!qy) return text;
    const i = text.toLowerCase().indexOf(qy);
    if (i < 0) return text;
    return text.slice(0, i) + "<mark>" + text.slice(i, i + qy.length) + "</mark>" + text.slice(i + qy.length);
  }

  // Inner groups HTML — rebuilt on its own so the search box keeps focus.
  function renderMethodGroups(sel) {
    const qy = methodQuery.trim().toLowerCase();
    const groups = window.METHOD_TAXONOMY.map(g => {
      const visItems = qy ? g.items.filter(it => it.toLowerCase().includes(qy)) : g.items;
      if (qy && visItems.length === 0) return "";          // hide non-matching categories
      const isOpen = qy ? true : expanded.has(g.key);       // auto-open while searching
      const count = sel.filter(v => window.methodCatKey(v) === g.key).length;
      const allSel = count === g.items.length && count > 0;
      const body = isOpen ? `<div class="mtree-body">
        ${qy ? "" : `<button class="opt mtree-item mtree-all ${allSel ? "selected" : ""}" data-cat-all="${g.key}">${allSel ? "✓ Deselect all" : "Select all in category"}</button>`}
        ${visItems.map(it => {
          const v = window.methodValue(g.key, it);
          const on = sel.includes(v);
          return `<button class="opt mtree-item ${on ? "selected" : ""}" data-mitem="${esc(v)}">${highlight(it, qy)}</button>`;
        }).join("")}
      </div>` : "";
      return `<div class="mtree-cat">
        <div class="mtree-head" data-cat-toggle="${g.key}">
          <span><span class="mtree-caret">${isOpen ? "▾" : "▸"}</span> ${g.cat}</span>
          <span class="mtree-count">${count ? count + " ✓" : ""} <span class="faint">/${g.items.length}</span></span>
        </div>${body}</div>`;
    }).join("");
    return groups || `<div class="empty-state" style="padding:30px"><div class="es-icon">🔍</div>No strategies match “${esc(methodQuery)}”.</div>`;
  }

  function renderMethodTree(q) {
    const sel = answers[q.id] || [];
    return `<div class="q-block">
      <span class="q-label">${q.label}${q.help ? `<span class="q-help">${q.help}</span>` : ""}
        <span class="q-help accent" id="mtree-selcount">${sel.length ? sel.length + " selected" : ""}</span></span>
      <input id="mtree-search" class="mtree-search" type="search" placeholder="🔍 Search 250+ strategies (e.g. “momentum”, “iron condor”, “macro”)…" value="${esc(methodQuery)}">
      <div class="mtree" id="mtree-groups">${renderMethodGroups(sel)}</div>
    </div>`;
  }

  function renderQuestion(q) {
    const cur = answers[q.id];
    if (q.type === "methodtree") return renderMethodTree(q);
    if (q.type === "scale") {
      let btns = "";
      for (let i = 1; i <= 5; i++) {
        btns += `<button class="scale-btn ${cur === i ? "selected" : ""}" data-q="${q.id}" data-v="${i}" data-type="scale">${i}</button>`;
      }
      return `<div class="q-block">
        <span class="q-label">${q.label}</span>
        <div class="scale-row">${btns}</div>
        <div class="scale-ends"><span>${q.lo}</span><span>${q.hi}</span></div>
      </div>`;
    }
    const cols = q.cols || 2;
    const opts = q.options.map(o => {
      const v = typeof o === "string" ? o : o.v;
      const d = typeof o === "string" ? "" : o.d;
      const selected = q.type === "multi"
        ? (cur || []).includes(v)
        : cur === v;
      return `<button class="opt ${selected ? "selected" : ""}" data-q="${q.id}" data-v="${v}" data-type="${q.type}">
        ${v}${d ? `<span class="opt-desc">${d}</span>` : ""}
      </button>`;
    }).join("");
    return `<div class="q-block">
      <span class="q-label">${q.label}${q.help ? `<span class="q-help">${q.help}</span>` : ""}</span>
      <div class="opt-grid cols-${cols}">${opts}</div>
    </div>`;
  }

  function next(container) {
    const s = STEPS[step];
    // validate
    for (const q of s.questions) {
      if (q.optional) continue;
      const v = answers[q.id];
      const empty = v == null || (Array.isArray(v) && v.length === 0);
      if (empty) {
        APP_toast(`Please answer: ${q.label}`);
        return;
      }
    }
    if (step < STEPS.length - 1) { step++; render(container); }
    else {
      // defaults for any scale not answered (shouldn't happen due to validation)
      onDone && onDone({ ...answers, createdAt: "session" });
    }
  }

  return { start, STEPS };
})();

window.SURVEY = SURVEY;
