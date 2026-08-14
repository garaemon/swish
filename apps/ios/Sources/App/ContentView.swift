import SwiftUI

struct ContentView: View {
    @State private var model = AppViewModel()

    var body: some View {
        NavigationStack {
            Form {
                if model.appGroupMissing {
                    Section {
                        Text(
                            """
                            APP_GROUP_ID is not configured. Fill it in in \
                            Config/Local.xcconfig, re-run `xcodegen generate`, \
                            and rebuild.
                            """
                        )
                        .foregroundStyle(.red)
                    }
                } else if model.isSignedIn {
                    signedInSections
                } else {
                    signInSections
                }

                if let statusText {
                    Section {
                        Text(statusText.message)
                            .foregroundStyle(statusText.isError ? .red : .secondary)
                    }
                }
            }
            .navigationTitle("Swish")
            .disabled(model.isBusy)
        }
    }

    @ViewBuilder
    private var signInSections: some View {
        Section("Server") {
            TextField("https://swish.example.com", text: $model.serverURL)
                .textContentType(.URL)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        Section("Account") {
            TextField("Email", text: $model.email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField("Password", text: $model.password)
                .textContentType(.password)
        }
        Section {
            Button("Sign in") {
                Task { await model.signIn() }
            }
            .disabled(model.email.isEmpty || model.password.isEmpty || model.serverURL.isEmpty)
        } footer: {
            Text(
                """
                Signing in stores an access token on this device. Your password \
                is not saved. Revoke the token any time from Settings → Personal \
                access tokens on the web.
                """
            )
        }
    }

    @ViewBuilder
    private var signedInSections: some View {
        Section("Server") {
            LabeledContent("URL", value: model.credentials?.baseURL.absoluteString ?? "")
        }
        Section {
            Button("Test connection") {
                Task { await model.testConnection() }
            }
            Button("Sign out", role: .destructive) {
                Task { await model.signOut() }
            }
        } footer: {
            Text(
                """
                Share a link from any app and pick Swish. The first time, tap \
                More in the share sheet to turn it on.
                """
            )
        }
    }

    private var statusText: (message: String, isError: Bool)? {
        switch model.status {
        case .idle, .working:
            return nil
        case let .success(message):
            return (message, false)
        case let .failure(message):
            return (message, true)
        }
    }
}
