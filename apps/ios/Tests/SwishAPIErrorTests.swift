import XCTest

final class SwishAPIErrorTests: XCTestCase {
    func testDistinguishesTheTwoKindsOf401() {
        // Both sign-in rejection and an expired token come back as 401; only
        // the body's error code tells them apart, and they need different
        // wording (retype your password vs. sign in again).
        XCTAssertEqual(
            SwishAPIError.from(status: 401, code: "invalid_credentials"),
            .invalidCredentials
        )
        XCTAssertEqual(SwishAPIError.from(status: 401, code: "unauthorized"), .unauthorized)
        XCTAssertEqual(SwishAPIError.from(status: 401, code: nil), .unauthorized)
    }

    func testMapsTheDocumentedStatuses() {
        XCTAssertEqual(SwishAPIError.from(status: 400, code: "invalid_body"), .invalidRequest)
        XCTAssertEqual(SwishAPIError.from(status: 409, code: "already_in_inbox"), .alreadySaved)
        XCTAssertEqual(SwishAPIError.from(status: 429, code: "rate_limited"), .rateLimited)
    }

    func testFallsBackToServerErrorAndKeepsTheStatus() {
        XCTAssertEqual(SwishAPIError.from(status: 503, code: "auth_unavailable"), .server(status: 503))
        XCTAssertEqual(SwishAPIError.from(status: 500, code: nil), .server(status: 500))
        XCTAssertTrue(SwishAPIError.from(status: 500, code: nil).message.contains("500"))
    }

    func testEveryCaseHasAMessage() {
        let cases: [SwishAPIError] = [
            .unauthorized, .invalidCredentials, .rateLimited, .alreadySaved,
            .invalidRequest, .server(status: 500), .network, .malformedResponse,
        ]
        for error in cases {
            XCTAssertFalse(error.message.isEmpty, "\(error) has no message")
        }
    }
}
