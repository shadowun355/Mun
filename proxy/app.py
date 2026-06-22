"""Mun ThaiStock proxy — GET /quote?sym=PTT → THB OHLC for SET stocks.

Contract (pinned in SCOPE.md): GET /quote?sym=<SET symbol> returns
  {"sym","price","dayPct","open","high","low","ccy":"THB"}
or 404 if the symbol has no data. The iOS app divides THB prices by the live
FX rate to keep its USD-canonical model, and fails silently back to seed.

ponytail: data source is Yahoo Finance `<sym>.BK` (keyless, returns OHLC), NOT
UncleEngineer/ThaiStock scraping as SCOPE first proposed — Yahoo is far more
reliable and needs no Thai-specific lib. Swap the fetch() body if SET-direct
data is ever needed.
"""
import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mun ThaiStock proxy")

# The web client calls this from a browser → CORS is required (native iOS had none).
# ponytail: allow_origins=["*"] — tighten to the deployed site origin once it's known.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])

YF = "https://query1.finance.yahoo.com/v8/finance/chart/{}.BK"
UA = {"User-Agent": "Mozilla/5.0"}  # Yahoo 403s the default requests UA

# Finnhub key stays server-side (env var) — it must not ship in browser JS.
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")
FH = "https://finnhub.io/api/v1/quote?symbol={}&token={}"


def fetch(sym: str) -> dict:
    r = requests.get(YF.format(sym), headers=UA, timeout=8)
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    m = res["meta"]
    price = m["regularMarketPrice"]
    prev = m.get("chartPreviousClose") or m.get("previousClose") or price
    # Day OHLC from the indicators when present, else fall back to meta/price.
    q = (res.get("indicators", {}).get("quote") or [{}])[0]
    highs = [x for x in q.get("high", []) if x is not None]
    lows = [x for x in q.get("low", []) if x is not None]
    opens = [x for x in q.get("open", []) if x is not None]
    return {
        "sym": sym,
        "price": price,
        "dayPct": (price - prev) / prev * 100 if prev else 0.0,
        "open": opens[0] if opens else m.get("regularMarketOpen", price),
        "high": max(highs) if highs else m.get("regularMarketDayHigh", price),
        "low": min(lows) if lows else m.get("regularMarketDayLow", price),
        "ccy": "THB",
    }


@app.get("/")
def health():
    return {"ok": True}  # host healthcheck pings this


@app.get("/quote")
def quote(sym: str):
    try:
        return fetch(sym.upper())
    except Exception as e:  # network/parse/missing symbol → 404, app keeps seed
        raise HTTPException(status_code=404, detail=f"no quote for {sym}: {e}")


@app.get("/us")
def us(sym: str):
    """US stock/ETF quote via Finnhub, key hidden server-side. Same shape as /quote
    but ccy=USD. 404 on missing key or error → web client keeps seed."""
    if not FINNHUB_KEY:
        raise HTTPException(status_code=404, detail="no FINNHUB_KEY set")
    try:
        r = requests.get(FH.format(sym.upper(), FINNHUB_KEY), timeout=8)
        r.raise_for_status()
        j = r.json()
        if not j.get("c"):  # Finnhub returns c=0 for unknown symbols
            raise ValueError("empty quote")
        return {"sym": sym.upper(), "price": j["c"], "dayPct": j.get("dp") or 0.0,
                "open": j.get("o") or j["c"], "high": j.get("h") or j["c"],
                "low": j.get("l") or j["c"], "ccy": "USD"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"no us quote for {sym}: {e}")


if __name__ == "__main__":
    # Smoke test: PTT must return a positive THB price. Run: python app.py
    d = fetch("PTT")
    assert d["price"] > 0 and d["ccy"] == "THB", d
    print("ok", d)
