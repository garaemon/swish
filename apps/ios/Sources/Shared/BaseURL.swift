import Foundation

/// Normalization and safety checks for the user-entered server URL.
enum BaseURL {
    enum ValidationError: Error, Equatable {
        case empty
        case malformed
        /// Plaintext HTTP to a host that is not on the local network. The
        /// sign-in request carries the account password, so this would put it
        /// on the wire in the clear.
        case insecureScheme
    }

    /// Parses and normalizes a server URL typed into the settings field.
    ///
    /// Strips whitespace and any trailing slash so paths can be appended
    /// directly — the same normalization every other Swish client performs
    /// (see the CLI's http.ts and the bookmarklet template). Defaults a
    /// scheme-less entry to https.
    static func normalize(_ input: String) throws -> URL {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw ValidationError.empty
        }

        let withScheme = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        var stripped = withScheme
        while stripped.hasSuffix("/") {
            stripped.removeLast()
        }

        guard
            let url = URL(string: stripped),
            let scheme = url.scheme?.lowercased(),
            let host = url.host,
            !host.isEmpty
        else {
            throw ValidationError.malformed
        }

        switch scheme {
        case "https":
            return url
        case "http":
            guard isLocalHost(host) else {
                throw ValidationError.insecureScheme
            }
            return url
        default:
            throw ValidationError.malformed
        }
    }

    /// Hosts reachable only from the local network, where plaintext HTTP is
    /// tolerated so `pnpm --filter web dev` is usable from a phone.
    ///
    /// Note that App Transport Security permits `*.local` and `localhost`
    /// under NSAllowsLocalNetworking but still blocks bare private IPs, so a
    /// `192.168.x.x` URL is accepted here and then refused by the OS. The
    /// README points users at the `.local` hostname for that reason.
    static func isLocalHost(_ host: String) -> Bool {
        let lowered = host.lowercased()
        if lowered == "localhost" || lowered == "127.0.0.1" || lowered == "::1" {
            return true
        }
        if lowered.hasSuffix(".local") {
            return true
        }
        if lowered.hasPrefix("192.168.") || lowered.hasPrefix("10.") {
            return true
        }
        // 172.16.0.0 – 172.31.255.255
        if lowered.hasPrefix("172.") {
            let parts = lowered.split(separator: ".")
            if parts.count == 4, let second = Int(parts[1]), (16...31).contains(second) {
                return true
            }
        }
        return false
    }
}
