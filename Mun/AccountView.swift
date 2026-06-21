import SwiftUI

struct AccountView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        let t = store.theme
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack { ScreenTitle(text: "บัญชี", theme: t); Spacer() }
                    .padding(.horizontal, 22).padding(.top, 6)

                profile(t).padding(.horizontal, 16).padding(.top, 14)

                groupLabel("การแสดงผล", t)
                displayCard(t).padding(.horizontal, 16).padding(.top, 9)

                groupLabel("ทั่วไป", t)
                generalCard(t).padding(.horizontal, 16).padding(.top, 9).padding(.bottom, 28)
            }
        }
        .background(t.page)
        .scrollIndicators(.hidden)
    }

    private func profile(_ t: Theme) -> some View {
        HStack(spacing: 15) {
            Text("สญ").font(.system(size: 20, weight: .semibold)).foregroundColor(t.gold)
                .frame(width: 56, height: 56).background(t.goldsoft).clipShape(Circle())
                .overlay(Circle().stroke(t.line, lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text("สมหญิง วัฒนกุล").font(.system(size: 18, weight: .semibold)).foregroundColor(t.ink)
                Text("นักลงทุนระดับทอง · ตั้งแต่ 2563").font(.system(size: 13)).foregroundColor(t.sub)
            }
            Spacer()
        }
        .padding(.init(top: 18, leading: 20, bottom: 18, trailing: 20))
        .background(t.card)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(t.line, lineWidth: 1))
    }

    private func groupLabel(_ text: String, _ t: Theme) -> some View {
        Text(text).font(.system(size: 12.5, weight: .semibold)).foregroundColor(t.sub)
            .padding(.horizontal, 22).padding(.top, 18)
    }

    private func displayCard(_ t: Theme) -> some View {
        rowCard(t) {
            settingRow(icon: "moon.fill", label: "โหมดมืด", t: t) {
                Toggle("", isOn: $store.dark).labelsHidden().tint(t.gold)
            }
            Divider().background(t.line)
            settingRow(icon: "dollarsign.circle", label: "สกุลเงินหลัก", t: t) {
                CurrencySegment(wide: true)
            }
        }
    }

    private func generalCard(_ t: Theme) -> some View {
        rowCard(t) {
            settingRow(icon: "bell.fill", label: "การแจ้งเตือนราคา", t: t) {
                Toggle("", isOn: $store.notif).labelsHidden().tint(t.gold)
            }
            Divider().background(t.line)
            settingRow(icon: "shield.fill", label: "ความปลอดภัย", t: t) {
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundColor(t.faint)
            }
            Divider().background(t.line)
            HStack(spacing: 14) {
                Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 18)).foregroundColor(t.down)
                    .frame(width: 22)
                Text("ออกจากระบบ").font(.system(size: 15)).foregroundColor(t.down)
                Spacer()
            }.padding(.vertical, 15)
        }
    }

    private func rowCard<Content: View>(_ t: Theme, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) { content() }
            .padding(.horizontal, 18)
            .background(t.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(t.line, lineWidth: 1))
    }

    private func settingRow<Trailing: View>(icon: String, label: String, t: Theme, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 17)).foregroundColor(t.gold).frame(width: 22)
            Text(label).font(.system(size: 15)).foregroundColor(t.ink)
            Spacer()
            trailing()
        }.padding(.vertical, 15)
    }
}
