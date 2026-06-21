import SwiftUI

struct OverviewView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        let t = store.theme
        ScrollView {
            VStack(spacing: 0) {
                header(t)
                heroCard(t).padding(.horizontal, 16).padding(.top, 12)
                allocation(t).padding(.horizontal, 16).padding(.top, 18)
                holdings(t).padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 28)
            }
        }
        .background(t.page)
        .scrollIndicators(.hidden)
    }

    private func header(_ t: Theme) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("สวัสดีตอนเช้า").font(.system(size: 13)).foregroundColor(t.sub)
                Text("สมหญิง วัฒนกุล").font(.system(size: 19, weight: .semibold)).foregroundColor(t.ink)
            }
            Spacer()
            Text("สญ")
                .font(.system(size: 15, weight: .semibold)).foregroundColor(t.gold)
                .frame(width: 42, height: 42).background(t.goldsoft).clipShape(Circle())
                .overlay(Circle().stroke(t.line, lineWidth: 1))
                .onTapGesture { store.tab = 4 }
        }
        .padding(.horizontal, 22).padding(.top, 6)
    }

    private func heroCard(_ t: Theme) -> some View {
        let up = store.dayAbsUsd >= 0
        let dayStr = (up ? "▲ " : "▼ ") + store.val(abs(store.dayAbsUsd)) + " · " + store.pctStr(store.dayPct)
        return Card(theme: t, radius: 24, padding: 22) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("มูลค่าพอร์ตรวม").font(.system(size: 13)).foregroundColor(t.sub)
                    Spacer()
                    CurrencySegment()
                }
                Text(store.val(store.totalUsd)).font(mono(42)).foregroundColor(t.ink)
                    .tracking(-0.5).padding(.top, 8)
                Text(store.altVal(store.totalUsd)).font(.system(size: 14)).foregroundColor(t.sub).padding(.top, 3)
                HStack(spacing: 9) {
                    ChangePill(text: dayStr, up: up, theme: t)
                    Text("วันนี้").font(.system(size: 12.5)).foregroundColor(t.sub)
                }.padding(.top, 14)
                Sparkline(points: Series.up, color: t.up).frame(height: 62).padding(.top, 14)
                RangeChips().padding(.top, 14)
            }
        }
    }

    private func allocation(_ t: Theme) -> some View {
        let alloc = store.alloc
        return VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "สัดส่วนการลงทุน", trailing: "ปรับสมดุล", theme: t).padding(.bottom, 11)
            GeometryReader { geo in
                HStack(spacing: 2) {
                    ForEach(alloc) { s in
                        Rectangle().fill(s.color)
                            .frame(width: max(0, geo.size.width * CGFloat(s.pct) / 100 - 2))
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 11)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 18), GridItem(.flexible())], spacing: 9) {
                ForEach(alloc) { s in
                    HStack(spacing: 7) {
                        RoundedRectangle(cornerRadius: 2).fill(s.color).frame(width: 8, height: 8)
                        Text(s.label).font(.system(size: 12.5)).foregroundColor(t.sub)
                        Spacer()
                        Text("\(s.pct)%").font(.system(size: 12.5, weight: .semibold)).foregroundColor(t.ink)
                    }
                }
            }.padding(.top, 13)
        }
    }

    private func holdings(_ t: Theme) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "การถือครอง", trailing: "ดูทั้งหมด", theme: t) { store.tab = 1 }.padding(.bottom, 9)
            VStack(spacing: 0) {
                ForEach(Array(store.holdingList.enumerated()), id: \.element) { i, sym in
                    let s = store.data[sym]!
                    NavigationLink(value: sym) { holdingRow(s, t) }
                        .buttonStyle(.plain)
                    if i < store.holdingList.count - 1 { Divider().background(t.line) }
                }
            }
            .padding(.horizontal, 16)
            .background(t.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
        }
    }

    private func holdingRow(_ s: Instrument, _ t: Theme) -> some View {
        let up = s.dayPct >= 0
        return HStack(spacing: 13) {
            LogoChip(text: s.logo, theme: t)
            VStack(alignment: .leading, spacing: 1) {
                Text(s.name).font(.system(size: 15, weight: .semibold)).foregroundColor(t.ink)
                Text("\(s.sym) · \(store.qtyLabel(s))").font(.system(size: 12.5)).foregroundColor(t.sub)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(store.val(s.shares * s.price)).font(.system(size: 15, weight: .semibold)).foregroundColor(t.ink)
                Text(store.pctStr(s.dayPct)).font(.system(size: 12.5, weight: .semibold)).foregroundColor(up ? t.up : t.down)
            }
        }
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}
