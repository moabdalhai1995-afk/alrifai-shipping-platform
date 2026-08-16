import SwiftUI

@main
struct AlRifaiShippingApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewContainer()
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
