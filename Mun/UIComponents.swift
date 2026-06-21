import SwiftUI

struct LogoChip: View {
    let text: String
    let theme: Theme
    var size: CGFloat = 40
    var body: some View {
        Text(text)
            .font(.system(size: size * 0.35, weight: .bold))
            .foregroundColor(theme.gold)
            .frame(width: size, height: size)
            .background(theme.goldsoft)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
    }
}

// Card surface.
struct Card<Content: View>: View {
    let theme: Theme
    var radius: CGFloat = 20
    var padding: CGFloat = 16
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(padding)
            .background(theme.card)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(theme.line, lineWidth: 1))
    }
}

// ▲/▼ change pill.
struct ChangePill: View {
    let text: String
    let up: Bool
    let theme: Theme
    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(up ? theme.up : theme.down)
            .padding(.horizontal, 11).padding(.vertical, 5)
            .background((up ? theme.up : theme.down).opacity(0.16))
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}

// ฿ / $ segmented control (compact = hero pill, wide = account).
struct CurrencySegment: View {
    @EnvironmentObject var store: Store
    var wide = false
    var body: some View {
        let t = store.theme
        HStack(spacing: 4) {
            seg(label: wide ? "฿ THB" : "฿", active: store.cur == "thb") { store.cur = "thb" }
            seg(label: wide ? "$ USD" : "$", active: store.cur == "usd") { store.cur = "usd" }
        }
        .padding(3)
        .background(t.card2)
        .clipShape(RoundedRectangle(cornerRadius: wide ? 9 : 8, style: .continuous))
    }
    private func seg(label: String, active: Bool, _ tap: @escaping () -> Void) -> some View {
        let t = store.theme
        return Text(label)
            .font(.system(size: wide ? 13 : 11, weight: .semibold))
            .foregroundColor(active ? t.ongold : t.sub)
            .padding(.horizontal, wide ? 12 : 9).padding(.vertical, 4)
            .background(active ? t.gold : .clear)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .contentShape(Rectangle())
            .onTapGesture(perform: tap)
    }
}

// Time-range chips.
struct RangeChips: View {
    @EnvironmentObject var store: Store
    var fill = false   // detail = evenly filled; overview = fixed width
    private let defs: [(String, String)] = [("1d", "1ว"), ("1w", "1สั"), ("1m", "1ด"), ("3m", "3ด"), ("1y", "1ป"), ("all", "ทั้งหมด")]
    var body: some View {
        let t = store.theme
        HStack(spacing: 6) {
            ForEach(Array(defs.enumerated()), id: \.offset) { _, d in
                let k = d.0, label = d.1
                let on = store.range == k
                Text(label)
                    .font(.system(size: 12, weight: on ? .semibold : .regular))
                    .foregroundColor(on ? t.gold : t.sub)
                    .frame(maxWidth: fill ? .infinity : 38)
                    .padding(.vertical, 5)
                    .background(on ? t.goldsoft : .clear)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .contentShape(Rectangle())
                    .onTapGesture { store.range = k }
            }
        }
    }
}

// Filter chip (watchlist / transactions).
struct FilterChip: View {
    let label: String
    let active: Bool
    let theme: Theme
    let tap: () -> Void
    var body: some View {
        Text(label)
            .font(.system(size: 13, weight: active ? .semibold : .regular))
            .foregroundColor(active ? theme.ongold : theme.sub)
            .padding(.horizontal, 15).padding(.vertical, 8)
            .background(active ? theme.gold : theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(active ? theme.gold : theme.line, lineWidth: 1))
            .contentShape(Rectangle())
            .onTapGesture(perform: tap)
    }
}

// Section header used across screens.
struct SectionHeader: View {
    let title: String
    var trailing: String? = nil
    let theme: Theme
    var trailingTap: (() -> Void)? = nil
    var body: some View {
        HStack {
            Text(title).font(.system(size: 14, weight: .semibold)).foregroundColor(theme.ink)
            Spacer()
            if let trailing {
                Text(trailing).font(.system(size: 12.5, weight: .semibold)).foregroundColor(theme.gold)
                    .contentShape(Rectangle()).onTapGesture { trailingTap?() }
            }
        }
    }
}

// Big screen title.
struct ScreenTitle: View {
    let text: String
    let theme: Theme
    var body: some View {
        Text(text).font(.system(size: 26, weight: .bold)).foregroundColor(theme.ink)
    }
}
