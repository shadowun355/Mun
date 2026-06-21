import Foundation

// Live market data, rungs 1+2. No third-party deps — URLSession + JSONSerialization.
// Crypto (CoinGecko) and FX (Frankfurter) need no key. US stocks need a free Finnhub
// key — leave it empty and US silently stays on seed values. Thai stocks stay mock.
// Every source fails independently back to the seed; nothing throws to the UI.
enum MarketAPI {
    // Paste a free key from https://finnhub.io to light up US stocks; "" = US stays mock.
    static let finnhubKey = ""

    static let cryptoIds = ["BTC": "bitcoin", "ETH": "ethereum"]   // app sym → CoinGecko id
    static let usSyms = ["AAPL", "NVDA", "TSLA"]

    static func refresh(_ store: Store) async {
        // FX first: USD↔THB display and (later) Thai normalization depend on a fresh rate.
        if let r = await fetchFX() { await MainActor.run { store.rate = r } }

        async let crypto = fetchCrypto()
        async let us = fetchUS()
        let (c, u) = await (crypto, us)

        await MainActor.run {
            for (sym, q) in c { store.patch(sym, price: q.price, dayPct: q.dayPct) }
            for (sym, q) in u { store.patch(sym, price: q.price, dayPct: q.dayPct, open: q.open, high: q.high, low: q.low) }
        }
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
