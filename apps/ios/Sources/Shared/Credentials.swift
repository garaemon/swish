import Foundation

/// What the device stores after signing in.
///
/// The password is never persisted: sign-in trades it for a PAT once, and only
/// the PAT is kept. The secret parts live in the shared keychain; the base URL
/// is not a secret and lives in the shared UserDefaults so the extension can
/// read it without a keychain round trip.
struct SwishCredentials: Equatable {
    var baseURL: URL
    /// The PAT issued by POST /api/auth/token.
    var token: String
    /// personal_access_tokens.id, used to revoke this token on sign-out.
    var tokenId: String

    private static let tokenAccount = "swish.pat"
    private static let tokenIdAccount = "swish.pat.id"
    private static let baseURLKey = "swish.baseURL"

    /// The stored credentials, or nil when the user has not signed in (or the
    /// app group is not configured, in which case nothing was ever readable).
    static func load() -> SwishCredentials? {
        guard
            let raw = AppGroup.defaults?.string(forKey: baseURLKey),
            let baseURL = URL(string: raw),
            let token = KeychainStore.read(account: tokenAccount),
            let tokenId = KeychainStore.read(account: tokenIdAccount)
        else {
            return nil
        }
        return SwishCredentials(baseURL: baseURL, token: token, tokenId: tokenId)
    }

    func save() throws {
        try KeychainStore.save(token, account: Self.tokenAccount)
        try KeychainStore.save(tokenId, account: Self.tokenIdAccount)
        AppGroup.defaults?.set(baseURL.absoluteString, forKey: Self.baseURLKey)
    }

    /// Clears the stored session. The base URL goes too, so a signed-out
    /// extension reports "sign in" rather than posting to a stale host.
    static func clear() {
        KeychainStore.delete(account: tokenAccount)
        KeychainStore.delete(account: tokenIdAccount)
        AppGroup.defaults?.removeObject(forKey: baseURLKey)
    }

    /// Last server URL the user typed, kept so the sign-in field is prefilled
    /// after signing out.
    static var lastBaseURL: String? {
        AppGroup.defaults?.string(forKey: baseURLKey)
    }
}
