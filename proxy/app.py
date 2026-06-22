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
import requests
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Mun ThaiStock proxy")

YF = "https://query1.finance.yahoo.com/v8/finance/chart/{}.BK"
UA = {"User-Agent": "Mozilla/5.0"}  # Yahoo 403s the default requests UA


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


if __name__ == "__main__":
    # Smoke test: PTT must return a positive THB price. Run: python app.py
    d = fetch("PTT")
    assert d["price"] > 0 and d["ccy"] == "THB", d
    print("ok", d)
