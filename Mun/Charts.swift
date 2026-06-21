import SwiftUI

// Normalized polyline (points in 0...1, y measured from the top). Straight segments —
// ponytail: good enough for mock charts; swap in real series + smoothing when you wire the API.
struct LineChart: Shape {
    var points: [CGPoint]
    var closed = false
    func path(in rect: CGRect) -> Path {
        var p = Path()
        guard let first = points.first else { return p }
        func map(_ pt: CGPoint) -> CGPoint { CGPoint(x: pt.x * rect.width, y: pt.y * rect.height) }
        p.move(to: map(first))
        for pt in points.dropFirst() { p.addLine(to: map(pt)) }
        if closed {
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            p.closeSubpath()
        }
        return p
    }
}

enum Series {
    static let up: [CGPoint] = [(0, 0.85), (0.18, 0.6), (0.34, 0.68), (0.5, 0.34), (0.66, 0.42), (0.82, 0.18), (1, 0.08)].map(CGPoint.init)
    static let down: [CGPoint] = [(0, 0.18), (0.18, 0.34), (0.34, 0.28), (0.5, 0.52), (0.66, 0.6), (0.82, 0.82), (1, 0.9)].map(CGPoint.init)
}

private extension CGPoint { init(_ t: (CGFloat, CGFloat)) { self.init(x: t.0, y: t.1) } }

// Hero sparkline (line only).
struct Sparkline: View {
    let points: [CGPoint]
    let color: Color
    var width: CGFloat = 2.2
    var body: some View {
        LineChart(points: points)
            .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
    }
}

// Detail area chart: gold-tinted fill + up/down colored line.
struct AreaChart: View {
    let up: Bool
    let theme: Theme
    var body: some View {
        let pts = up ? Series.up : Series.down
        ZStack {
            LineChart(points: pts, closed: true).fill(theme.gold.opacity(0.14))
            LineChart(points: pts).stroke(up ? theme.up : theme.down,
                                          style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
        }
    }
}
