import AVFoundation

/// Mic capture, port of web/src/audio.ts Recorder with one twist: the engine
/// tap feeds TWO sinks —
///  - an in-memory 16kHz mono Int16 PCM buffer, wrapped in a WAV header on
///    demand (`snapshot()`) for Whisper (/api/transcribe partials, /api/turn),
///  - a parallel AVAudioFile writing AAC/m4a for the Interhuman realtime WS,
///    which rejects WAV segments (ih1001, verified by probe 2026-07-15) but
///    accepts m4a. The m4a finalizes at stop(), which is fine: the segment is
///    only sent on release.
final class Recorder {
    private let engine = AVAudioEngine()
    private let queue = DispatchQueue(label: "recorder.buffer")
    private var converter: AVAudioConverter?
    private let targetFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: 16_000, channels: 1, interleaved: false)!

    private var pcm = Data()             // Int16 LE samples @16kHz mono
    private var m4aFile: AVAudioFile?
    private var m4aURL: URL?
    private var recording = false
    private var startedAt = Date()
    private var routeChangeObserver: NSObjectProtocol?

    /// Ask mic permission, configure the session, start the engine (tap runs
    /// for the whole call; `start()`/`stop()` just gate buffering).
    func prepare() async throws {
        guard await AVAudioApplication.requestRecordPermission() else {
            throw RecorderError.micDenied
        }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat,
                                options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setActive(true)

        // Get the engine running on a clean, freshly-activated session BEFORE
        // touching the output route. `engine.inputNode` lazily initializes the
        // input audio unit via an RPC to the audio daemon on first access —
        // calling overrideOutputAudioPort() first (below) kicks off route
        // renegotiation that can still be in flight when that RPC fires,
        // which timed out and crashed (SIGABRT in AURemoteIO::Initialize).
        let input = engine.inputNode

        // `.voiceChat` mode alone doesn't turn on echo cancellation — per
        // Apple's own header docs, using it "without the VoiceProcessing IO
        // unit... enabled" silently disables dynamic processing on BOTH
        // input and output, which is what made Dana's voice quiet even at
        // full system volume. Enabling it here is what actually engages AEC
        // (so Dana's playback can't re-enter the mic) and restores normal
        // output loudness. Must happen while the engine is stopped, before
        // reading the input format below (voice processing changes it).
        try input.setVoiceProcessingEnabled(true)
        input.voiceProcessingOtherAudioDuckingConfiguration = .init(
            enableAdvancedDucking: false, duckingLevel: .min)

        let inputFormat = input.outputFormat(forBus: 0)
        converter = AVAudioConverter(from: inputFormat, to: targetFormat)

        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
            self?.consume(buffer)
        }
        engine.prepare()
        try engine.start()

        // Now that the engine is up, force the speaker (`.defaultToSpeaker`
        // alone is unreliable with .voiceChat mode — iOS still defaults to
        // the earpiece) and keep re-forcing it on route changes, unless real
        // headphones/Bluetooth are actually connected.
        Self.reassertSpeaker(session)
        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
        ) { _ in DispatchQueue.main.async { Self.reassertSpeaker(session) } }
    }

    func start() throws {
        let url = FileManager.default.temporaryDirectory
            .appending(path: "utterance-\(UUID().uuidString).m4a")
        let file = try AVAudioFile(forWriting: url, settings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 32_000,
        ], commonFormat: .pcmFormatFloat32, interleaved: false)
        queue.sync {
            pcm = Data()
            m4aURL = url
            m4aFile = file
            startedAt = Date()
            recording = true
        }
    }

    /// Everything captured so far as a standalone WAV (for partial transcription).
    func snapshot() -> Data {
        queue.sync { Self.wav(from: pcm) }
    }

    struct Utterance {
        let wav: Data
        let m4a: Data
        let durationMs: Double
    }

    func stop() -> Utterance {
        queue.sync {
            recording = false
            m4aFile = nil // deallocation finalizes the file (moov atom written)
            let m4a = m4aURL.flatMap { try? Data(contentsOf: $0) } ?? Data()
            if let url = m4aURL { try? FileManager.default.removeItem(at: url) }
            m4aURL = nil
            return Utterance(
                wav: Self.wav(from: pcm),
                m4a: m4a,
                durationMs: Date().timeIntervalSince(startedAt) * 1000)
        }
    }

    func dispose() {
        if let routeChangeObserver { NotificationCenter.default.removeObserver(routeChangeObserver) }
        routeChangeObserver = nil
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Speakerphone by default; leaves routing alone once real headphones or
    /// a Bluetooth device are connected.
    private static func reassertSpeaker(_ session: AVAudioSession) {
        let external: Set<AVAudioSession.Port> = [.headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP, .airPlay]
        let hasExternalOutput = session.currentRoute.outputs.contains { external.contains($0.portType) }
        try? session.overrideOutputAudioPort(hasExternalOutput ? .none : .speaker)
    }

    // MARK: - tap plumbing

    private func consume(_ buffer: AVAudioPCMBuffer) {
        guard let converter else { return }
        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }

        var fed = false
        var err: NSError?
        converter.convert(to: out, error: &err) { _, status in
            if fed { status.pointee = .noDataNow; return nil }
            fed = true
            status.pointee = .haveData
            return buffer
        }
        guard err == nil, out.frameLength > 0, let channel = out.floatChannelData?[0] else { return }

        let frames = Int(out.frameLength)
        var samples = Data(capacity: frames * 2)
        for i in 0..<frames {
            let clamped = max(-1, min(1, channel[i]))
            var s = Int16(clamped * 32767)
            withUnsafeBytes(of: &s) { samples.append(contentsOf: $0) }
        }

        queue.async { [weak self] in
            guard let self, self.recording else { return }
            self.pcm.append(samples)
            try? self.m4aFile?.write(from: out)
        }
    }

    /// 44-byte WAV header + Int16 LE PCM @16kHz mono.
    private static func wav(from pcm: Data) -> Data {
        let sampleRate: UInt32 = 16_000
        let byteRate = sampleRate * 2
        var d = Data()
        d.append(contentsOf: Array("RIFF".utf8))
        d.appendLE(UInt32(36 + pcm.count))
        d.append(contentsOf: Array("WAVE".utf8))
        d.append(contentsOf: Array("fmt ".utf8))
        d.appendLE(UInt32(16))            // fmt chunk size
        d.appendLE(UInt16(1))             // PCM
        d.appendLE(UInt16(1))             // mono
        d.appendLE(sampleRate)
        d.appendLE(byteRate)
        d.appendLE(UInt16(2))             // block align
        d.appendLE(UInt16(16))            // bits per sample
        d.append(contentsOf: Array("data".utf8))
        d.appendLE(UInt32(pcm.count))
        d.append(pcm)
        return d
    }
}

enum RecorderError: LocalizedError {
    case micDenied
    var errorDescription: String? { "Microphone access denied — enable it in Settings." }
}

private extension Data {
    mutating func appendLE<T: FixedWidthInteger>(_ value: T) {
        var v = value.littleEndian
        Swift.withUnsafeBytes(of: &v) { append(contentsOf: $0) }
    }
}
