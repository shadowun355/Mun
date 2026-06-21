import SwiftUI

struct TransactionsView: View {
    @EnvironmentObject var store: Store
    private let filters: [(String, String)] = [("all", "ทั้งหมด"), ("buy", "ซื้อ"), ("sell", "ขาย"), ("dividend", "ปันผล")]

    var body: some View {
        let t = store.theme
        ScrollView {
            VStack(spacing: 0) {
                HStack {
                    ScreenTitle(text: "รายการซื้อขาย", theme: t)
                    Spacer()
                    Image(systemName: "line.3.horizontal.decrease").font(.system(size: 16, weight: .semibold))
                        .foregroundColor(t.gold)
                        .frame(width: 38, height: 38).background(t.goldsoft).clipShape(Circle())
                }.padding(.horizontal, 22).padding(.top, 6)

                HStack(spacing: 7) {
                    ForEach(Array(filters.enumerated()), id: \.offset) { _, f in
                        FilterChip(label: f.1, active: store.txnFilter == f.0, theme: t) { store.txnFilter = f.0 }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 18).padding(.top, 12)

                ForEach(store.txnGroups) { group in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(group.date).font(.system(size: 12.5, weight: .semibold)).foregroundColor(t.sub)
                            .padding(.horizontal, 22).padding(.top, 18).padding(.bottom, 8)
                        VStack(spacing: 0) {
                            ForEach(Array(group.items.enumerated()), id: \.element.id) { i, item in
                                txnRow(item, t)
                                if i < group.items.count - 1 { Divider().background(t.line) }
                            }
                        }
                        .padding(.horizontal, 16)
                        .background(t.card)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
                        .padding(.horizontal, 16)
                    }
                }
                Color.clear.frame(height: 28)
            }
        }
        .background(t.page)
        .scrollIndicators(.hidden)
    }

    private func txnRow(_ item: Txn, _ t: Theme) -> some View {
        let style = iconStyle(item.type, t)
        let amtColor = item.type == "dividend" ? t.up : t.ink
        return HStack(spacing: 13) {
            Image(systemName: style.symbol).font(.system(size: 17, weight: .semibold)).foregroundColor(style.stroke)
                .frame(width: 40, height: 40).background(style.bg)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title).font(.system(size: 15, weight: .semibold)).foregroundColor(t.ink)
                Text(item.sub).font(.system(size: 12.5)).foregroundColor(t.sub)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(item.amt).font(.system(size: 15, weight: .semibold)).foregroundColor(amtColor)
                Text(item.time).font(.system(size: 12)).foregroundColor(t.sub)
            }
        }.padding(.vertical, 13)
    }

    private func iconStyle(_ type: String, _ t: Theme) -> (symbol: String, stroke: Color, bg: Color) {
        switch type {
        case "buy": return ("arrow.down", t.up, t.up.opacity(0.16))
        case "sell": return ("arrow.up", t.down, t.down.opacity(0.16))
        default: return ("dollarsign.circle", t.gold, t.goldsoft)
        }
    }
}
