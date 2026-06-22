# Mun ThaiStock proxy

Localhost FastAPI giving the app live SET (Thai) prices in THB.

```bash
cd proxy
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py                 # smoke test: prints "ok {...}" for PTT
uvicorn app:app --port 8000   # serve
```

Contract: `GET /quote?sym=PTT` → `{sym, price, dayPct, open, high, low, ccy:"THB"}`, or 404.

The iOS app hits `http://127.0.0.1:8000/quote?sym=...` on launch/refresh, divides
THB by the live FX rate (USD-canonical model), and silently keeps seed values if
the proxy is down. Start this before running the app to see live SET data.

Source: Yahoo Finance `<sym>.BK` (keyless). See header in `app.py`.

## Deploy publicly (for TestFlight / downloaded users)

Localhost only reaches your own Mac — testers need a hosted proxy. The `Dockerfile`
works on any container host (Render, Fly, Railway). The host injects `$PORT`.

**Render (free tier):** New → Web Service → connect repo → Root Directory `proxy`,
Runtime **Docker** → deploy. You get `https://<name>.onrender.com`.

**Fly:** `cd proxy && fly launch` (detects Dockerfile) → `fly deploy`.

**Local Docker test:** `cd proxy && docker build -t mun-proxy . && docker run -p 8000:8000 mun-proxy`
then `curl localhost:8000/quote?sym=PTT`.

After deploy, set `MarketAPI.proxyBase` to the HTTPS URL and rebuild the app.

⚠️ Yahoo sometimes rate-limits datacenter IPs (HTTP 429). If quotes start 404'ing in
the cloud, add a cache (e.g. 60s TTL) or swap `fetch()` to a paid SET source.

