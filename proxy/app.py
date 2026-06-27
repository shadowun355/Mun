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
import time
import statistics
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mun ThaiStock proxy")

# The web client calls this from a browser → CORS is required (native iOS had none).
# ponytail: allow_origins=["*"] — tighten to the deployed site origin once it's known.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])

UA = {"User-Agent": "Mozilla/5.0"}  # Yahoo 403s the default requests UA

# Candle history: same Yahoo chart endpoint, but keep the whole bar series. Takes a
# literal Yahoo symbol (client maps PTT->PTT.BK, BTC->BTC-USD, AAPL->AAPL) so the
# proxy needs no per-asset logic. Range key -> (Yahoo range, interval).
YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{}?range={}&interval={}"
RANGES = {"1d": ("1d", "5m"), "1w": ("5d", "15m"), "1m": ("1mo", "1d"),
          "3m": ("3mo", "1d"), "1y": ("1y", "1d"), "all": ("max", "1wk")}

# Finnhub key stays server-side (env var) — it must not ship in browser JS.
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")
FH = "https://finnhub.io/api/v1/quote?symbol={}&token={}"
FH_NEWS = "https://finnhub.io/api/v1/news?category=general&token={}"


YF_RAW = "https://query1.finance.yahoo.com/v8/finance/chart/{}"  # literal Yahoo symbol


def yfetch(ysym: str) -> dict:
    """Quote for a literal Yahoo symbol (PTT.BK, GC=F, ^SET.BK, ...). ccy is THB for
    .BK symbols (web client divides by FX rate), else USD."""
    r = requests.get(YF_RAW.format(ysym), headers=UA, timeout=8)
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
        "sym": ysym,
        "price": price,
        "dayPct": (price - prev) / prev * 100 if prev else 0.0,
        "open": opens[0] if opens else m.get("regularMarketOpen", price),
        "high": max(highs) if highs else m.get("regularMarketDayHigh", price),
        "low": min(lows) if lows else m.get("regularMarketDayLow", price),
        "ccy": "THB" if ysym.endswith(".BK") else "USD",
    }


def fetch(sym: str) -> dict:
    return yfetch(sym + ".BK")  # SET stocks: PTT -> PTT.BK


def candles(ysym: str, rng: str) -> dict:
    yr, yi = RANGES.get(rng, RANGES["1m"])
    r = requests.get(YF_CHART.format(ysym, yr, yi), headers=UA, timeout=8)
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    ts = res.get("timestamp") or []
    q = (res.get("indicators", {}).get("quote") or [{}])[0]
    o, h, l, c = q.get("open", []), q.get("high", []), q.get("low", []), q.get("close", [])
    bars = [{"t": ts[i], "o": o[i], "h": h[i], "l": l[i], "c": c[i]}
            for i in range(len(ts))
            if i < len(c) and None not in (o[i], h[i], l[i], c[i])]
    return {"sym": ysym, "bars": bars, "ccy": "THB" if ysym.endswith(".BK") else "USD"}


# Phase 5: dividend history (keyless, same Yahoo chart endpoint + events=div).
# Yahoo's forward calendar (quoteSummary) is crumb-gated and flaky from a server, so we
# use the reliable trailing series and INFER the next XD from the payment cadence.
YF_DIV = "https://query1.finance.yahoo.com/v8/finance/chart/{}?range=2y&interval=1mo&events=div"


def dividends(ysym: str) -> dict:
    """Trailing dividends + TTM yield + an inferred next-XD estimate for a literal Yahoo
    symbol (PTT.BK, SCHD, ...). Amounts are native currency (ccy). nextEst is an ESTIMATE
    (last XD + median payment interval), null if fewer than 2 payments are known."""
    r = requests.get(YF_DIV.format(ysym), headers=UA, timeout=8)
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    price = res["meta"].get("regularMarketPrice") or 0
    evs = ((res.get("events") or {}).get("dividends") or {})
    hist = sorted(({"date": int(v["date"]), "amount": float(v["amount"])} for v in evs.values()),
                  key=lambda d: d["date"])
    ccy = "THB" if ysym.endswith(".BK") else "USD"
    now = int(time.time())
    ttm = sum(d["amount"] for d in hist if d["date"] >= now - 365 * 86400)
    next_est = None
    if len(hist) >= 2:
        gaps = [hist[i]["date"] - hist[i - 1]["date"] for i in range(1, len(hist))]
        next_est = hist[-1]["date"] + int(statistics.median(gaps))
    return {
        "sym": ysym, "ccy": ccy, "price": price,
        "last": hist[-1] if hist else None,
        "ttm": ttm,
        "yieldPct": (ttm / price * 100) if price else 0.0,
        "nextEst": next_est,
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


@app.get("/yquote")
def yquote(sym: str):
    """Quote for a literal Yahoo symbol (gold GC=F, indices). Same shape as /quote.
    404 on error → web client keeps seed."""
    try:
        return yfetch(sym.upper())
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"no yquote for {sym}: {e}")


