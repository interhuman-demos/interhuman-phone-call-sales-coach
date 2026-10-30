import XCTest

/// "New Call" against the production backend: opens the half-height sheet from
/// the "+" toolbar button, describes a buyer in one sentence, and taps Create
/// — which generates a full scenario via /api/generate-scenario, saves it via
/// /api/custom-personas, and lands the new persona back on Home.
final class ScenarioFormTests: XCTestCase {
    func testDescribeThenCreate() throws {
        let app = XCUIApplication()
        app.launch()

        // wait for Home to load, then open the New Call sheet via the "+"
        XCTAssertTrue(app.staticTexts["Dana Reyes"].waitForExistence(timeout: 15), "Home loaded")
        app.buttons["New Call"].tap()

        // the description editor is the sheet's text input
        let editor = app.textViews.element(boundBy: 0)
        XCTAssertTrue(editor.waitForExistence(timeout: 5), "New Call sheet opened")
        editor.tap()
        editor.typeText("A stressed logistics coordinator at a regional trucking company")

        // Create generates + saves; it stays disabled until the round trip
        // succeeds and dismisses the sheet, returning to Home.
        let createButton = app.navigationBars.buttons["Create"]
        XCTAssertTrue(createButton.waitForExistence(timeout: 5))
        XCTAssertTrue(createButton.isEnabled, "Create enabled once a description is typed")
        createButton.tap()

        // back on Home — the Practice title reappears once the sheet dismisses
        XCTAssertTrue(app.navigationBars["Practice"].waitForExistence(timeout: 25), "returned to Home after create")
    }
}
