#!/usr/bin/env python3
"""
InvestorMatch AI — Python backend (standard library only, no pip needed).

What it does
------------
1. Serves the static site (index.html, css/, js/) over http:// so the
   browser features that need a real origin (localStorage persistence,
   fetch to /api/*) work properly.
2. Exposes a small JSON API the frontend can use:
       GET /api/health              -> backend status + data source
       GET /api/stocks              -> list of quotes for the universe
       GET /api/quote?symbol=AAPL   -> single quote
3. Real-data ready: if you set the FINNHUB_API_KEY environment variable,
   /api/quote and /api/stocks return LIVE prices from Finnhub. Without a
   key, it returns deterministic simulated quotes (same idea as the demo).
   The API key stays server-side and is never exposed to the browser.

Run
---
    python server.py            (then open http://localhost:8000)
    PORT=9000 python server.py  (custom port)

Set a live data key (PowerShell):
    $env:FINNHUB_API_KEY = "your_key_here"; python server.py
"""

import json
import os
import sys
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))

# Compact mirror of the demo universe (symbol, name, base price, day %, mkt cap $B).
UNIVERSE = [
    ("AAPL", "Apple Inc.", 212.40, 0.6, 3100), ("MSFT", "Microsoft Corp.", 452.10, 0.9, 3300),
    ("NVDA", "NVIDIA Corp.", 128.70, 2.1, 3050), ("AMZN", "Amazon.com Inc.", 186.30, -0.4, 1900),
    ("GOOGL", "Alphabet Inc.", 178.90, 0.3, 2100), ("META", "Meta Platforms", 498.20, 1.4, 1300),
    ("TSLA", "Tesla Inc.", 243.10, -1.8, 780), ("JPM", "JPMorgan Chase", 201.50, 0.5, 560),
    ("V", "Visa Inc.", 275.80, 0.2, 560), ("JNJ", "Johnson & Johnson", 158.20, 0.1, 380),
    ("UNH", "UnitedHealth Group", 512.60, -0.6, 480), ("PG", "Procter & Gamble", 167.40, 0.0, 390),
    ("KO", "Coca-Cola Co.", 62.30, 0.2, 270), ("XOM", "Exxon Mobil", 113.70, 1.1, 480),
    ("HD", "Home Depot", 358.90, 0.4, 380), ("COST", "Costco Wholesale", 852.40, 0.7, 380),
    ("AVGO", "Broadcom Inc.", 168.20, 1.6, 780), ("AMD", "Advanced Micro Devices", 148.50, 2.4, 240),
    ("CRM", "Salesforce Inc.", 268.10, -0.7, 260), ("PLTR", "Palantir Technologies", 42.80, 3.2, 110),
    ("SOFI", "SoFi Technologies", 8.40, 4.1, 9), ("ENPH", "Enphase Energy", 98.60, -2.6, 12),
    ("DIS", "Walt Disney Co.", 109.50, 0.3, 200), ("PFE", "Pfizer Inc.", 28.30, -0.5, 160),
    ("T", "AT&T Inc.", 19.80, 0.1, 140), ("O", "Realty Income Corp.", 58.70, 0.2, 50),
    ("LLY", "Eli Lilly & Co.", 798.20, 1.2, 760), ("WMT", "Walmart Inc.", 69.40, 0.3, 560),
    ("BA", "Boeing Co.", 182.60, -1.2, 110), ("CAT", "Caterpillar Inc.", 345.10, 0.6, 170),
    ("MRK", "Merck & Co.", 128.90, 0.4, 300), ("SHOP", "Shopify Inc.", 68.30, 1.9, 90),
]
SIM = {s: {"name": n, "price": p, "changePct": c, "capB": cap} for (s, n, p, c, cap) in UNIVERSE}


def has_key():
    return bool(os.environ.get("FINNHUB_API_KEY"))


_DS_CACHE = {"val": None}


def data_source():
    """Which source is actually in use (cached)."""
    if os.environ.get("FINNHUB_API_KEY"):
        return "finnhub"
    if _DS_CACHE["val"] is None:
        _DS_CACHE["val"] = "yahoo" if fetch_yahoo("AAPL") else "simulated"
    return _DS_CACHE["val"]


def _http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (InvestorMatchAI)"})
    with urllib.request.urlopen(req, timeout=9) as r:
        return json.load(r)


