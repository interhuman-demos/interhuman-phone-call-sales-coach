import Foundation

/// Thin async client for the four Vercel functions + the persona catalog.
struct ApiClient {
    var baseURL = Config.baseURL

    func personas() async throws -> [Persona] {
        let (data, _) = try await URLSession.shared.data(from: baseURL.appending(path: "/api/personas"))
        return try JSONDecoder().decode(PersonasResponse.self, from: data).personas
    }

    func mintToken() async throws -> TokenResponse {
        try await post(path: "/api/interhuman-token", body: Optional<Int>.none)
    }

    func turn(_ request: TurnRequest) async throws -> TurnResponse {
        try await post(path: "/api/turn", body: request)
    }

    func transcribe(audioBase64: String) async throws -> String {
        struct Req: Encodable { let audio: String }
        let res: TranscribeResponse = try await post(path: "/api/transcribe", body: Req(audio: audioBase64))
        return res.text
    }

    func debrief(_ request: DebriefRequest) async throws -> DebriefResponse {
        try await post(path: "/api/debrief", body: request)
    }

    /// "Create your own scenario" — stored server-side, visible to every user on both clients.
    func createCustomScenario(_ request: CustomScenarioRequest) async throws -> Persona {
        let res: CustomScenarioResponse = try await post(path: "/api/custom-personas", body: request)
        return res.persona
    }

    /// A sentence or two in, a full scenario draft out — pre-fills the create form for review.
    func generateScenario(prompt: String) async throws -> CustomScenarioRequest {
        let res: GenerateScenarioResponse = try await post(path: "/api/generate-scenario", body: GenerateScenarioRequest(prompt: prompt))
        return res.draft
    }

    // MARK: - plumbing

    private func post<B: Encodable, R: Decodable>(path: String, body: B?) async throws -> R {
        var req = URLRequest(url: baseURL.appending(path: path))
        req.httpMethod = "POST"
        req.timeoutInterval = 90 // /api/turn does STT + LLM + TTS
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw ApiError.http(status: http.statusCode, body: String(text.prefix(200)))
        }
        return try JSONDecoder().decode(R.self, from: data)
    }
}

enum ApiError: LocalizedError {
    case http(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case let .http(status, body): return "HTTP \(status): \(body)"
        }
    }
}
