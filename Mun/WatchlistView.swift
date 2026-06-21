import SwiftUI

struct WatchlistView: View {
    @EnvironmentObject var store: Store
    private let filters: [(String, String)] = [("all", "ทั้งหมด"), ("thai", "หุ้นไทย"), ("foreign", "ต่างประเทศ"), ("crypto", "คริปโต")]
    private let indices: [(String, String, Bool, String)] = [
        ("SET", "1,308.22", false, "−0.32%"),
        ("S&P 500", "5,521.4", true, "+0.41%"),
        ("BTC", "฿2.48M", false, "−2.10%")
    ]

    var body: some View {
        let t = store.theme
        ScrollView {
            VStack(spacing: 0) {
                HStack {
                    ScreenTitle(text: "เฝ้าดู", theme: t)
                    Spacer()
                    Image(systemName: "plus").font(.system(size: 18, weight: .semibold)).foregroundColor(t.gold)
                        .frame(width: 38, height: 38).background(t.goldsoft).clipShape(Circle())
                }.padding(.horizontal, 22).padding(.top, 6)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        ForEach(Array(filters.enumerated()), id: \.offset) { _, f in
                            FilterChip(label: f.1, active: store.watchFilter == f.0, theme: t) { store.watchFilter = f.0 }
                        }
                    }.padding(.horizontal, 18)
                }.padding(.top, 12)

                HStack(spacing: 11) {
                    ForEach(Array(indices.enumerated()), id: \.offset) { _, d in indexCard(d, t) }
                }.padding(.horizontal, 18).padding(.top, 16)

                VStack(spacing: 0) {
                    let rows = store.watchRows
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, s in
                        NavigationLink(value: s.sym) { watchRow(s, t) }.buttonStyle(.plain)
                        if i < rows.count - 1 { Divider().background(t.line) }
                    }
                }
                .padding(.horizontal, 16)
                .background(t.card)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
                .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 28)
            }
        }
        .background(t.page)
        .scrollIndicators(.hidden)
    }

    private func indexCard(_ d: (String, String, Bool, String), _ t: Theme) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(d.0).font(.system(size: 12, weight: .semibold)).foregroundColor(t.sub)
            Text(d.1).font(.system(size: 15, weight: .bold)).foregroundColor(t.ink).padding(.top, 3)
            Sparkline(points: d.2 ? Series.up : Series.down, color: d.2 ? t.up : t.down, width: 1.8)
                .frame(height: 20).padding(.vertical, 5)
            Text(d.3).font(.system(size: 12, weight: .semibold)).foregroundColor(d.2 ? t.up : t.down)
        }
        .padding(.init(top: 13, leading: 13, bottom: 11, trailing: 13))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(t.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(t.line, lineWidth: 1))
    }

    private func watchRow(_ s: Instrument, _ t: Theme) -> some View {
        let up = s.dayPct >= 0
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(s.sym).font(.system(size: 15, weight: .semibold)).foregroundColor(t.ink)
                Text(s.name2).font(.system(size: 12)).foregroundColor(t.sub)
            }
            Spacer()
            Sparkline(points: up ? Series.up : Series.down, color: up ? t.up : t.down, width: 1.8)
                .frame(width: 56, height: 24)
            VStack(alignment: .trailing, spacing: 1) {
                Text(store.price(s.price)).font(.system(size: 14.5, weight: .semibold)).foregroundColor(t.ink)
                Text(store.pctStr(s.dayPct)).font(.system(size: 12, weight: .semibold)).foregroundColor(up ? t.up : t.down)
            }.frame(minWidth: 74, alignment: .trailing)
        }
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}
