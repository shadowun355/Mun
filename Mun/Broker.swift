import Foundation

// Order-execution seam. Mun does not place real orders — MockBroker simulates a
// fill so the order ticket has a realistic async lifecycle. This protocol is the
// single swap point where a real broker (Alpaca paper, Settrade) plugs in later.
enum Side { case buy, sell }

struct Order {
    let sym: String
    let side: Side
    let qty: Double
}

struct Fill {
    let order: Order
    let price: Double      // USD fill price
    let at: Date
}

enum OrderError: Error { case rejected(String) }

protocol Broker {
    func submit(_ order: Order, at price: Double) async throws -> Fill
}

// Simulated broker: always fills at the quoted price after a short latency.
// ponytail: no validation/partial-fills — position tracking is a later milestone.
struct MockBroker: Broker {
    func submit(_ order: Order, at price: Double) async throws -> Fill {
        try await Task.sleep(nanoseconds: 400_000_000)
        return Fill(order: order, price: price, at: Date())
    }
}
