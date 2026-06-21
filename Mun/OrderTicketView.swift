import SwiftUI

struct OrderTicketView: View {
    @EnvironmentObject var store: Store
    @Binding var ticket: Ticket

    var body: some View {
        let t = store.theme
        let s = store.data[ticket.sym]!
        let buy = ticket.mode == "buy"
        let up = s.dayPct >= 0
        let step: Double = s.kind == "crypto" ? 0.01 : 1

        VStack(spacing: 0) {
            Capsule().fill(t.line).frame(width: 38, height: 4).padding(.top, 10).padding(.bottom, 16)

            HStack(spacing: 13) {
                LogoChip(text: s.logo, theme: t, size: 44)
                VStack(alignment: .leading, spacing: 1) {
                    Text((buy ? "ซื้อ " : "ขาย ") + s.sym).font(.system(size: 17, weight: .bold)).foregroundColor(t.ink)
                    Text(s.name2).font(.system(size: 12.5)).foregroundColor(t.sub)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text(store.price(s.price)).font(.system(size: 16, weight: .semibold)).foregroundColor(t.ink)
                    Text(store.pctStr(s.dayPct)).font(.system(size: 12, weight: .semibold)).foregroundColor(up ? t.up : t.down)
                }
            }.padding(.bottom, 20)

            HStack {
                Text("จำนวน").font(.system(size: 14)).foregroundColor(t.sub)
                Spacer()
                HStack(spacing: 18) {
                    stepButton("minus", t) { ticket.qty = max(step, ticket.qty - step) }
                    Text(store.nf(ticket.qty, s.kind == "crypto" ? 2 : 0))
                        .font(.system(size: 20, weight: .bold)).foregroundColor(t.ink)
                        .frame(minWidth: 42)
                    stepButton("plus", t) { ticket.qty += step }
                }
            }
            .padding(.init(top: 14, leading: 18, bottom: 14, trailing: 18))
            .background(t.card2)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(t.line, lineWidth: 1))
            .padding(.bottom, 14)

            HStack {
                Text("ยอดรวมโดยประมาณ").font(.system(size: 14)).foregroundColor(t.sub)
                Spacer()
                Text(store.val(ticket.qty * s.price)).font(mono(24)).foregroundColor(t.ink)
            }.padding(.horizontal, 4).padding(.bottom, 18)

            Button { Task { await store.confirmTicket() } } label: {
                Text(store.submitting ? "ส่งคำสั่ง…" : (buy ? "ยืนยันการซื้อ" : "ยืนยันการขาย"))
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(buy ? t.ongold : .white)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background((buy ? t.gold : t.down).opacity(store.submitting ? 0.6 : 1))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .disabled(store.submitting)
        }
        .padding(.horizontal, 22).padding(.bottom, 30)
        .background(t.card)
        .presentationDetents([.height(380)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(28)
    }

    private func stepButton(_ icon: String, _ t: Theme, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Image(systemName: icon).font(.system(size: 15, weight: .bold)).foregroundColor(t.ink)
                .frame(width: 34, height: 34)
                .background(t.card)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(t.line, lineWidth: 1))
        }
    }
}
