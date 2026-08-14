import Foundation

/// The single place HTTP outcomes turn into user-facing copy.
///
/// Both the container app and the share extension map responses through here
/// so the wording stays consistent and the status-code semantics of the Swish
/// API are documented in one file.
enum SwishAPIError: Error, Equatable {
    /// PAT missing, revoked, or expired (401). The user has to sign in again.
    case unauthorized
    /// Sign-in rejected the email/password pair (401 on /api/auth/token).
    case invalidCredentials
    /// Too many sign-in attempts (429).
    case rateLimited
    /// The URL is already saved (409). Callers treat this as success.
    case alreadySaved
    /// The server rejected the request body (400).
    case invalidRequest
    /// Supabase Auth unreachable (503), or any other server-side failure.
    case server(status: Int)
    /// Could not reach the server at all.
    case network
    /// The response was not the JSON shape the API documents.
    case malformedResponse

    /// Builds the error for a non-2xx response.
    ///
    /// `code` is the API's snake_case `error` field when the body parsed as
    /// JSON; it disambiguates the two distinct 401s (a rejected sign-in versus
    /// an expired token), which otherwise share a status.
    static func from(status: Int, code: String?) -> SwishAPIError {
        switch status {
        case 400:
            return .invalidRequest
        case 401:
            return code == "invalid_credentials" ? .invalidCredentials : .unauthorized
        case 409:
            return .alreadySaved
        case 429:
            return .rateLimited
        default:
            return .server(status: status)
        }
    }

    var message: String {
        switch self {
        case .unauthorized:
            return "Your session expired. Open Swish and sign in again."
        case .invalidCredentials:
            return "That email and password did not match."
        case .rateLimited:
            return "Too many attempts. Wait a minute and try again."
        case .alreadySaved:
            return "Already in your inbox."
        case .invalidRequest:
            return "Swish could not save that link."
        case let .server(status):
            return "The server had a problem (\(status)). Try again shortly."
        case .network:
            return "Could not reach the server. Check your connection and the server URL."
        case .malformedResponse:
            return "The server sent an unexpected response."
        }
    }
}
