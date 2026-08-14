import Foundation
import UniformTypeIdentifiers

#if canImport(MobileCoreServices)
import MobileCoreServices
#endif

/// Pulls the link (and, if offered, a title) out of what the share sheet hands
/// the extension.
enum SharedItemExtractor {
    struct Shared: Equatable {
        var url: URL
        var title: String?
    }

    enum ExtractionError: Error, Equatable {
        /// Nothing in the payload looked like a link.
        case noURL
        /// A link, but not one the API can fetch (mailto:, tel:, file: …).
        case unsupportedScheme
    }

    /// Picks the first usable URL out of the extension's input items.
    ///
    /// Two shapes have to be handled: apps that share a `public.url`
    /// attachment (Safari and most browsers), and apps that share plain text
    /// with a link somewhere inside it (chat and notes apps). The activation
    /// rule in Info.plist admits both.
    static func extract(from items: [NSExtensionItem]) async throws -> Shared {
        for item in items {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                if let url = try? await loadURL(from: provider) {
                    return Shared(url: try validate(url), title: title(from: item, url: url))
                }
            }
            // Only fall back to scanning text once no attachment yielded a URL,
            // so a shared page's real URL always wins over a link that happens
            // to appear in its description.
            for provider in attachments {
                if
                    let text = try? await loadText(from: provider),
                    let url = firstURL(in: text)
                {
                    return Shared(url: try validate(url), title: title(from: item, url: url))
                }
            }
        }
        throw ExtractionError.noURL
    }

    /// The API validates with zod's `z.url()`, which accepts any scheme, so the
    /// client narrows it — the same check the CLI performs before posting.
    static func validate(_ url: URL) throws -> URL {
        switch url.scheme?.lowercased() {
        case "http", "https":
            return url
        default:
            throw ExtractionError.unsupportedScheme
        }
    }

    /// Best-effort page title. Dropped when it is empty or just the URL again,
    /// since the server overwrites it with the scraped title anyway.
    static func title(from item: NSExtensionItem, url: URL) -> String? {
        let candidates = [item.attributedContentText?.string, item.attributedTitle?.string]
        for candidate in candidates {
            guard let trimmed = candidate?.trimmingCharacters(in: .whitespacesAndNewlines) else {
                continue
            }
            if trimmed.isEmpty || trimmed == url.absoluteString {
                continue
            }
            return trimmed
        }
        return nil
    }

    /// First link in a block of text, found the way iOS itself detects links.
    static func firstURL(in text: String) -> URL? {
        guard
            let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return detector.firstMatch(in: text, options: [], range: range)?.url
    }

    private static func loadURL(from provider: NSItemProvider) async throws -> URL {
        let type = UTType.url.identifier
        guard provider.hasItemConformingToTypeIdentifier(type) else {
            throw ExtractionError.noURL
        }
        guard let item = try await provider.loadItem(forTypeIdentifier: type) else {
            throw ExtractionError.noURL
        }
        // Providers are inconsistent about the concrete type they hand back,
        // so accept every representation rather than assuming URL.
        switch item {
        case let url as URL:
            return url
        case let url as NSURL:
            return url as URL
        case let string as String:
            guard let url = URL(string: string) else { throw ExtractionError.noURL }
            return url
        case let data as Data:
            guard
                let string = String(data: data, encoding: .utf8),
                let url = URL(string: string)
            else {
                throw ExtractionError.noURL
            }
            return url
        default:
            throw ExtractionError.noURL
        }
    }

    private static func loadText(from provider: NSItemProvider) async throws -> String {
        let type = UTType.plainText.identifier
        guard provider.hasItemConformingToTypeIdentifier(type) else {
            throw ExtractionError.noURL
        }
        guard let item = try await provider.loadItem(forTypeIdentifier: type) else {
            throw ExtractionError.noURL
        }
        switch item {
        case let string as String:
            return string
        case let string as NSString:
            return string as String
        case let data as Data:
            guard let string = String(data: data, encoding: .utf8) else {
                throw ExtractionError.noURL
            }
            return string
        default:
            throw ExtractionError.noURL
        }
    }
}

private extension NSItemProvider {
    /// async wrapper over the completion-handler API, which has no async
    /// overload for the untyped `NSSecureCoding` form we need here.
    func loadItem(forTypeIdentifier type: String) async throws -> NSSecureCoding? {
        try await withCheckedThrowingContinuation { continuation in
            loadItem(forTypeIdentifier: type, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: item)
                }
            }
        }
    }
}
