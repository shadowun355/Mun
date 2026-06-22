import SwiftUI

final class Store: ObservableObject {
    // ---- state (mirrors the prototype's logic class) ----
    @Published var tab = 0
    @Published var dark = UserDefaults.standard.bool(forKey: "dark") { didSet { UserDefaults.standard.set(dark, forKey: "dark") } }
    @Published var cur = UserDefaults.standard.string(forKey: "cur") ?? "thb" { didSet { UserDefaults.standard.set(cur, forKey: "cur") } }  // thb | usd
    @Published var range = "1d"
    @Published var watchFilter = "all"       // all | thai | foreign | crypto
    @Published var txnFilter = "all"         // all | buy | sell | dividend
    @Published var starred: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "starred") ?? ["AAPL", "BTC"]) { didSet { UserDefaults.standard.set(Array(starred), forKey: "starred") } }
    @Published var notif = (UserDefaults.standard.object(forKey: "notif") as? Bool) ?? true { didSet { UserDefaults.standard.set(notif, forKey: "notif") } }
    @Published var extraTxns: [Txn] = Store.loadTxns() { didSet { Store.saveTxns(extraTxns) } }
    @Published var toast: String?
    @Published var ticket: Ticket?
    @Published var submitting = false        // order in flight via broker

    let broker: Broker = MockBroker()        // swap point for a real broker later

    // ---- persistence helpers (extraTxns is the only Codable blob) ----
    static func loadTxns() -> [Txn] {
        guard let d = UserDefaults.standard.data(forKey: "extraTxns"),
              let t = try? JSONDecoder().decode([Txn].self, from: d) else { return [] }
        return t
    }
    static func saveTxns(_ t: [Txn]) {
        UserDefaults.standard.set(try? JSONEncoder().encode(t), forKey: "extraTxns")
    }

    @Published var rate = 36.4               // live USD→THB, refreshed by MarketAPI; seed is fallback
    var theme: Theme { dark ? .dark : .light }

    let holdingList = ["AAPL", "PTT", "BTC", "NVDA"]
    let watchList = ["TSLA", "CPALL", "NVDA", "KBANK", "ETH", "SPY", "QQQ"]
    let cashUsd = 10000.0

    @Published var data: [String: Instrument] = [   // seed = offline fallback; live fields patched by MarketAPI
        "AAPL": Instrument(sym: "AAPL", name: "Apple", name2: "Apple Inc.", logo: "AA", exch: "NASDAQ", native: "usd", cat: "foreign", kind: "stock", price: 213.40, dayPct: 1.35, shares: 125, avg: 176.20, open: 211.20, high: 214.85, low: 210.90, mcap: "3.27T", vol: "48.2M", pe: "32.6"),
        "PTT": Instrument(sym: "PTT", name: "ปตท.", name2: "บมจ. ปตท.", logo: "PT", exch: "SET", native: "thb", cat: "thai", kind: "stock", price: 0.906, dayPct: 0.46, shares: 6000, avg: 0.85, open: 0.90, high: 0.92, low: 0.89, mcap: "1.03T฿", vol: "22.1M", pe: "9.8"),
        "BTC": Instrument(sym: "BTC", name: "Bitcoin", name2: "Bitcoin", logo: "₿", exch: "Crypto", native: "usd", cat: "crypto", kind: "crypto", price: 68131, dayPct: -2.10, shares: 0.4, avg: 55000, open: 69500, high: 69900, low: 67200, mcap: "1.34T", vol: "฿42B", pe: "—"),
        "NVDA": Instrument(sym: "NVDA", name: "Nvidia", name2: "Nvidia Corp.", logo: "NV", exch: "NASDAQ", native: "usd", cat: "foreign", kind: "stock", price: 123.04, dayPct: 3.22, shares: 90, avg: 98.00, open: 119.40, high: 124.10, low: 118.90, mcap: "3.02T", vol: "310M", pe: "58.1"),
        "TSLA": Instrument(sym: "TSLA", name: "Tesla", name2: "Tesla Inc.", logo: "TS", exch: "NASDAQ", native: "usd", cat: "foreign", kind: "stock", price: 248.50, dayPct: 2.10, shares: 0, avg: 0, open: 244.0, high: 250.2, low: 243.1, mcap: "792B", vol: "98M", pe: "71.4"),
        "CPALL": Instrument(sym: "CPALL", name: "ซีพี ออลล์", name2: "ซีพี ออลล์", logo: "CP", exch: "SET", native: "thb", cat: "thai", kind: "stock", price: 1.60, dayPct: -0.43, shares: 0, avg: 0, open: 1.61, high: 1.62, low: 1.59, mcap: "524B฿", vol: "31M", pe: "18.2"),
        "KBANK": Instrument(sym: "KBANK", name: "กสิกรไทย", name2: "กสิกรไทย", logo: "KB", exch: "SET", native: "thb", cat: "thai", kind: "stock", price: 3.64, dayPct: 0.76, shares: 0, avg: 0, open: 3.61, high: 3.66, low: 3.60, mcap: "344B฿", vol: "14M", pe: "7.1"),
        "ETH": Instrument(sym: "ETH", name: "Ethereum", name2: "Ethereum", logo: "Ξ", exch: "Crypto", native: "usd", cat: "crypto", kind: "crypto", price: 2261, dayPct: -1.40, shares: 0, avg: 0, open: 2295, high: 2310, low: 2240, mcap: "272B", vol: "฿18B", pe: "—"),
        // ETFs — live via Finnhub (same /quote path as US stocks); seed is offline fallback.
        "SPY": Instrument(sym: "SPY", name: "S&P 500 ETF", name2: "SPDR S&P 500 ETF Trust", logo: "SP", exch: "NYSE", native: "usd", cat: "etf", kind: "stock", price: 545.0, dayPct: 0.62, shares: 0, avg: 0, open: 543.1, high: 546.4, low: 542.2, mcap: "560B", vol: "62M", pe: "—"),
        "QQQ": Instrument(sym: "QQQ", name: "Nasdaq 100 ETF", name2: "Invesco QQQ Trust", logo: "QQ", exch: "NASDAQ", native: "usd", cat: "etf", kind: "stock", price: 478.0, dayPct: 0.88, shares: 0, avg: 0, open: 475.0, high: 479.5, low: 474.3, mcap: "300B", vol: "40M", pe: "—")
    ]

    let baseTxns: [TxnGroup] = [
        TxnGroup(date: "20 มิถุนายน 2568", items: [
            Txn(type: "buy", title: "ซื้อ NVDA", sub: "5 หุ้น · $122.40", amt: "−$612.00", time: "10:24"),
            Txn(type: "sell", title: "ขาย CPALL", sub: "300 หุ้น · ฿58.50", amt: "+฿17,550", time: "09:48")
        ]),
        TxnGroup(date: "19 มิถุนายน 2568", items: [
            Txn(type: "buy", title: "ซื้อ AAPL", sub: "10 หุ้น · $210.80", amt: "−$2,108.00", time: "15:02"),
            Txn(type: "dividend", title: "ปันผล ปตท.", sub: "1,200 หุ้น · ฿1.50", amt: "+฿1,800", time: "11:30"),
            Txn(type: "sell", title: "ขาย BTC", sub: "0.02 · ฿2.51M", amt: "+฿50,200", time: "08:15")
        ])
    ]

    // ---- formatters (mirror price()/val()/altVal()/qtyLabel()/pctStr()) ----
    func nf(_ n: Double, _ d: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = d
        f.maximumFractionDigits = d
        f.groupingSeparator = ","
        f.decimalSeparator = "."
        return f.string(from: NSNumber(value: n)) ?? ""
    }
    func price(_ usd: Double) -> String {
        if cur == "thb" { let v = usd * rate; return "฿" + nf(v, v >= 1000 ? 0 : 2) }
        return "$" + nf(usd, 2)
    }
    func val(_ usd: Double) -> String {
        if cur == "thb" { return "฿" + nf((usd * rate).rounded(), 0) }
        return "$" + nf(usd, usd >= 10000 ? 0 : 2)
    }
    func altVal(_ usd: Double) -> String {
        if cur == "thb" { return "≈ $" + nf(usd, 2) }
        return "≈ ฿" + nf((usd * rate).rounded(), 0)
    }
    func qtyLabel(_ s: Instrument) -> String {
        s.kind == "crypto" ? nf(s.shares, 2) + " " + s.sym : nf(s.shares, 0) + " หุ้น"
    }
    func pctStr(_ p: Double) -> String {
        (p >= 0 ? "+" : "−") + String(format: "%.2f", abs(p)) + "%"
    }

    // ---- portfolio math ----
    var totalUsd: Double { cashUsd + holdingList.reduce(0) { $0 + data[$1]!.shares * data[$1]!.price } }
    var dayAbsUsd: Double { holdingList.reduce(0) { let s = data[$1]!; return $0 + s.shares * s.price * s.dayPct / 100 } }
    var dayPct: Double { totalUsd == 0 ? 0 : dayAbsUsd / totalUsd * 100 }

    var alloc: [AllocSlice] {
        var cat: [String: Double] = ["foreign": 0, "thai": 0, "crypto": 0]
        for sym in holdingList { let s = data[sym]!; cat[s.cat, default: 0] += s.shares * s.price }
        let raw: [(String, Color, Double)] = [
            ("หุ้นต่างประเทศ", theme.gold, cat["foreign"]!),
            ("หุ้นไทย", theme.csage, cat["thai"]!),
            ("คริปโต", theme.cblue, cat["crypto"]!),
            ("เงินสด", theme.cclay, cashUsd)
        ]
        return raw.map { AllocSlice(label: $0.0, color: $0.1, pct: Int(($0.2 / totalUsd * 100).rounded())) }
    }

    var txnGroups: [TxnGroup] {
        var groups = baseTxns
        if !extraTxns.isEmpty {
            groups[0] = TxnGroup(date: groups[0].date, items: extraTxns + groups[0].items)
        }
        return groups.compactMap { g in
            let items = g.items.filter { txnFilter == "all" || $0.type == txnFilter }
            return items.isEmpty ? nil : TxnGroup(date: g.date, items: items)
        }
    }

    var watchRows: [Instrument] {
        watchList.compactMap { data[$0] }.filter { watchFilter == "all" || $0.cat == watchFilter }
    }

    // ---- actions ----
    func toggleStar(_ sym: String) {
        if starred.contains(sym) { starred.remove(sym) } else { starred.insert(sym) }
    }

    @MainActor
    func confirmTicket() async {
        guard let tk = ticket, let s = data[tk.sym] else { return }
        let order = Order(sym: tk.sym, side: tk.mode == "buy" ? .buy : .sell, qty: tk.qty)
        submitting = true
        defer { submitting = false }
        do {
            let fill = try await broker.submit(order, at: s.price)
            let buy = order.side == .buy
            let amt = (buy ? "−" : "+") + val(order.qty * fill.price)
            let sub = nf(order.qty, 0) + (s.kind == "crypto" ? " " + s.sym : " หุ้น") + " · " + price(fill.price)
            let entry = Txn(type: buy ? "buy" : "sell", title: (buy ? "ซื้อ " : "ขาย ") + s.sym, sub: sub, amt: amt, time: "เมื่อสักครู่")
            extraTxns.insert(entry, at: 0)
            ticket = nil
            tab = 3
            showToast((buy ? "ซื้อ " : "ขาย ") + s.sym + " สำเร็จ")
        } catch {
            showToast("คำสั่งไม่สำเร็จ")   // order rejected by broker
        }
    }

    func showToast(_ msg: String) {
        toast = msg
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            if self?.toast != nil { self?.toast = nil }
        }
    }

    // ---- live data (rungs 1+2: crypto+FX no-key, US via optional Finnhub key) ----
    func refresh() async { await MarketAPI.refresh(self) }

    // Patch only the live numeric fields; static fields + holdings keep their seed.
    func patch(_ sym: String, price: Double, dayPct: Double, open: Double? = nil, high: Double? = nil, low: Double? = nil) {
        guard var s = data[sym] else { return }
        s.price = price; s.dayPct = dayPct
        if let open { s.open = open }
        if let high { s.high = high }
        if let low { s.low = low }
        data[sym] = s
    }
}
