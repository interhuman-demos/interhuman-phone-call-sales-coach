import SwiftUI

@main
struct SalesCoachApp: App {
    @StateObject private var vm = CallViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(vm)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var vm: CallViewModel

    var body: some View {
        Group {
            switch vm.status {
            case .idle:
                HomeView()
            case .connecting, .live:
                LiveCallView()
            case .ended:
                DebriefView()
            }
        }
        .task { await vm.loadPersonas() }
    }
}
