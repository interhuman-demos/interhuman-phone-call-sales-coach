import SwiftUI

/// The live call screen — mock 2a/2b, always dark like Phone/FaceTime. Radial
/// gradient over black, a glass trajectory pill up top, the buyer's avatar with
/// press-and-hold-to-talk ripple rings in the center, and a Mute/Speaker/End
/// control row at the bottom. `.connecting` and `.live` both land here.
struct LiveCallView: View {
    @EnvironmentObject private var vm: CallViewModel
    @State private var didTalk = false
    @State private var speakerOn = false
    @State private var showHoldTooltip = false

    var body: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                trajectoryPill
                    .padding(.top, 8)
                Spacer()
                center
                Spacer()
                controls
                    .padding(.bottom, 24)
            }
            .padding(.horizontal, 24)
        }
        .preferredColorScheme(.dark)
        .overlay(alignment: .top) { nudgeToasts.padding(.top, 72) }
        .task(id: vm.status) {
            guard vm.status == .live else { return }
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            if !didTalk && vm.status == .live {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) { showHoldTooltip = true }
            }
        }
    }

    // MARK: - background

    private var background: some View {
        ZStack {
            Color(hex: 0x0D0D0F)
            RadialGradient(
                colors: [Color.accent.opacity(0.22), .clear],
                center: .center, startRadius: 0, endRadius: 420)
            RadialGradient(
                colors: [Color(hex: 0x1A1622).opacity(0.9), .clear],
                center: .top, startRadius: 0, endRadius: 520)
        }
        .ignoresSafeArea()
    }

    // MARK: - trajectory pill

    private var trajectoryPill: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.good)
                .frame(width: 7, height: 7)
                .modifier(LivePulse())
            Text("\(vm.health)")
                .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                .foregroundStyle(healthColor(vm.health))
            Sparkline(samples: vm.healthSamples.map { $0.score })
                .stroke(healthColor(vm.health), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                .frame(width: 48, height: 16)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.08)))
    }

    // MARK: - center

    private var center: some View {
        VStack(spacing: 20) {
            avatar
            VStack(spacing: 4) {
                Text(vm.persona?.name ?? "")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                Text("\(vm.persona?.title ?? "") · \(vm.persona?.company ?? "")")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
            }
            statusLabel
            hintOrSignal
        }
    }

    private var avatar: some View {
        ZStack {
            if vm.buyerSpeaking {
                Ripple(delay: 0)
                Ripple(delay: 1.2)
            }
            Group {
                if let persona = vm.persona {
                    PersonaAvatar(persona: persona, size: 132)
                } else {
                    Circle().fill(Color.accent.opacity(0.18)).frame(width: 132, height: 132)
                }
            }
            .overlay(Circle().stroke(Color.accent.opacity(vm.talking ? 0.9 : 0.4), lineWidth: vm.talking ? 3 : 1.5))
        }
        .scaleEffect(vm.talking ? 1.04 : 1)
        .animation(.easeInOut(duration: 0.2), value: vm.talking)
        .contentShape(Circle())
        .overlay(alignment: .top) { holdTooltip.offset(y: -78) }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !vm.talking {
                        didTalk = true
                        if showHoldTooltip { withAnimation(.easeOut(duration: 0.2)) { showHoldTooltip = false } }
                        vm.pressStart()
                    }
                }
                .onEnded { _ in Task { await vm.pressEnd() } })
    }

    /// A speech-bubble nudge above the avatar, on-brand with the nudge toasts,
    /// that surfaces once the rep has sat quietly on a live call for 5s.
    @ViewBuilder
    private var holdTooltip: some View {
        if showHoldTooltip {
            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    Image(systemName: "hand.tap.fill")
                    Text("Hold to talk")
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(Color.accent.opacity(0.6)))

                Triangle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 12, height: 7)
                    .overlay(Triangle().stroke(Color.accent.opacity(0.6), lineWidth: 1).frame(width: 12, height: 7))
            }
            .transition(.opacity.combined(with: .move(edge: .bottom)))
            .modifier(GentleBob())
        }
    }

    private var statusLabel: some View {
        Group {
            if vm.status == .connecting {
                Text("Calling \(vm.persona?.firstName ?? "")…")
            } else {
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    Text(clock(vm.callElapsedSec))
                }
            }
        }
        .font(.system(.title3, design: .monospaced))
        .foregroundStyle(.white.opacity(0.85))
    }

    @ViewBuilder
    private var hintOrSignal: some View {
        if let signal = prominentSignal {
            signalPill(signal)
        } else if !didTalk && vm.status == .live {
            Text("Hold avatar to talk")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.5))
        } else {
            Text(statusText)
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.5))
        }
    }

    private func signalPill(_ signal: SignalEvent) -> some View {
        HStack(spacing: 6) {
            Circle().fill(Color.good).frame(width: 6, height: 6)
            Text(signal.signal_type.rawValue.capitalized)
                .font(.footnote.weight(.medium))
        }
        .foregroundStyle(Color.good)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.good.opacity(0.12), in: Capsule())
    }

    /// Most prominent active positive signal, if any — a single encouragement pill.
    private var prominentSignal: SignalEvent? {
        vm.activeSignals.values
            .filter { $0.signal_type.isPositive }
            .max { probRank($0.probability) < probRank($1.probability) }
    }

    private func probRank(_ p: Probability?) -> Int {
        switch p { case .high: return 3; case .medium: return 2; case .low: return 1; default: return 0 }
    }

    private var statusText: String {
        if vm.buyerSpeaking { return "\(vm.persona?.firstName ?? "") is speaking" }
        if vm.thinking { return "\(vm.persona?.firstName ?? "") is thinking…" }
        if vm.talking { return "Listening…" }
        return "Hold avatar to talk"
    }

    // MARK: - controls

    private var controls: some View {
        HStack(spacing: 40) {
            circleButton(
                icon: vm.muted ? "mic.slash.fill" : "mic.fill",
                label: "Mute",
                active: vm.muted) { vm.muted.toggle() }

            circleButton(
                icon: speakerOn ? "speaker.wave.2.fill" : "speaker.fill",
                label: "Speaker",
                active: speakerOn) { speakerOn.toggle() }

            Button {
                Task { await vm.endCall() }
            } label: {
                VStack(spacing: 6) {
                    ZStack {
                        Circle().fill(Color.bad).frame(width: 68, height: 68)
                        Image(systemName: "phone.down.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(.white)
                    }
                    Text("End").font(.caption).foregroundStyle(.white.opacity(0.6))
                }
            }
        }
    }

    private func circleButton(icon: String, label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(active ? Color.white : Color.white.opacity(0.14))
                        .frame(width: 68, height: 68)
                    Image(systemName: icon)
                        .font(.system(size: 24))
                        .foregroundStyle(active ? .black : .white)
                }
                Text(label).font(.caption).foregroundStyle(.white.opacity(0.6))
            }
        }
    }

    // MARK: - nudges

    private var nudgeToasts: some View {
        VStack(spacing: 8) {
            ForEach(vm.nudges) { nudge in
                HStack(spacing: 8) {
                    Image(systemName: nudge.severity == "warning" ? "exclamationmark.triangle.fill" : "lightbulb.fill")
                    Text(nudge.text)
                }
                .font(.footnote)
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke((nudge.severity == "warning" ? Color.warn : Color.accent).opacity(0.6)))
            }
        }
        .padding(.horizontal, 24)
        .animation(.easeInOut, value: vm.nudges.count)
        .allowsHitTesting(false)
    }

    private func clock(_ seconds: Double) -> String {
        let s = Int(seconds)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

// MARK: - reusable bits

/// A tiny axis-less sparkline `Shape` from a 0..100 series.
struct Sparkline: Shape {
    let samples: [Int]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard samples.count > 1 else { return path }
        let stepX = rect.width / CGFloat(samples.count - 1)
        for (i, v) in samples.enumerated() {
            let x = rect.minX + CGFloat(i) * stepX
            let y = rect.maxY - CGFloat(max(0, min(100, v))) / 100 * rect.height
            if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
            else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
        return path
    }
}

/// A single expanding, fading ring behind the avatar while the buyer speaks.
private struct Ripple: View {
    let delay: Double
    @State private var animating = false

    var body: some View {
        Circle()
            .stroke(Color.accent.opacity(0.5), lineWidth: 2)
            .frame(width: 132, height: 132)
            .scaleEffect(animating ? 1.7 : 0.85)
            .opacity(animating ? 0 : 0.6)
            .onAppear {
                withAnimation(.easeOut(duration: 2.4).repeatForever(autoreverses: false).delay(delay)) {
                    animating = true
                }
            }
    }
}

/// The blinking live-dot on the trajectory pill.
private struct LivePulse: ViewModifier {
    @State private var on = false
    func body(content: Content) -> some View {
        content
            .opacity(on ? 0.3 : 1)
            .onAppear {
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { on = true }
            }
    }
}

/// A small downward-pointing caret for the hold-to-talk tooltip's tail.
private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

/// A slow, subtle up/down float to keep the tooltip from feeling static.
private struct GentleBob: ViewModifier {
    @State private var up = false
    func body(content: Content) -> some View {
        content
            .offset(y: up ? -3 : 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { up = true }
            }
    }
}
