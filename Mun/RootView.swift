import SwiftUI

struct RootView: View {
    @EnvironmentObject var store: Store

    var body: some View {
        let t = store.theme
        ZStack(alignment: .bottom) {
            TabView(selection: $store.tab) {
                tab(OverviewView(), 0, "ภาพรวม", "square.grid.2x2.fill")
                tab(WatchlistView(), 1, "เฝ้าดู", "bookmark.fill")
                tab(DividendsView(), 2, "ปันผล", "dollarsign.circle.fill")
                tab(TransactionsView(), 3, "รายการ", "list.bullet")
                tab(AccountView(), 4, "บัญชี", "person.fill")
            }
            .tint(t.gold)

            if let toast = store.toast {
                Text(toast)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(t.page)
                    .padding(.horizontal, 20).padding(.vertical, 11)
                    .background(t.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .shadow(color: .black.opacity(0.4), radius: 14, y: 8)
                    .padding(.bottom, 96)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.25), value: store.toast)
        .task { await store.refresh() }
        .preferredColorScheme(store.dark ? .dark : .light)
        .sheet(isPresented: ticketPresented) {
            if store.ticket != nil { OrderTicketView(ticket: Binding($store.ticket)!) }
        }
    }

    private func tab<V: View>(_ view: V, _ tag: Int, _ label: String, _ icon: String) -> some View {
        let t = store.theme
        return NavigationStack {
            view.navigationDestination(for: String.self) { DetailView(sym: $0) }
                .toolbarBackground(t.card, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
        }
        .tabItem { Label(label, systemImage: icon) }
        .tag(tag)
    }

    private var ticketPresented: Binding<Bool> {
        Binding(get: { store.ticket != nil }, set: { if !$0 { store.ticket = nil } })
    }
}

#Preview {
    RootView().environmentObject(Store())
}
