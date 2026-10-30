import SwiftUI
import Charts

/// End-of-call coaching debrief — mock 2a/2b. A circular score ring with a
/// serif number, one hairline-divided stat card, and an Overview/Moments/Notes
/// segmented switch. Follows system appearance.
struct DebriefView: View {
    @EnvironmentObject private var vm: CallViewModel

    enum Tab: String, CaseIterable { case overview = "Overview", moments = "Moments", notes = "Notes" }
    @State private var tab: Tab = .overview

    var body: some View {
        ZStack {
            Color.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 20) {
                        if vm.debriefLoading {
                            loading
                        } else if let error = vm.debriefError {
                            Text(error)
                                .foregroundStyle(Color.bad)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 40)
                        } else if let debrief = vm.debrief {
                            content(debrief)
                        }
                    }
                    .padding(20)
                }
                if vm.debrief != nil { footer }
            }
        }
    }

    // MARK: - chrome

    private var header: some View {
        VStack(spacing: 4) {
            HStack {
                Button { vm.reset() } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "chevron.left")
                        Text("Buyers")
                    }
                    .font(.body)
                }
                Spacer()
                Text("Debrief").font(.headline)
                Spacer()
                Image(systemName: "square.and.arrow.up")
                    .font(.body)
                    .foregroundStyle(Color.dim)
            }
            Text("\(vm.persona?.name ?? "") · \(vm.persona?.scenario.product.components(separatedBy: " — ").first ?? "") · \(clock(vm.endedAtSec))")
                .font(.footnote)
                .foregroundStyle(Color.dim)
                .lineLimit(1)
        }
        .tint(.accent)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.bg)
        .overlay(alignment: .bottom) { Divider() }
    }

    private var loading: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text("Your coach is reviewing the call…").foregroundStyle(Color.dim)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }

    private var footer: some View {
        Button { vm.reset() } label: {
            Text("Practice Again")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.accent, in: RoundedRectangle(cornerRadius: 16))
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(Color.bg)
    }

    // MARK: - content

    @ViewBuilder
    private func content(_ debrief: DebriefResponse) -> some View {
        scoreRing(debrief)
        statCard(debrief)

        Picker("Section", selection: $tab) {
            ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)

        switch tab {
        case .overview: overview(debrief)
        case .moments: moments(debrief)
        case .notes: notes(debrief)
        }
    }

    private func scoreRing(_ debrief: DebriefResponse) -> some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .stroke(Color.line, lineWidth: 9)
                Circle()
                    .trim(from: 0, to: CGFloat(debrief.score) / 100)
                    .stroke(healthColor(debrief.score), style: StrokeStyle(lineWidth: 9, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(debrief.score)")
                    .font(.system(size: 40, design: .serif))
                    .foregroundStyle(healthColor(debrief.score))
            }
            .frame(width: 128, height: 128)

            Text(debrief.headline)
                .font(.headline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.textPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private func statCard(_ debrief: DebriefResponse) -> some View {
        let talk = vm.talkRatioPercents
        return HStack(spacing: 0) {
            statCell(title: "Talk Ratio", value: "\(talk.rep)%", sub: "you")
            Divider().frame(height: 40)
            statCell(title: "Pace", value: "\(vm.paceWpm)", sub: "wpm")
            Divider().frame(height: 40)
            statCell(
                title: "Objections",
                value: "\(debrief.objectionsHandled.handled)",
                sub: "of \(debrief.objectionsHandled.raised)")
        }
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background(Color.groupedBg, in: RoundedRectangle(cornerRadius: 20))
    }

    private func statCell(title: String, value: String, sub: String) -> some View {
        VStack(spacing: 4) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.dim)
            Text(value)
                .font(.system(.title2, design: .monospaced).weight(.semibold))
                .foregroundStyle(Color.textPrimary)
            Text(sub)
                .font(.caption2)
                .foregroundStyle(Color.dim)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - tabs

    @ViewBuilder
    private func overview(_ debrief: DebriefResponse) -> some View {
        if vm.healthSamples.count > 1 {
            groupedCard("Trajectory over the call") {
                Chart(vm.healthSamples) { sample in
                    LineMark(x: .value("t", sample.t), y: .value("score", sample.score))
                        .foregroundStyle(Color.accent)
                        .interpolationMethod(.monotone)
                }
                .chartYScale(domain: 0...100)
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 90)
            }
        }

        groupedCard("Skill breakdown") {
            VStack(spacing: 0) {
                skillRow("Discovery", debrief.skillScores.discovery, first: true)
                skillRow("Listening", debrief.skillScores.listening)
                skillRow("Value framing", debrief.skillScores.valueFraming)
                skillRow("Objection handling", debrief.skillScores.objectionHandling)
                skillRow("Closing", debrief.skillScores.closing)
            }
        }
    }

    private func skillRow(_ label: String, _ value: Int, first: Bool = false) -> some View {
        VStack(spacing: 0) {
            if !first { Divider() }
            HStack {
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Text("\(value)")
                    .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                    .foregroundStyle(healthColor(value))
            }
            .padding(.vertical, 10)
        }
    }

    private func moments(_ debrief: DebriefResponse) -> some View {
        groupedCard("Key moments") {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(debrief.moments) { moment in
                    HStack(alignment: .top, spacing: 12) {
                        Text(clock(moment.atSec))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(Color.dim)
                            .frame(width: 38, alignment: .leading)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(moment.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.textPrimary)
                            Text(moment.detail)
                                .font(.footnote)
                                .foregroundStyle(Color.dim)
                        }
                        Spacer(minLength: 4)
                        tagPill(moment.tag)
                    }
                }
            }
        }
    }

    private func tagPill(_ tag: String) -> some View {
        let color = tagColor(tag)
        return Text(tag)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .overlay(Capsule().stroke(color.opacity(0.7)))
            .fixedSize()
    }

    /// Mirrors web/src/components/Debrief.tsx's TAG_COLOR.
    private func tagColor(_ tag: String) -> Color {
        switch tag {
        case "objection handled", "strong close": return .good
        case "watch out": return .bad
        default: return .dim
        }
    }

    @ViewBuilder
    private func notes(_ debrief: DebriefResponse) -> some View {
        groupedCard("What worked") { bullets(debrief.strengths, color: .good) }
        groupedCard("Fix next") { bullets(debrief.improvements, color: .warn) }
        groupedCard("Drill for your next call") {
            Text(debrief.drill)
                .font(.subheadline)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func bullets(_ items: [String], color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Text("•").foregroundStyle(color)
                    Text(item).font(.footnote).foregroundStyle(Color.textPrimary)
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

    private func clock(_ seconds: Double) -> String {
        let s = Int(seconds)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
