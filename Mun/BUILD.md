# Mun (มั่น) — native iOS app

SwiftUI port of the design handoff. Faithful to the luxury-matte tokens, Thai copy,
dual currency (฿/$), light/dark, and the buy/sell order ticket.

## Run
1. Install **Xcode 16+** (full Xcode, not just Command Line Tools) from the App Store.
2. Open `Mun.xcodeproj`.
3. Pick an iPhone simulator (or your device) → **⌘R**.

The project uses a *file-system synchronized group*, so every `.swift` you add under
`Mun/` is compiled automatically — no need to register files in Xcode.

## Ship to the App Store
1. Xcode → target **Mun** → Signing & Capabilities → set your **Team** (CODE_SIGN_STYLE is Automatic).
2. Change `PRODUCT_BUNDLE_IDENTIFIER` (`com.mun.app`) to one you own in App Store Connect.
3. Add an app icon: create `Mun/Assets.xcassets` → `AppIcon` and drop a 1024px icon in.
4. Select **Any iOS Device** → Product → **Archive** → Distribute App → App Store Connect.

## What's mock vs real
- Prices, holdings, OHLC, dividends and the SET/S&P/BTC index cards are mock data in `Store.swift`.
  `RATE = 36.4` is a fixed FX rate. Charts use canned up/down series in `Charts.swift`.
- To make it real: replace `Store.data` + `RATE` with a market-data/FX API, persist
  `starred`/`extraTxns`/`notif`/`dark`/`cur`, and wire the order ticket to a brokerage.

## Files
`MunApp` entry · `RootView` tabs+sheet+toast · `Store` state/data/formatters ·
`Theme` color tokens · `Models` types · `*View` the 6 screens + detail ·
`OrderTicketView` buy/sell sheet · `Charts`/`UIComponents` shared pieces.
