import SwiftUI

/// Pre-call brief — shown after picking a buyer from Home and before the
/// phone actually starts ringing. Orients the rep on who they're calling,
/// what they're selling, and how to open, mirroring the scenario data the
/// server hands the AI buyer. "Start Call" is the only way into `LiveCallView`.
struct BriefView: View {
    @EnvironmentObject private var vm: CallViewModel
    @Environment(\.dismiss) private var dismiss
    let persona: Persona

    @State private var starting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                factRow
                groupedCard("The pitch") {
                    Text(persona.scenario.product)
                        .font(.subheadline)
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                groupedCard("Selling points") {
                    bullets(persona.scenario.sellingPoints, color: .accent)
                }

                groupedCard("Quick orientation") {
                    bullets(persona.scenario.context, color: .dim, icon: "info.circle.fill")
                }

                if let opener = persona.scenario.opener, !opener.isEmpty {
                    groupedCard("If you want an opener") {
                        Text("\u{201C}\(opener)\u{201D}")
                            .font(.subheadline.italic())
                            .foregroundStyle(Color.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(20)
            .padding(.bottom, 90) // clear the Start Call bar
        }
        .background(Color.bg.ignoresSafeArea())
        .navigationTitle("Brief")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { startButton }
        .tint(.accent)
    }

    // MARK: - pieces

    private var header: some View {
        VStack(spacing: 10) {
            PersonaAvatar(persona: persona, size: 84)
            VStack(spacing: 4) {
                Text(persona.name)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                Text("\(persona.title) · \(persona.company)")
                    .font(.subheadline)
                    .foregroundStyle(Color.dim)
            }
            if !persona.tagline.isEmpty {
                Text(persona.tagline)
                    .font(.footnote)
                    .foregroundStyle(Color.dim)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var factRow: some View {
        HStack(spacing: 0) {
            factCell(title: "Industry", value: persona.industry)
            Divider().frame(height: 32)
            factCell(title: "Difficulty", value: persona.difficulty.capitalized, color: difficultyColor(persona.difficulty))
            Divider().frame(height: 32)
            factCell(title: "Price", value: persona.scenario.price)
        }
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 20))
    }

    private func factCell(title: String, value: String, color: Color = .textPrimary) -> some View {
        VStack(spacing: 4) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.dim)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)
                .multilineTextAlignment(.center)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }

    private func bullets(_ items: [String], color: Color, icon: String = "checkmark.circle.fill") -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: icon)
                        .font(.footnote)
                        .foregroundStyle(color)
                        .padding(.top, 1)
                    Text(item)
                        .font(.footnote)
                        .foregroundStyle(Color.textPrimary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func groupedCard(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.dim)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 20))
    }

    private var startButton: some View {
        Button {
            guard !starting else { return }
            starting = true
            vm.selectedPersona = persona
            Task { await vm.startCall() }
        } label: {
            HStack(spacing: 8) {
                if starting { ProgressView().tint(.white) }
                Text(starting ? "Connecting…" : "Start Call")
                    .font(.headline)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.accent, in: RoundedRectangle(cornerRadius: 16))
        }
        .disabled(starting)
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(.bar)
    }
}
