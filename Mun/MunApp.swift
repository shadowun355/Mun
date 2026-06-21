import SwiftUI

@main
struct MunApp: App {
    @StateObject private var store = Store()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
        }
    }
}
