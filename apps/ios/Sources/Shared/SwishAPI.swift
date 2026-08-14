import Foundation

/// HTTP client for the Swish API.
///
/// Mirrors the CLI's client in packages/cli/src/http.ts: Bearer auth, JSON
/// bodies, and no runtime validation of the response beyond the fields we
/// actually read.
struct SwishAPI {
    var baseURL: URL
    var session: URLSession = .shared

    /// Long enough to ride out a cold Worker start, short enough that the
    /// share sheet does not sit there indefinitely on a dead network.
    private static let timeout: TimeInterval = 15

    struct IssuedToken: Decodable {
        let id: String
        let token: String
        let expiresAt: String
    }

    private struct ErrorBody: Decodable {
        let error: String?
    }

    private struct BookmarkResponse: Decodable {
        let id: String
        let status: String
    }

    /// Trades an email + password for a PAT. Returns 201 on success; the
    /// status is accepted loosely (2xx) so a future change to 200 does not
    /// break signed-in clients.
    static func login(
        baseURL: URL,
        email: String,
        password: String,
        deviceName: String,
        session: URLSession = .shared
    ) async throws -> IssuedToken {
        let api = SwishAPI(baseURL: baseURL, session: session)
        var request = api.request(path: "/api/auth/token", method: "POST")
        request.httpBody = try JSONEncoder().encode([
            "email": email,
            "password": password,
            "deviceName": deviceName,
        ])
        let data = try await api.send(request)
        do {
            return try JSONDecoder().decode(IssuedToken.self, from: data)
        } catch {
            throw SwishAPIError.malformedResponse
        }
    }

    /// Saves a URL. The API inserts the row and returns within milliseconds,
    /// running the scrape/summarize pipeline after the response is flushed, so
    /// there is nothing to poll for.
    ///
    /// `title` is best effort — the server's pipeline overwrites it with the
    /// scraped page title once it runs.
    func postBookmark(url: URL, title: String?, token: String) async throws {
        var request = request(path: "/api/bookmarks", method: "POST", token: token)
        var body: [String: String] = ["url": url.absoluteString]
        if let title, !title.isEmpty {
            body["title"] = title
        }
        request.httpBody = try JSONEncoder().encode(body)
        _ = try await send(request)
    }

    /// Unauthenticated reachability probe. Separates "cannot reach the server"
    /// from "the server rejected the token".
    func health() async throws {
        _ = try await send(request(path: "/api/health", method: "GET"))
    }

    /// Cheapest authenticated call, used to confirm the stored PAT still works.
    func verifyToken(_ token: String) async throws {
        _ = try await send(request(path: "/api/items?limit=1", method: "GET", token: token))
    }

    /// Revokes the PAT server-side. Best effort on sign-out — the local copy is
    /// cleared regardless.
    func revokeToken(id: String, token: String) async throws {
        _ = try await send(request(path: "/api/tokens/\(id)", method: "DELETE", token: token))
    }

    private func request(path: String, method: String, token: String? = nil) -> URLRequest {
        var request = URLRequest(
            url: URL(string: path, relativeTo: baseURL) ?? baseURL,
            timeoutInterval: Self.timeout
        )
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw SwishAPIError.network
        }
        guard let http = response as? HTTPURLResponse else {
            throw SwishAPIError.malformedResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let code = try? JSONDecoder().decode(ErrorBody.self, from: data).error
            throw SwishAPIError.from(status: http.statusCode, code: code ?? nil)
        }
        return data
    }
}
