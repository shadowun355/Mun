import SwiftUI

extension Color {
    init(hex: String) {
        let s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        let v = UInt64(s, radix: 16) ?? 0
        self.init(.sRGB,
                  red: Double((v >> 16) & 0xff) / 255,
                  green: Double((v >> 8) & 0xff) / 255,
                  blue: Double(v & 0xff) / 255,
                  opacity: 1)
    }
}

// Exact tokens from the design handoff. Two palettes, toggled by Store.dark.
struct Theme {
    let page, card, card2, ink, sub, faint, line: Color
    let gold, goldsoft, up, down, ongold: Color
    let csage, cblue, cclay: Color

    static let light = Theme(
        page: Color(hex: "f4f1ea"), card: Color(hex: "fffdf8"), card2: Color(hex: "f6f2e9"),
        ink: Color(hex: "2a2723"), sub: Color(hex: "8f897e"), faint: Color(hex: "b8b2a6"),
        line: Color(hex: "e8e2d5"), gold: Color(hex: "a8854a"), goldsoft: Color(hex: "efe6d2"),
        up: Color(hex: "4f8a6b"), down: Color(hex: "c0664f"), ongold: Color(hex: "fffdf8"),
        csage: Color(hex: "7d9b6f"), cblue: Color(hex: "6f8aa8"), cclay: Color(hex: "bfa07f"))

    static let dark = Theme(
        page: Color(hex: "161410"), card: Color(hex: "211d17"), card2: Color(hex: "1b1813"),
        ink: Color(hex: "f1ece0"), sub: Color(hex: "a39c8d"), faint: Color(hex: "6f6a5e"),
        line: Color(hex: "322d24"), gold: Color(hex: "cba35f"), goldsoft: Color(hex: "2b2519"),
        up: Color(hex: "74b08c"), down: Color(hex: "d98a70"), ongold: Color(hex: "161410"),
        csage: Color(hex: "8aab7c"), cblue: Color(hex: "7d99b8"), cclay: Color(hex: "c9ab88"))
}

// Tinted background for up/down pills (approximates the prototype's color-mix 16%).
extension Color { func tint16() -> Color { self.opacity(0.16) } }

// ponytail: serif system font ~ Newsreader for monetary figures. Bundle Anuphan/Newsreader
// .ttf in the project and switch to .custom() when you want pixel-exact type.
func mono(_ size: CGFloat) -> Font { .system(size: size, weight: .medium, design: .serif) }
