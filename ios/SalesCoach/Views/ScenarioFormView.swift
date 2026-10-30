import SwiftUI

/// New Call — a half-height sheet over the dimmed Home, mock 2a/2b. Describe a
/// buyer in a sentence; the AI drafts the voice, personality, objections and
/// goals. "Create" saves the scenario without calling; "Start Call" saves and
/// immediately starts the call.
struct ScenarioFormView: View {
    @EnvironmentObject private var vm: CallViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var description = ""
    @State private var difficulty = "medium"
    @State private var busy = false
    @State private var error: String?

    private var trimmed: String { description.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var valid: Bool { !trimmed.isEmpty && !busy }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    descriptionField
                    infoRow
                    difficultyControl
                    voiceRow
                    if let error {
                        Text(error).foregroundStyle(Color.bad).font(.footnote)
                    }
                }
                .padding(20)
            }
            .safeAreaInset(edge: .bottom) { startButton }
            .navigationTitle("New Call")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.disabled(busy)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create(thenStart: false) } }
                        .disabled(!valid)
                }
            }
        }
        .presentationDetents([.fraction(0.85)])
        .presentationDragIndicator(.visible)
        .tint(.accent)
    }

    // MARK: - pieces

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Describe the buyer")
                .font(.footnote.smallCaps())
                .foregroundStyle(Color.dim)
            ZStack(alignment: .topLeading) {
                if trimmed.isEmpty {
                    Text("A skeptical procurement manager at a mid-size hospital who's happy with their current vendor…")
                        .foregroundStyle(Color.ter)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 8)
                }
                TextEditor(text: $description)
                    .frame(minHeight: 120)
                    .scrollContentBackground(.hidden)
            }
            .padding(8)
            .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var infoRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles").foregroundStyle(Color.accent)
            Text("AI fills in voice, personality, objections, and goals.")
                .font(.footnote)
                .foregroundStyle(Color.dim)
        }
    }

    private var difficultyControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Difficulty")
                .font(.footnote.smallCaps())
                .foregroundStyle(Color.dim)
            Picker("Difficulty", selection: $difficulty) {
                Text("Easy").tag("easy")
                Text("Medium").tag("medium")
                Text("Hard").tag("hard")
            }
            .pickerStyle(.segmented)
        }
    }

    private var voiceRow: some View {
        HStack {
            Image(systemName: "waveform").foregroundStyle(Color.dim)
            Text("Voice")
            Spacer()
            Text("Auto-selected by AI").foregroundStyle(Color.dim)
        }
        .font(.subheadline)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 14))
    }

    private var startButton: some View {
        Button {
            Task { await create(thenStart: true) }
        } label: {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(.white) }
                Text(busy ? "Setting up…" : "Start Call")
                    .font(.headline)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(valid ? Color.accent : Color.accent.opacity(0.4),
                        in: RoundedRectangle(cornerRadius: 16))
        }
        .disabled(!valid)
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }

    // MARK: - actions

    private func create(thenStart: Bool) async {
        busy = true
        error = nil
        do {
            try await vm.createFromDescription(prompt: trimmed, difficulty: difficulty)
            dismiss()
            if thenStart { await vm.startCall() }
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}
