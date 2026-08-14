import Foundation
import UIKit

/// State behind ContentView.
///
/// The container app exists only to put a PAT into the shared keychain and
/// prove it works; everything the user actually does happens in the share
/// extension.
@MainActor
@Observable
final class AppViewModel {
    enum Status: Equatable {
        case idle
        case working
        case success(String)
        case failure(String)
    }

    var serverURL: String = SwishCredentials.lastBaseURL ?? ""
    var email: String = ""
    var password: String = ""
    private(set) var status: Status = .idle
    private(set) var credentials: SwishCredentials? = SwishCredentials.load()

    var isSignedIn: Bool { credentials != nil }

    var isBusy: Bool { status == .working }

    /// Shown instead of the sign-in form when the App Group is missing, since
    /// nothing can be stored and the failure would otherwise look like a
    /// network problem.
    var appGroupMissing: Bool { AppGroup.identifier == nil }

    func signIn() async {
        status = .working
        let baseURL: URL
        do {
            baseURL = try BaseURL.normalize(serverURL)
        } catch let error as BaseURL.ValidationError {
            status = .failure(message(for: error))
            return
        } catch {
            status = .failure("That server URL is not valid.")
            return
        }

        do {
            let issued = try await SwishAPI.login(
                baseURL: baseURL,
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                deviceName: UIDevice.current.name
            )
            let credentials = SwishCredentials(
                baseURL: baseURL,
                token: issued.token,
                tokenId: issued.id
            )
            try credentials.save()
            self.credentials = credentials
            // Drop the password from memory as soon as it has been traded for
            // a token; it is never written to disk.
            password = ""
            serverURL = baseURL.absoluteString
            status = .success("Signed in. Swish is ready in the share sheet.")
        } catch let error as SwishAPIError {
            status = .failure(error.message)
        } catch {
            status = .failure("Could not store the token on this device.")
        }
    }

    /// Probes the server, then the token, so the two failure modes are
    /// distinguishable: /api/health needs no auth, /api/items needs the PAT.
    func testConnection() async {
        guard let credentials else { return }
        status = .working
        let api = SwishAPI(baseURL: credentials.baseURL)
        do {
            try await api.health()
        } catch {
            status = .failure("Could not reach \(credentials.baseURL.absoluteString).")
            return
        }
        do {
            try await api.verifyToken(credentials.token)
            status = .success("Connected. Token is valid.")
        } catch let error as SwishAPIError {
            status = .failure(error.message)
        } catch {
            status = .failure("The token was rejected.")
        }
    }

    /// Revokes server-side when possible, but always clears the device. A
    /// failed revoke must not strand the user in a signed-in state they cannot
    /// leave; the token expires on its own.
    func signOut() async {
        guard let credentials else { return }
        status = .working
        let api = SwishAPI(baseURL: credentials.baseURL)
        try? await api.revokeToken(id: credentials.tokenId, token: credentials.token)
        SwishCredentials.clear()
        self.credentials = nil
        password = ""
        status = .idle
    }

    private func message(for error: BaseURL.ValidationError) -> String {
        switch error {
        case .empty:
            return "Enter the URL of your Swish server."
        case .malformed:
            return "That server URL is not valid."
        case .insecureScheme:
            return "Use https:// — a plain http:// address would send your password in the clear."
        }
    }
}
