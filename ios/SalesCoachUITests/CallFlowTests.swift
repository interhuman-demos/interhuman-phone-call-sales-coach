import XCTest

/// Drives the real app against the production backend: Home buyer list → tap a
/// row to go straight into a live call, buyer opens first (proves token mint +
/// Interhuman WS connect + the AI-first kickoff turn) → end call → debrief.
/// Voice can't be automated (simulator mic = host mic), so the talk path
/// itself is the human test.
final class CallFlowTests: XCTestCase {
    func testHomeToLiveCallAndEnd() throws {
        let app = XCUIApplication()
        app.launch()

        // Home: personas fetched from GET /api/personas
        let danaRow = app.staticTexts["Dana Reyes"]
        XCTAssertTrue(danaRow.waitForExistence(timeout: 15), "personas loaded from prod")

        // tapping a row starts the call directly — no confirmation gate
        danaRow.tap()

        // live/connecting = mic prepared + token minted + Interhuman WS connected.
        // The always-dark call screen shows the hold-to-talk hint once live.
        let hint = app.staticTexts["Hold avatar to talk"]
        XCTAssertTrue(hint.waitForExistence(timeout: 25), "call went live (token + WS ok)")

        // end call → debrief screen
        app.buttons["End"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Debrief"].waitForExistence(timeout: 10), "debrief screen shown")
    }
}
