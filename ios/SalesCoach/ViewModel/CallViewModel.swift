import Foundation
import SwiftUI

/// The call state machine — port of web/src/App.tsx.
@MainActor
final class CallViewModel: ObservableObject {
    enum Status: Equatable { case idle, connecting, live, ended }

    struct Line: Identifiable {
        let id = UUID()
        let speaker: String      // "rep" | "buyer"
        let text: String
    }

    struct Nudge: Identifiable {
        let id: Int
        let severity: String     // "info" | "warning"
        let text: String
    }

    // MARK: - published state (mirrors App.tsx useState)

    @Published var status: Status = .idle
    @Published var lines: [Line] = []
    @Published var activeSignals: [SignalType: SignalEvent] = [:]
    @Published var signalLog: [SignalSpan] = []
    @Published var healthSamples: [HealthSample] = []
    @Published var health = 65
    @Published var trend = "flat"
    @Published var nudges: [Nudge] = []
    @Published var talking = false
    @Published var muted = false
    @Published var buyerSpeaking = false
    @Published var thinking = false
    @Published var liveText = ""
    @Published var debrief: DebriefResponse?
    @Published var debriefError: String?
    @Published var debriefLoading = false
    @Published var endedAtSec: Double = 0

    @Published var personas: [Persona] = []
    @Published var selectedPersona: Persona?
    @Published var scenarioFormOpen = false
    @Published var startupError: String?
    @Published var practice = PracticeHistoryStore()

    // MARK: - engines

    private let api = ApiClient()
    private let recorder = Recorder()
    private let player = Player()
    private var analyzer: InterhumanClient?
    private var engine = HealthEngine()

    // MARK: - call bookkeeping (mirrors App.tsx useRef)

    private var history: [Turn] = []
    private var transcript: [TranscriptSegment] = []
    private var clockSec = 0.0
    private var callStartedAt = Date()
    private var nudgeId = 0
    private var nudgeLog: [String] = []
    private var pendingNudges: [String: String] = [:]  // severity → latest text
    private var partialText = ""
    private var partialAt = Date()
    private var partialTimer: Timer?
    private var decayTimer: Timer?
    private var samplerTimer: Timer?

    private var nowSec: Double { Date().timeIntervalSince(callStartedAt) }

    /// Seconds since the buyer picked up — drives the Live Call timer.
    var callElapsedSec: Double { status == .live ? nowSec : 0 }

    var persona: Persona? { selectedPersona }

    // MARK: - lifecycle

    func loadPersonas() async {
        do {
            personas = try await api.personas()
            if selectedPersona == nil { selectedPersona = personas.first }
        } catch {
            startupError = "Couldn't load buyers: \(error.localizedDescription)"
        }
    }

    /// New Call sheet — describe a buyer in a sentence, the AI drafts a full
    /// scenario, we save it server-side (visible to every user on both clients)
    /// and select it. The user's explicit difficulty pick overrides the AI's
    /// guess. Returns the saved persona so the caller can optionally start it.
    @discardableResult
    func createFromDescription(prompt: String, difficulty: String) async throws -> Persona {
        var draft = try await api.generateScenario(prompt: prompt)
        draft = CustomScenarioRequest(
            name: draft.name, title: draft.title, company: draft.company,
            industry: draft.industry, icpNotes: draft.icpNotes, product: draft.product,
            sellingPoints: draft.sellingPoints, price: draft.price,
            difficulty: difficulty, personalityTags: draft.personalityTags)
        let persona = try await api.createCustomScenario(draft)
        personas.append(persona)
        selectedPersona = persona
        return persona
    }

