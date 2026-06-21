import SwiftUI

struct DetailView: View {
    @EnvironmentObject var store: Store
    let sym: String

    var body: some View {
        let t = store.theme
        let s = store.data[sym]!
        let up = s.dayPct >= 0
        let gainUsd = (s.price - s.avg) * s.shares
        let gainPct = s.avg == 0 ? 0 : (s.price / s.avg - 1) * 100

        ScrollView {
            VStack(spacing: 0) {
                priceBlock(s, up, t)
                chart(up, t).padding(.top, 18)
                statsGrid(s, t).padding(.horizontal, 16).padding(.top, 18)
                position(s, gainUsd, gainPct, t).padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 28)
            }
        }
        .background(t.page)
        .scrollIndicators(.hidden)
        .navigationBarBackButtonHidden(false)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(s.sym).font(.system(size: 16, weight: .bold)).foregroundColor(t.ink).tracking(0.5)
                    Text(s.name2).font(.system(size: 11.5)).foregroundColor(t.sub)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { store.toggleStar(sym) } label: {
                    Image(systemName: store.starred.contains(sym) ? "star.fill" : "star")
                        .foregroundColor(t.gold)
                }
            }
        }
        .toolbarBackground(t.page, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .bottom) { actionBar(t) }
        .tint(t.ink)
    }

    private func priceBlock(_ s: Instrument, _ up: Bool, _ t: Theme) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(s.exch) · \(s.native == "usd" ? "ดอลลาร์สหรัฐ" : "บาท")")
                .font(.system(size: 12.5)).foregroundColor(t.sub)
            Text(store.price(s.price)).font(mono(44)).foregroundColor(t.ink).tracking(-0.5).padding(.top, 4)
            HStack(spacing: 10) {
                ChangePill(text: (up ? "▲ " : "▼ ") + store.pctStr(s.dayPct), up: up, theme: t)
                Text(store.altVal(s.price)).font(.system(size: 13)).foregroundColor(t.sub)
            }.padding(.top, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24).padding(.top, 14)
    }

    private func chart(_ up: Bool, _ t: Theme) -> some View {
        VStack(spacing: 10) {
            AreaChart(up: up, theme: t).frame(height: 148)
            RangeChips(fill: true).padding(.horizontal, 6)
        }.padding(.horizontal, 16)
    }

    private func statsGrid(_ s: Instrument, _ t: Theme) -> some View {
        let cells: [(String, String)] = [
            ("เปิด", store.price(s.open)), ("สูงสุด", store.price(s.high)), ("ต่ำสุด", store.price(s.low)),
            ("มูลค่าตลาด", s.mcap), ("ปริมาณ", s.vol), ("P/E", s.pe)
        ]
        return Card(theme: t, padding: 18) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3), spacing: 18) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, c in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(c.0).font(.system(size: 11.5)).foregroundColor(t.sub)
                        Text(c.1).font(.system(size: 15, weight: .semibold)).foregroundColor(t.ink)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func position(_ s: Instrument, _ gainUsd: Double, _ gainPct: Double, _ t: Theme) -> some View {
        if s.shares > 0 {
            VStack(alignment: .leading, spacing: 0) {
                Text("การถือครองของคุณ").font(.system(size: 13, weight: .semibold)).foregroundColor(t.ink).padding(.bottom, 12)
                posRow("จำนวน", store.qtyLabel(s) + " · " + store.val(s.shares * s.price), t.ink, t)
                posRow("ต้นทุนเฉลี่ย", store.price(s.avg), t.ink, t)
                posRow("กำไรที่ยังไม่รับรู้",
                       (gainUsd >= 0 ? "+" : "−") + store.val(abs(gainUsd)) + " · " + store.pctStr(gainPct),
                       gainUsd >= 0 ? t.up : t.down, t, last: true)
            }
            .padding(.init(top: 16, leading: 18, bottom: 16, trailing: 18))
            .background(t.card2)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
        } else {
            VStack(spacing: 4) {
                Text("คุณยังไม่ได้ถือครอง \(s.sym)").font(.system(size: 13.5)).foregroundColor(t.sub)
                Text("แตะ “ซื้อ” เพื่อเริ่มลงทุน").font(.system(size: 12.5)).foregroundColor(t.faint)
            }
            .frame(maxWidth: .infinity).padding(18)
            .background(t.card2)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
        }
    }

    private func posRow(_ label: String, _ value: String, _ color: Color, _ t: Theme, last: Bool = false) -> some View {
        HStack {
            Text(label).font(.system(size: 13)).foregroundColor(t.sub)
            Spacer()
            Text(value).font(.system(size: 13.5, weight: .semibold)).foregroundColor(color)
        }.padding(.bottom, last ? 0 : 9)
    }

    private func actionBar(_ t: Theme) -> some View {
        HStack(spacing: 12) {
            Button { store.ticket = Ticket(mode: "sell", sym: sym, qty: 1) } label: {
                Text("ขาย").font(.system(size: 16, weight: .semibold)).foregroundColor(t.down)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(t.down, lineWidth: 1.5))
            }
            Button { store.ticket = Ticket(mode: "buy", sym: sym, qty: 1) } label: {
                Text("ซื้อ").font(.system(size: 16, weight: .semibold)).foregroundColor(t.ongold)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(t.gold)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
        }
        .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 8)
        .background(t.card)
        .overlay(Rectangle().fill(t.line).frame(height: 1), alignment: .top)
    }
}