def fetch_yahoo(symbol):
    """Keyless live quote from Yahoo Finance (no signup required)."""
    try:
        url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
               "?range=1d&interval=1d" % symbol)
        d = _http_json(url)
        res = d["chart"]["result"][0]
        meta = res["meta"]
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        if price is None:
            return None
        change = round(price - prev, 2) if prev else None
        pct = round((price - prev) / prev * 100, 2) if prev else None
        base = SIM.get(symbol, {})
        return {
            "symbol": symbol, "name": base.get("name", symbol), "price": price,
            "change": change, "changePct": pct, "prevClose": prev,
            "high": meta.get("regularMarketDayHigh"), "low": meta.get("regularMarketDayLow"),
            "volume": meta.get("regularMarketVolume"), "capB": base.get("capB"),
            "currency": meta.get("currency", "USD"), "source": "yahoo",
        }
    except Exception:
        return None


def fetch_history(symbol, rng="1y", interval="1d"):
    """Historical OHLC/volume from Yahoo Finance (keyless)."""
    try:
        url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
               "?range=%s&interval=%s" % (symbol, rng, interval))
        d = _http_json(url)
        res = d["chart"]["result"][0]
        ts = res.get("timestamp", []) or []
        q = res["indicators"]["quote"][0]
        out = []
        for i, t in enumerate(ts):
            c = q.get("close", [None] * len(ts))[i]
            if c is None:
                continue
            out.append({"t": t, "price": round(c, 2), "volume": q.get("volume", [0] * len(ts))[i] or 0})
        return {"symbol": symbol, "range": rng, "interval": interval, "points": out, "source": "yahoo"}
    except Exception:
        return None


def fetch_live(symbol):
    """Live quote from Finnhub if a key is configured; else None."""
    key = os.environ.get("FINNHUB_API_KEY")
    if not key:
        return None
    url = "https://finnhub.io/api/v1/quote?symbol=%s&token=%s" % (symbol, key)
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            d = json.load(r)
        if not d or d.get("c") in (None, 0):
            return None
        return {
            "symbol": symbol, "price": d.get("c"), "change": d.get("d"),
            "changePct": d.get("dp"), "high": d.get("h"), "low": d.get("l"),
            "open": d.get("o"), "prevClose": d.get("pc"), "source": "finnhub",
        }
    except Exception:
        return None


def sim_quote(symbol):
    base = SIM.get(symbol)
    if not base:
        return None
    price = base["price"]
    pct = base["changePct"]
    return {
        "symbol": symbol, "name": base["name"], "price": price,
        "changePct": pct, "change": round(price * pct / 100, 2),
        "capB": base["capB"], "source": "simulated",
    }


def quote(symbol):
    # priority: Finnhub (if key) -> Yahoo (keyless) -> simulated
    return fetch_live(symbol) or fetch_yahoo(symbol) or sim_quote(symbol)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            ds = data_source()
            return self._json({
                "status": "ok",
                "dataSource": ds,
                "live": ds != "simulated",
                "universe": len(UNIVERSE),
            })
        if path == "/api/stocks":
            return self._json({"stocks": [quote(s) for s in SIM.keys()]})
        if path == "/api/quote":
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            sym = (qs.get("symbol", [""])[0]).upper()
            q = quote(sym)
            return self._json(q if q else {"error": "unknown symbol"}, 200 if q else 404)
        if path == "/api/history":
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            sym = (qs.get("symbol", [""])[0]).upper()
            rng = qs.get("range", ["1y"])[0]
            interval = qs.get("interval", ["1d"])[0]
            h = fetch_history(sym, rng, interval)
            return self._json(h if h else {"error": "no history"}, 200 if h else 404)
        # otherwise serve static files
        return super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    ds = data_source()
    src = {"finnhub": "Finnhub (LIVE)", "yahoo": "Yahoo Finance (LIVE, keyless)",
           "simulated": "simulated (Yahoo unreachable)"}.get(ds, ds)
    print("=" * 56)
    print(" InvestorMatch AI — Python backend")
    print(" Serving:     %s" % ROOT)
    print(" URL:         http://localhost:%d" % PORT)
    print(" Data source: %s" % src)
    print(" API:         /api/health  /api/stocks  /api/quote?symbol=AAPL")
    print(" Press Ctrl+C to stop.")
    print("=" * 56)
    # Only pop a browser when running locally; cloud hosts (e.g. Render) set their own env.
    if not os.environ.get("RENDER"):
        try:
            webbrowser.open("http://localhost:%d" % PORT)
        except Exception:
            pass
    # Bind to 0.0.0.0 so cloud platforms can route external traffic to the service.
    host = "0.0.0.0" if os.environ.get("RENDER") else "127.0.0.1"
    srv = ThreadingHTTPServer((host, PORT), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        srv.server_close()


if __name__ == "__main__":
    main()
