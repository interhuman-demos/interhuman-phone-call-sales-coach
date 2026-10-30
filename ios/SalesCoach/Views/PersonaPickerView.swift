import SwiftUI

/// Home — the buyer list, mock 2a/2b. Large "Practice" title, search field,
/// one grouped rounded-list card of scenario rows, a "+" that opens the New
/// Call sheet, and a visual-only bottom tab bar (Practice is the only tab
/// that's live today; the rest are marked Coming Soon).
struct HomeView: View {
    @EnvironmentObject private var vm: CallViewModel

    @State private var query = ""
    @State private var comingSoonTab: String?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Color.bg.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Practice your next pitch, one buyer at a time.")
                            .font(.subheadline)
                            .foregroundStyle(Color.dim)
                            .padding(.horizontal, 4)

                        searchField

                        if let error = vm.startupError {
                            Text(error).foregroundStyle(Color.bad).font(.footnote)
                        }

                        if filtered.isEmpty {
                            emptyState
                        } else {
                            listCard
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                    .padding(.bottom, 96) // clear the tab bar
                }

                tabBar
            }
            .navigationTitle("Practice")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { vm.scenarioFormOpen = true } label: {
                        Image(systemName: "plus")
                            .font(.body.weight(.semibold))
                    }
                    .accessibilityLabel("New Call")
                }
            }
            .sheet(isPresented: $vm.scenarioFormOpen) { ScenarioFormView() }
            .navigationDestination(for: Persona.self) { persona in
                BriefView(persona: persona)
            }
        }
        .tint(.accent)
        .alert(
            "Coming soon",
            isPresented: Binding(get: { comingSoonTab != nil }, set: { if !$0 { comingSoonTab = nil } }),
            presenting: comingSoonTab
        ) { _ in
            Button("Got it", role: .cancel) {}
        } message: { tab in
            Text("\(tab) is on the way — it isn't available in this build yet.")
        }
    }

    // MARK: - filtered data

    private var filtered: [Persona] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return vm.personas }
        return vm.personas.filter {
            $0.name.lowercased().contains(q) || $0.title.lowercased().contains(q)
                || $0.company.lowercased().contains(q) || $0.industry.lowercased().contains(q)
        }
    }

    // MARK: - pieces

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(Color.ter)
            TextField("Search buyers", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Color.ter)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 12))
    }

    private var listCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(filtered.enumerated()), id: \.element.id) { index, persona in
                NavigationLink(value: persona) {
                    PersonaRow(persona: persona, entry: vm.practice.entry(for: persona.id))
                }
                .buttonStyle(.plain)

                if index < filtered.count - 1 {
                    Divider().padding(.leading, 68) // inset past the avatar
                }
            }
        }
        .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 26))
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.largeTitle)
                .foregroundStyle(Color.ter)
            Text("No buyers match.")
                .font(.footnote)
                .foregroundStyle(Color.dim)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    private var tabBar: some View {
        HStack {
            tabItem("Practice", "phone.fill", active: true, comingSoon: false)
            tabItem("History", "clock", active: false, comingSoon: true)
            tabItem("Insights", "chart.bar", active: false, comingSoon: true)
            tabItem("Settings", "gearshape", active: false, comingSoon: true)
        }
        .padding(.top, 10)
        .padding(.bottom, 4)
        .background(.bar)
    }

    private func tabItem(_ label: String, _ icon: String, active: Bool, comingSoon: Bool) -> some View {
        Button {
            if comingSoon { comingSoonTab = label }
        } label: {
            VStack(spacing: 3) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon).font(.system(size: 20))
                    if comingSoon {
                        Circle()
                            .fill(Color.accent)
                            .frame(width: 6, height: 6)
                            .offset(x: 7, y: -3)
                    }
                }
                Text(label).font(.system(size: 10))
                if comingSoon {
                    Text("SOON")
                        .font(.system(size: 8, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Color.accent)
                }
            }
            .foregroundStyle(active ? Color.accent : Color.ter)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

/// One scenario row: monogram avatar, name, subtitle, trailing score + chevron.
struct PersonaRow: View {
    let persona: Persona
    let entry: PracticeHistoryStore.Entry?

    var body: some View {
        HStack(spacing: 12) {
            PersonaAvatar(persona: persona, size: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(persona.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(Color.dim)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            if let entry {
                Text("\(entry.score)")
                    .font(.system(.body, design: .monospaced).weight(.semibold))
                    .foregroundStyle(healthColor(entry.score))
            }
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.ter)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(minHeight: 52)
        .contentShape(Rectangle())
    }

    private var subtitle: String {
        let product = persona.title
        if let entry {
            return "\(product) · \(PracticeHistoryStore.relative(entry.date))"
        }
        return "\(product) · not yet practiced"
    }
}

/// Tinted monogram circle standing in for a buyer photo — mirrors avatar.ts.
struct Monogram: View {
    let name: String
    var size: CGFloat = 44

    var body: some View {
        Circle()
            .fill(Color.accent.opacity(0.16))
            .frame(width: size, height: size)
            .overlay(
                Text(initials(name))
                    .font(.system(size: size * 0.36, weight: .semibold))
                    .foregroundStyle(Color.accent))
    }
}
