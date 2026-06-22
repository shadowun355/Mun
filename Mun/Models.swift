import SwiftUI

// Mock data model — replace price/dayPct/OHLC/mcap/vol/pe with a live market-data feed,
// and RATE with a live FX rate. Canonical price is stored in USD.
struct Instrument: Identifiable {
    let sym, name, name2, logo, exch: String
    let native, cat, kind: String          // native: usd|thb · cat: foreign|thai|crypto|etf · kind: stock|crypto
    var price, dayPct: Double               // live, patched by MarketAPI
    let shares, avg: Double                 // user holdings, stay local
    var open, high, low: Double             // live, patched by MarketAPI (order preserved for memberwise init)
    let mcap, vol, pe: String
    var id: String { sym }
}

struct Txn: Identifiable, Codable {
    let id = UUID()
    let type: String                        // buy | sell | dividend
    let title, sub, amt, time: String
    // id is local-only (Identifiable); a fresh UUID is fine on decode.
    enum CodingKeys: String, CodingKey { case type, title, sub, amt, time }
}

struct TxnGroup: Identifiable {
    let date: String
    let items: [Txn]
    var id: String { date }
}

struct AllocSlice: Identifiable {
    let id = UUID()
    let label: String
    let color: Color
    let pct: Int
}

// Order ticket drives the buy/sell bottom sheet.
struct Ticket: Identifiable {
    let id = UUID()
    let mode: String                        // buy | sell
    let sym: String
    var qty: Double
}
