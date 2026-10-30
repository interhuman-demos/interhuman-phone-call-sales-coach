import Foundation

/// Direct device → Interhuman realtime connection, authenticated with a
/// client token minted by /api/interhuman-token. Port of
/// web/src/analyzer/interhuman.ts, using the same `access_token` WebSocket
/// subprotocol pattern.
final class InterhumanClient {
    private static let feedbackInstructions =
        "Goal: help the seller land a sales pitch. The analyzed speaker is the seller. " +
        "Flag hesitation or uncertainty in the seller's delivery (especially around pricing), " +
        "monologuing without engaging the buyer, and moments where the seller's trajectory " +
        "is drifting worse. One actionable line. Maximum 8 words. Imperative. No preamble."

    var onSignal: ((SignalEvent) -> Void)?
    var onSignalEnded: ((SignalType) -> Void)?
    var onFeedback: ((String) -> Void)?
    var onError: ((String) -> Void)?

    private let api: ApiClient
    private var task: URLSessionWebSocketTask?
    private var ready = false
    private var queue: [Data] = []

    init(api: ApiClient) {
        self.api = api
    }

    func start() async throws {
        let token = try await api.mintToken()
        guard let url = URL(string: token.url) else { throw ApiError.http(status: 0, body: "bad ws url") }

        let task = URLSession.shared.webSocketTask(with: url, protocols: ["access_token", token.access_token])
        self.task = task
        task.resume()
        receiveLoop()
    }

    func pushAudio(_ data: Data) {
        if ready, let task { task.send(.data(data)) { _ in } }
        else { queue.append(data) }
    }

    func pushTranscript(_ transcript: [TranscriptSegment]) {
        struct Msg: Encodable {
            let type = "transcript.updated"
            let transcript: [TranscriptSegment]
        }
        sendJSON(Msg(transcript: transcript))
    }

    func close() {
        sendJSON(["type": "session.close"])
        let task = self.task
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
            task?.cancel(with: .normalClosure, reason: nil)
        }
        self.task = nil
        ready = false
    }

    // MARK: - internals

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                self.onError?(error.localizedDescription)
            case .success(let message):
                if case .string(let text) = message { self.handle(text) }
                self.receiveLoop()
            }
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String
        else { return }

        switch type {
        case "session.ready":
            ready = true
            // The session-config frame is the RAW config object — no `type`
            // discriminator (unlike transcript.updated / session.close).
            // Sending `type` gets ih6001 + close 1008. Server acks with
            // `session.updated`.
            sendJSON([
                "analysis_groups": ["audio"],
                "realtime_feedback_frequency": "high",
                "realtime_feedback_instructions": Self.feedbackInstructions,
            ])
            for pending in queue { pushAudio(pending) }
            queue.removeAll()

        case "signal.detected", "signal.updated":
            if let event: SignalEvent = decodeData(obj) { onSignal?(event) }

        case "signal.ended":
            if let payload = obj["data"] as? [String: Any],
               let raw = payload["signal_type"] as? String,
               let signal = SignalType(rawValue: raw) {
                onSignalEnded?(signal)
            }

        case "realtime_feedback.generated":
            if let payload = obj["data"] as? [String: Any],
               let feedback = payload["text"] as? String,
               !feedback.isEmpty, feedback != "NO_GUIDANCE" {
                onFeedback?(feedback)
            }

        case "error":
            onError?(obj["message"] as? String ?? "analysis error")

        default:
            break
        }
    }

    private func decodeData<T: Decodable>(_ obj: [String: Any]) -> T? {
        guard let payload = obj["data"],
              let data = try? JSONSerialization.data(withJSONObject: payload)
        else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private func sendJSON(_ value: Encodable) {
        guard let data = try? JSONEncoder().encode(value),
              let text = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(text)) { _ in }
    }

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(text)) { _ in }
    }
}
