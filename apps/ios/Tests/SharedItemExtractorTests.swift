import XCTest
import UniformTypeIdentifiers

final class SharedItemExtractorTests: XCTestCase {
    func testExtractsAURLAttachment() async throws {
        let item = NSExtensionItem()
        item.attachments = [
            NSItemProvider(item: URL(string: "https://example.com/post")! as NSURL,
                           typeIdentifier: UTType.url.identifier),
        ]

        let shared = try await SharedItemExtractor.extract(from: [item])
        XCTAssertEqual(shared.url.absoluteString, "https://example.com/post")
    }

    func testFallsBackToALinkInsidePlainText() async throws {
        let item = NSExtensionItem()
        item.attachments = [
            NSItemProvider(item: "worth a read: https://example.com/post today" as NSString,
                           typeIdentifier: UTType.plainText.identifier),
        ]

        let shared = try await SharedItemExtractor.extract(from: [item])
        XCTAssertEqual(shared.url.absoluteString, "https://example.com/post")
    }

    func testThrowsWhenThereIsNoLinkAnywhere() async {
        let item = NSExtensionItem()
        item.attachments = [
            NSItemProvider(item: "just some text" as NSString,
                           typeIdentifier: UTType.plainText.identifier),
        ]

        do {
            _ = try await SharedItemExtractor.extract(from: [item])
            XCTFail("expected extraction to fail")
        } catch {
            XCTAssertEqual(error as? SharedItemExtractor.ExtractionError, .noURL)
        }
    }

    func testRejectsNonWebSchemes() {
        // The API validates with zod's z.url(), which accepts any scheme, so
        // the client has to narrow it before posting.
        for raw in ["mailto:someone@example.com", "tel:+15551234", "file:///etc/hosts"] {
            XCTAssertThrowsError(try SharedItemExtractor.validate(URL(string: raw)!)) { error in
                XCTAssertEqual(
                    error as? SharedItemExtractor.ExtractionError,
                    .unsupportedScheme
                )
            }
        }
    }

    func testAcceptsHTTPAndHTTPS() throws {
        XCTAssertNoThrow(try SharedItemExtractor.validate(URL(string: "http://example.com")!))
        XCTAssertNoThrow(try SharedItemExtractor.validate(URL(string: "https://example.com")!))
    }

    func testDropsATitleThatIsJustTheURL() {
        let url = URL(string: "https://example.com/post")!
        let item = NSExtensionItem()
        item.attributedContentText = NSAttributedString(string: url.absoluteString)

        XCTAssertNil(SharedItemExtractor.title(from: item, url: url))
    }

    func testKeepsAMeaningfulTitle() {
        let url = URL(string: "https://example.com/post")!
        let item = NSExtensionItem()
        item.attributedContentText = NSAttributedString(string: "  A Real Headline  ")

        XCTAssertEqual(SharedItemExtractor.title(from: item, url: url), "A Real Headline")
    }

    func testFindsTheFirstLinkInText() {
        let url = SharedItemExtractor.firstURL(
            in: "see https://first.example.com and https://second.example.com"
        )
        XCTAssertEqual(url?.absoluteString, "https://first.example.com")
    }
}
