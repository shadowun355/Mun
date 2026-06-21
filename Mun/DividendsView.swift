import SwiftUI

struct DividendsView: View {
    @EnvironmentObject var store: Store
    // Static showcase data (the prototype's Dividends screen is static).
    private let months: [(String, CGFloat, Bool)] = [
        ("ม.ค.", 34, false), ("ก.พ.", 52, false), ("มี.ค.", 26, false),
        ("เม.ย.", 64, true), ("พ.ค.", 30, false), ("มิ.ย.", 46, false)
    ]
    private let upcoming: [(String, String, String, String, String)] = [
        ("PT", "ปตท.", "XD 25 มิ.ย. · ฿2.00/หุ้น", "+฿2,400", "2 ก.ค."),
        ("KB", "กสิกรไทย", "XD 28 มิ.ย. · ฿3.25/หุ้น", "+฿1,625", "8 ก.ค."),
        ("AA", "Apple", "XD 10 ก.ค. · $0.25/หุ้น", "+$6.25", "17 ก.ค.")
    ]

    var body: some View {
        let t = store.theme
        ScrollView {
            VStack(spacing: 0) {
                HStack { ScreenTitle(text: "เงินปันผล", theme: t); Spacer() }
                    .padding(.horizontal, 22).padding(.top, 6)

                summary(t).padding(.horizontal, 16).padding(.top, 12)
                chart(t).padding(.horizontal, 16).padding(.top, 18)
                upcomingList(t).padding(.horizontal, 16).padding(.top, 18).padding(.bottom, 28)
            }
        }
        .background(t.page)
        .scrollIndicators(.hidden)
    }

    private func summary(_ t: Theme) -> some View {
        Card(theme: t, radius: 24, padding: 22) {
            VStack(alignment: .leading, spacing: 0) {
                Text("รับแล้วในปีนี้").font(.system(size: 13)).foregroundColor(t.sub)
                Text("฿18,420").font(mono(38)).foregroundColor(t.ink).tracking(-0.5).padding(.top, 6)
                Divider().background(t.line).padding(.top, 16)
                HStack(spacing: 24) {
                    stat("คาดทั้งปี", "฿32,000", t.ink, t)
                    stat("อัตราผลตอบแทน", "3.20%", t.gold, t)
                    stat("รับ/เดือน", "฿1,535", t.ink, t)
                }.padding(.top, 16)
            }
        }
    }

    private func stat(_ label: String, _ value: String, _ color: Color, _ t: Theme) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.system(size: 12)).foregroundColor(t.sub)
            Text(value).font(.system(size: 16, weight: .semibold)).foregroundColor(color)
        }
    }

    private func chart(_ t: Theme) -> some View {
        Card(theme: t, padding: 18) {
            VStack(alignment: .leading, spacing: 16) {
                Text("ปันผลรายเดือน").font(.system(size: 14, weight: .semibold)).foregroundColor(t.ink)
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(months.enumerated()), id: \.offset) { _, m in
                        VStack(spacing: 7) {
                            RoundedRectangle(cornerRadius: 5).fill(m.2 ? t.gold : t.goldsoft)
                                .frame(height: m.1)
                            Text(m.0).font(.system(size: 10.5, weight: m.2 ? .semibold : .regular))
                                .foregroundColor(m.2 ? t.gold : t.sub)
                        }.frame(maxWidth: .infinity)
                    }
                }.frame(height: 88, alignment: .bottom)
            }
        }
    }

    private func upcomingList(_ t: Theme) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("จ่ายเร็ว ๆ นี้").font(.system(size: 14, weight: .semibold)).foregroundColor(t.ink).padding(.bottom, 9)
            VStack(spacing: 0) {
                ForEach(Array(upcoming.enumerated()), id: \.offset) { i, d in
                    HStack(spacing: 13) {
                        LogoChip(text: d.0, theme: t)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(d.1).font(.system(size: 15, weight: .semibold)).foregroundColor(t.ink)
                            Text(d.2).font(.system(size: 12.5)).foregroundColor(t.sub)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(d.3).font(.system(size: 15, weight: .semibold)).foregroundColor(t.up)
                            Text(d.4).font(.system(size: 12)).foregroundColor(t.sub)
                        }
                    }.padding(.vertical, 13)
                    if i < upcoming.count - 1 { Divider().background(t.line) }
                }
            }
            .padding(.horizontal, 16)
            .background(t.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
        }
    }
}
