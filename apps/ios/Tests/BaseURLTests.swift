import XCTest

final class BaseURLTests: XCTestCase {
    func testStripsTrailingSlashes() throws {
        let url = try BaseURL.normalize("https://swish.example.com///")
        XCTAssertEqual(url.absoluteString, "https://swish.example.com")
    }

    func testTrimsSurroundingWhitespace() throws {
        let url = try BaseURL.normalize("  https://swish.example.com  ")
        XCTAssertEqual(url.absoluteString, "https://swish.example.com")
    }

    func testDefaultsToHTTPSWhenSchemeIsOmitted() throws {
        let url = try BaseURL.normalize("swish.example.com")
        XCTAssertEqual(url.absoluteString, "https://swish.example.com")
    }

    func testKeepsPathAndPort() throws {
        let url = try BaseURL.normalize("https://swish.example.com:8443/base/")
        XCTAssertEqual(url.absoluteString, "https://swish.example.com:8443/base")
    }

    func testRejectsPlaintextHTTPToRemoteHost() {
        XCTAssertThrowsError(try BaseURL.normalize("http://swish.example.com")) { error in
            XCTAssertEqual(error as? BaseURL.ValidationError, .insecureScheme)
        }
    }

    func testAllowsPlaintextHTTPToLocalHosts() throws {
        for input in [
            "http://localhost:3000",
            "http://garaemon-mac.local:3000",
            "http://192.168.1.10:3000",
            "http://10.0.0.5:3000",
            "http://172.16.0.9:3000",
        ] {
            XCTAssertNoThrow(try BaseURL.normalize(input), "expected \(input) to be allowed")
        }
    }

    func testTreatsAddressesOutsideThePrivateRangeAsRemote() {
        // 172.32.x.x sits just past the 172.16–172.31 private block.
        XCTAssertThrowsError(try BaseURL.normalize("http://172.32.0.1:3000"))
    }

    func testRejectsEmptyAndMalformedInput() {
        XCTAssertThrowsError(try BaseURL.normalize("   ")) { error in
            XCTAssertEqual(error as? BaseURL.ValidationError, .empty)
        }
        XCTAssertThrowsError(try BaseURL.normalize("ftp://swish.example.com")) { error in
            XCTAssertEqual(error as? BaseURL.ValidationError, .malformed)
        }
    }
}