# Keyless Google Translate (same unofficial-endpoint approach as the keyless Yahoo
# data above). Cache by source text so the client's 60s /news poll never re-translates
# the same headline. ponytail: unbounded module dict — fine for personal news volume
# (a few hundred strings/day); add an LRU cap if it ever grows unbounded.
GT = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=th&dt=t&q={}"
_tr_cache = {}


def _to_thai(text):
    """Translate English -> Thai, returning the ORIGINAL on any failure (so one bad
    call never blanks an article). Cached by source string."""
    text = (text or "").strip()
    if not text:
        return ""
    if text in _tr_cache:
        return _tr_cache[text]
    try:
        r = requests.get(GT.format(urllib.parse.quote(text)), headers=UA, timeout=6)
        r.raise_for_status()
        out = "".join(seg[0] for seg in r.json()[0] if seg[0])
        _tr_cache[text] = out
        return out
    except Exception:
        return text  # fall back to English for this field only


@app.get("/news")
def news(limit: int = 10):
    """General market news, Finnhub key hidden server-side. Each item's headline +
    summary are translated to Thai (brief = the main idea, no click-through needed);
    `source`/`url` are kept only for credit. Returns [] on failure (UI hides news)."""
    if not FINNHUB_KEY:
        return []
    try:
        r = requests.get(FH_NEWS.format(FINNHUB_KEY), timeout=8)
        r.raise_for_status()
        raw = [a for a in r.json() if a.get("headline") and a.get("url")][:limit]
    except Exception:
        return []

    def render(a):
        # Per-article try: a single translation hiccup degrades to English, not blank.
        return {"headline": _to_thai(a["headline"]),
                "summary": _to_thai(a.get("summary", "")),
                "source": a.get("source", ""), "url": a["url"],
                "datetime": a.get("datetime", 0)}

    # Parallel first-fill so a cold proxy isn't ~20 sequential translate calls; cached
    # after the first poll. Order preserved by executor.map.
    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(render, raw))


@app.get("/dividends")
def dividends_route(sym: str):
    """Trailing dividends + TTM yield + inferred next XD for a literal Yahoo symbol.
    404 on error → web client just hides that symbol from the dividend calendar."""
    try:
        d = dividends(sym.upper())
        if not d["last"]:
            raise ValueError("no dividend history")
        return d
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"no dividends for {sym}: {e}")


@app.get("/candles")
def candles_route(sym: str, range: str = "1m"):
    """OHLC bar series for a chart. `sym` is the literal Yahoo symbol (e.g. PTT.BK,
    BTC-USD, AAPL). THB bars are flagged ccy=THB; the web client divides by FX rate."""
    try:
        d = candles(sym.upper(), range)
        if not d["bars"]:
            raise ValueError("no bars")
        return d
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"no candles for {sym}: {e}")


if __name__ == "__main__":
    # Smoke test: PTT must return a positive THB price + a non-empty candle series.
    d = fetch("PTT")
    assert d["price"] > 0 and d["ccy"] == "THB", d
    cd = candles("PTT.BK", "1m")
    assert cd["bars"] and cd["bars"][-1]["c"] > 0 and cd["ccy"] == "THB", cd
    g = yfetch("GC=F")  # gold futures, USD
    assert g["price"] > 0 and g["ccy"] == "USD", g
    dv = dividends("SCHD")  # high-dividend ETF, USD
    assert dv["last"] and dv["last"]["amount"] > 0 and dv["yieldPct"] > 0, dv
    print("ok", d, len(cd["bars"]), "bars; gold", g["price"], "; SCHD yield", round(dv["yieldPct"], 2))
