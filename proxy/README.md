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
