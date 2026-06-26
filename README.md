# InvestorMatch AI

Your personal AI hedge-fund analyst — a professional fintech web app that **discovers and ranks stocks for you** based on an intelligent investor assessment, instead of making you upload screenshots or search manually.

## Run it

**Option A — no install:** double-click `index.html` (runs fully in the browser, offline).

**Option B — with the Python backend (recommended):** double-click **`run_server.bat`** (or run `python server.py`), then open `http://localhost:8000`.
Serving over `http://` makes watchlist/portfolio persistence reliable, and the app auto-detects the backend (the data badge shows "Python backend").

## Python backend (`server.py`)

Standard-library only — **no pip install needed**. It:
- serves the static site, and
- exposes a small JSON API:
  - `GET /api/health` — status + data source
  - `GET /api/stocks` — quotes for the whole universe
  - `GET /api/quote?symbol=NVDA` — a single quote

### Live market data (optional)
Set an environment variable with a free [Finnhub](https://finnhub.io) key and the API returns **real** prices (the key stays server-side, never in the browser):

```powershell
$env:FINNHUB_API_KEY = "your_key_here"
python server.py
```

Without a key it returns deterministic **simulated** quotes (same as the offline demo). Swapping in another provider (Polygon, Alpha Vantage, IEX Cloud) is a one-function change in `fetch_live()`.

> Python was installed via `winget install Python.Python.3.12`. If `python` isn't found in a new terminal, use the full path `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` or reopen the terminal so PATH refreshes.

## What it does

1. **Onboarding survey** — multi-step assessment: personal profile, risk assessment, and time horizon/trading style.
2. **AI classification** — derives your risk band (Conservative → Speculative), trading style (Scalper → Long-Term), and weighted investor archetypes with confidence scores.
3. **Stock discovery engine** — scores every stock 0–100 for *your* profile across fundamentals, technicals, sentiment, risk alignment, and horizon fit.
4. **Recommendation feed** — ranked match cards with score meters, sparklines, verdicts (Strong Match → Avoid), and plain-English explanations.
5. **Stock detail + AI memo** — full investment memo (bull/bear, catalysts, valuation, entry/exit zones, position sizing, risk plan) and a strategy-suitability table across 35+ trading strategies.
6. **Portfolio builder** — diversification, risk, expected-return estimate, sector exposure, and a health score.
7. **AI chat assistant** — profile-aware Q&A ("find me aggressive growth stocks", "why is NVDA a match?", "compare AAPL MSFT NVDA").

## How the "AI" works

The classification, scoring, memos, and chat are powered by **transparent, deterministic models** in `js/engine.js`, `js/memo.js`, and `js/chat.js`. This is intentional for a finance tool: every score is reproducible and explainable rather than a black box. To upgrade the chat to a live LLM, wire `CHAT.callLLM()` to the Claude API **from a backend** (never put an API key in the browser).

## Data

Stock figures in `js/data.js` are **realistic illustrative seed data**, not live market data. No network calls are made.

## ⚠️ Disclaimer

Educational demonstration only. **Not** financial, investment, tax, or legal advice. No outcome or return is guaranteed. Investing involves risk of loss. Always do your own research and consult a licensed professional.

## Project structure

```
index.html        App shell
css/styles.css    Dark fintech theme (Bloomberg/TradingView/Robinhood inspired)
js/data.js        Stock universe (illustrative)
js/engine.js      Classification + compatibility + strategy scoring
js/memo.js        Investment memo generator
js/charts.js      SVG charts, gauges, meters (offline)
js/chat.js        Profile-aware assistant
js/survey.js      Multi-step onboarding
js/app.js         State, routing, views, wiring
```
