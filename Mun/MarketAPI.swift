import Foundation

// Live market data, rungs 1+2. No third-party deps — URLSession + JSONSerialization.
// Crypto (CoinGecko) and FX (Frankfurter) need no key. US stocks need a free Finnhub
// key — leave it empty and US silently stays on seed values. Thai (SET) stocks come
// from the localhost proxy in proxy/ (off = Thai stays seed).
// Every source fails independently back to the seed; nothing throws to the UI.
enum MarketAPI {
    // Paste a free key from https://finnhub.io to light up US stocks; "" = US stays mock.
    static let finnhubKey = "d8ervjpr01qub7keho10d8ervjpr01qub7keho1g"

    static let cryptoIds = ["BTC": "bitcoin", "ETH": "ethereum"]   // app sym → CoinGecko id
    static let usSyms = ["AAPL", "NVDA", "TSLA", "SPY", "QQQ"]   // ETFs use the same Finnhub /quote path
    static let thaiSyms = ["PTT", "CPALL", "KBANK"]               // served by the localhost proxy
    static let proxyBase = "http://127.0.0.1:8000"               // proxy/ FastAPI; off = Thai stays seed

    static func refresh(_ store: Store) async {
        // FX first: USD↔THB display and Thai normalization depend on a fresh rate.
        if let r = await fetchFX() { await MainActor.run { store.rate = r } }
        let rate = await MainActor.run { store.rate }

        async let crypto = fetchCrypto()
        async let us = fetchUS()
        async let thai = fetchThai(rate: rate)
        let (c, u, t) = await (crypto, us, thai)

        await MainActor.run {
            for (sym, q) in c { store.patch(sym, price: q.price, dayPct: q.dayPct) }
            for (sym, q) in u { store.patch(sym, price: q.price, dayPct: q.dayPct, open: q.open, high: q.high, low: q.low) }
            for (sym, q) in t { store.patch(sym, price: q.price, dayPct: q.dayPct, open: q.open, high: q.high, low: q.low) }
        }
    }

    // Live SET prices via the localhost proxy (THB). Normalize THB→USD by the FX
    // rate to keep the USD-canonical model. Proxy down / 404 → symbol stays on seed.
    static func fetchThai(rate: Double) async -> [String: (price: Double, dayPct: Double, open: Double, high: Double, low: Double)] {
        guard rate > 0 else { return [:] }
        var out: [String: (price: Double, dayPct: Double, open: Double, high: Double, low: Double)] = [:]
        // ponytail: sequential — 3 symbols, not worth a task group.
        for sym in thaiSyms {
            guard let j = await getJSON("\(proxyBase)/quote?sym=\(sym)"),
                  let thb = j["price"] as? Double, thb > 0 else { continue }
            out[sym] = (thb / rate, j["dayPct"] as? Double ?? 0,
                        (j["open"] as? Double ?? thb) / rate,
                        (j["high"] as? Double ?? thb) / rate,
                        (j["low"]  as? Double ?? thb) / rate)
        }
        return out
    }

    // ---- sources ----
    static func fetchFX() async -> Double? {
        guard let j = await getJSON("https://api.frankfurter.dev/v1/latest?base=USD&symbols=THB"),
              let rates = j["rates"] as? [String: Any],
              let thb = rates["THB"] as? Double else { return nil }
        return thb
    }

    static func fetchCrypto() async -> [String: (price: Double, dayPct: Double)] {
        let ids = cryptoIds.values.joined(separator: ",")
        guard let j = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=\(ids)&vs_currencies=usd&include_24hr_change=true")
        else { return [:] }
        var out: [String: (price: Double, dayPct: Double)] = [:]
        for (sym, id) in cryptoIds {
            guard let o = j[id] as? [String: Any], let p = o["usd"] as? Double else { continue }
            out[sym] = (p, o["usd_24h_change"] as? Double ?? 0)
        }
        return out
    }

    static func fetchUS() async -> [String: (price: Double, dayPct: Double, open: Double, high: Double, low: Double)] {
        guard !finnhubKey.isEmpty else { return [:] }
        var out: [String: (price: Double, dayPct: Double, open: Double, high: Double, low: Double)] = [:]
        // ponytail: sequential — 3 symbols, not worth a task group.
        for sym in usSyms {
            guard let j = await getJSON("https://finnhub.io/api/v1/quote?symbol=\(sym)&token=\(finnhubKey)"),
                  let c = j["c"] as? Double, c > 0 else { continue }
            out[sym] = (c, j["dp"] as? Double ?? 0, j["o"] as? Double ?? c, j["h"] as? Double ?? c, j["l"] as? Double ?? c)
        }
        return out
    }

    private static func getJSON(_ urlStr: String) async -> [String: Any]? {
        guard let url = URL(string: urlStr) else { return nil }
        do {
            let (d, resp) = try await URLSession.shared.data(from: url)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return try JSONSerialization.jsonObject(with: d) as? [String: Any]
        } catch { return nil }
    }
}