    func startCall() async {
        guard status == .idle else { return }
        status = .connecting
        do {
            try await recorder.prepare()

            let analyzer = InterhumanClient(api: api)
            analyzer.onSignal = { [weak self] signal in
                Task { @MainActor in self?.handleSignal(signal) }
            }
            analyzer.onSignalEnded = { [weak self] type in
                Task { @MainActor in self?.handleSignalEnded(type) }
            }
            analyzer.onFeedback = { [weak self] text in
                Task { @MainActor in self?.pushNudge(severity: "info", text: text) }
            }
            analyzer.onError = { message in
                print("analyzer: \(message)")
            }
            try await analyzer.start()
            self.analyzer = analyzer

            callStartedAt = Date()
            status = .live

            // gentle decay toward neutral + trajectory samples for the graph
            decayTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, self.analyzer != nil else { return }
                    self.applyHealth(self.engine.decay(nowMs: Date().timeIntervalSince1970 * 1000))
                }
            }
            samplerTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, self.analyzer != nil else { return }
                    self.healthSamples.append(HealthSample(t: self.nowSec, score: self.health))
                }
            }
        } catch {
            pushNudge(severity: "warning", text: "Couldn't start: \(error.localizedDescription)")
            recorder.dispose()
            status = .idle
            return
        }

        await kickoffTurn()
    }

    /// The buyer answers the phone first — one line, no rep audio involved.
    private func kickoffTurn() async {
        thinking = true
        do {
            let turn = try await api.turn(TurnRequest(
                audio: "", history: [], signals: nil,
                personaId: selectedPersona?.id, kickoff: true))
            thinking = false
            guard !turn.buyerText.isEmpty else { return }

            lines.append(Line(speaker: "buyer", text: turn.buyerText))
            history.append(Turn(role: "buyer", text: turn.buyerText))
            let est = max(1.5, Double(turn.buyerText.split(separator: " ").count) / 2.5)
            transcript.append(TranscriptSegment(start: clockSec, end: clockSec + est, text: turn.buyerText, speaker: 1))
            clockSec += est

            if let audio = Data(base64Encoded: turn.audio), !audio.isEmpty {
                buyerSpeaking = true
                await player.play(audio)
                buyerSpeaking = false
            }
        } catch {
            thinking = false
            pushNudge(severity: "warning", text: "Couldn't start the call: \(error.localizedDescription)")
        }
    }

    // MARK: - push-to-talk

    func pressStart() {
        guard status == .live, !muted, !buyerSpeaking, !thinking, !talking else { return }
        talking = true
        liveText = ""
        partialText = ""
        partialAt = Date()
        do {
            try recorder.start()
        } catch {
            talking = false
            pushNudge(severity: "warning", text: "Mic error: \(error.localizedDescription)")
            return
        }

        // every ~2.5s while holding: transcribe the utterance-so-far so the
        // transcript and the buyer's delivery context update live
        partialTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.partialTick() }
        }
    }

    private func partialTick() async {
        guard talking else { return }
        let snap = recorder.snapshot()
        guard snap.count > 8_000 else { return } // not enough audio yet (~0.25s)
        do {
            let text = try await api.transcribe(audioBase64: snap.base64EncodedString())
            guard talking, !text.isEmpty, text != partialText else { return }
            partialText = text
            partialAt = Date()
            liveText = text
        } catch { /* best-effort; next tick catches up */ }
    }

    func pressEnd() async {
        guard talking else { return }
        talking = false
        partialTimer?.invalidate()
        let utterance = recorder.stop()
        if utterance.durationMs < 300 { liveText = ""; return } // accidental tap

        let durationSec = utterance.durationMs / 1000
        let start = clockSec
        clockSec += durationSec

        // the whole utterance goes to the realtime analysis as one m4a segment
        analyzer?.pushAudio(utterance.m4a)
        thinking = true
        flushPendingNudges()

        do {
            let snapshot = SignalsSnapshot(
                active: activeSignals.values.map {
                    .init(signal_type: $0.signal_type, probability: $0.probability)
                },
                health: health,
                trend: trend)
            let turn = try await api.turn(TurnRequest(
                audio: utterance.wav.base64EncodedString(),
                history: history,
                signals: snapshot.active.isEmpty ? nil : snapshot,
                personaId: selectedPersona?.id,
                kickoff: nil))

            if turn.repText.isEmpty { thinking = false; liveText = ""; return }

            lines.append(Line(speaker: "rep", text: turn.repText))
            liveText = ""
            history.append(Turn(role: "rep", text: turn.repText))
            transcript.append(TranscriptSegment(
                start: start, end: start + durationSec, text: turn.repText, speaker: 0))

            lines.append(Line(speaker: "buyer", text: turn.buyerText))
            history.append(Turn(role: "buyer", text: turn.buyerText))
            let est = max(1.5, Double(turn.buyerText.split(separator: " ").count) / 2.5)
            transcript.append(TranscriptSegment(
                start: clockSec, end: clockSec + est, text: turn.buyerText, speaker: 1))
            clockSec += est
            analyzer?.pushTranscript(transcript)

            thinking = false
            if let audio = Data(base64Encoded: turn.audio), !audio.isEmpty {
                buyerSpeaking = true
                await player.play(audio)
                buyerSpeaking = false
            }
        } catch {
            thinking = false
            pushNudge(severity: "warning", text: "Turn failed: \(error.localizedDescription)")
        }
    }

    // MARK: - end call → debrief

    func endCall() async {
        guard status == .live else { return }
        partialTimer?.invalidate()
        decayTimer?.invalidate()
        samplerTimer?.invalidate()
        analyzer?.close()
        analyzer = nil
        player.stop()
        recorder.dispose()
        endedAtSec = nowSec
        status = .ended

        guard !history.isEmpty else {
            debriefError = "Nothing was said — no debrief."
            return
        }
        debriefLoading = true
        do {
            let result = try await api.debrief(DebriefRequest(
                history: history,
                signalLog: signalLog,
                healthSamples: healthSamples.enumerated().compactMap { i, s in i % 4 == 0 ? s : nil },
                nudges: nudgeLog,
                personaId: selectedPersona?.id,
                transcript: transcript))
            debrief = result
            if let id = selectedPersona?.id {
                practice.record(personaId: id, score: result.score, date: Date())
            }
        } catch {
            debriefError = error.localizedDescription
        }
        debriefLoading = false
    }

    // MARK: - debrief telemetry (mirrors web/src/components/Debrief.tsx)

    /// Share of speaking time, rep vs buyer, from the timed transcript.
    /// Valid until `reset()`; defaults to 50/50 when nothing was said.
    var talkRatioPercents: (rep: Int, buyer: Int) {
        var rep = 0.0, buyer = 0.0
        for seg in transcript {
            let dur = max(0, seg.end - seg.start)
            if seg.speaker == 0 { rep += dur } else { buyer += dur }
        }
        let total = rep + buyer
        guard total > 0 else { return (50, 50) }
        let repPct = Int((rep / total * 100).rounded())
        return (repPct, 100 - repPct)
    }

    /// The rep's speaking pace in words per minute.
    var paceWpm: Int {
        var words = 0.0, seconds = 0.0
        for seg in transcript where seg.speaker == 0 {
            words += Double(seg.text.split(whereSeparator: \.isWhitespace).count)
            seconds += max(0, seg.end - seg.start)
        }
        return seconds > 0 ? Int((words / (seconds / 60)).rounded()) : 0
    }

    /// Back to the picker with a clean slate (post-debrief "Start a new call").
    func reset() {
        status = .idle
        lines = []
        activeSignals = [:]
        signalLog = []
        healthSamples = []
        health = 65
        trend = "flat"
        nudges = []
        talking = false
        muted = false
        buyerSpeaking = false
        thinking = false
        liveText = ""
        debrief = nil
        debriefError = nil
        endedAtSec = 0
        history = []
        transcript = []
        clockSec = 0
        nudgeLog = []
        pendingNudges = [:]
        partialText = ""
        engine = HealthEngine()
    }

    // MARK: - signals → health → nudges

    private func handleSignal(_ signal: SignalEvent) {
        activeSignals[signal.signal_type] = signal
        let t = nowSec
        if let open = signalLog.lastIndex(where: { $0.signal_type == signal.signal_type && $0.endSec == nil }) {
            signalLog[open].probability = signal.probability ?? signalLog[open].probability
        } else {
            signalLog.append(SignalSpan(
                signal_type: signal.signal_type,
                probability: signal.probability,
                positive: signal.signal_type.isPositive,
                startSec: t,
                endSec: nil))
        }
        applyHealth(engine.onSignal(signal, nowMs: Date().timeIntervalSince1970 * 1000))
    }

    private func handleSignalEnded(_ type: SignalType) {
        activeSignals.removeValue(forKey: type)
        let t = nowSec
        if let open = signalLog.lastIndex(where: { $0.signal_type == type && $0.endSec == nil }) {
            signalLog[open].endSec = t
        }
    }

    private func applyHealth(_ update: HealthUpdate) {
        health = update.score
        trend = update.trend
        if let warning = update.warning {
            pushNudge(severity: "warning", text: warning)
        }
    }

    private func pushNudge(severity: String, text: String) {
        nudgeLog.append(text)
        if talking {
            pendingNudges[severity] = text // hold until the rep stops talking
        } else {
            showNudge(severity: severity, text: text)
        }
    }

    private func flushPendingNudges() {
        for (severity, text) in pendingNudges { showNudge(severity: severity, text: text) }
        pendingNudges.removeAll()
    }

    private func showNudge(severity: String, text: String) {
        nudgeId += 1
        let nudge = Nudge(id: nudgeId, severity: severity, text: text)
        nudges = Array(nudges.suffix(1)) + [nudge] // at most 2 on screen
        let id = nudge.id
        DispatchQueue.main.asyncAfter(deadline: .now() + 9) { [weak self] in
            self?.nudges.removeAll { $0.id == id }
        }
    }
}
