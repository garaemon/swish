import SwiftUI
import UIKit

/// Principal class for the share extension.
///
/// Referenced from Info.plist as `$(PRODUCT_MODULE_NAME).ShareViewController`
/// — there is no storyboard, and the two are mutually exclusive.
final class ShareViewController: UIViewController {
    /// How long a success message stays up before the sheet closes itself.
    /// Long enough to read, short enough to stay out of the way.
    private static let successDismissDelay: Duration = .milliseconds(800)

    private var hosting: UIHostingController<ShareStatusView>?

    override func viewDidLoad() {
        super.viewDidLoad()
        render(.saving)
        Task { await run() }
    }

    private func run() async {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []

        let shared: SharedItemExtractor.Shared
        do {
            shared = try await SharedItemExtractor.extract(from: items)
        } catch SharedItemExtractor.ExtractionError.unsupportedScheme {
            render(.failed("Swish can only save web links."))
            return
        } catch {
            render(.failed("No link found to save."))
            return
        }

        guard let credentials = SwishCredentials.load() else {
            render(.failed("Open Swish and sign in first."))
            return
        }

        let api = SwishAPI(baseURL: credentials.baseURL)
        do {
            try await api.postBookmark(
                url: shared.url,
                title: shared.title,
                token: credentials.token
            )
            await finish(with: "Saved to Swish")
        } catch SwishAPIError.alreadySaved {
            // The URL is already in the inbox, which is the outcome the user
            // wanted. Reported as success, matching the CLI.
            await finish(with: "Already in your inbox")
        } catch let error as SwishAPIError {
            render(.failed(error.message))
        } catch {
            render(.failed(SwishAPIError.network.message))
        }
    }

    private func finish(with message: String) async {
        render(.saved(message))
        try? await Task.sleep(for: Self.successDismissDelay)
        complete()
    }

    private func render(_ state: ShareStatusView.State) {
        let view = ShareStatusView(state: state) { [weak self] in
            self?.complete()
        }
        if let hosting {
            hosting.rootView = view
            return
        }
        let controller = UIHostingController(rootView: view)
        addChild(controller)
        controller.view.frame = self.view.bounds
        controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.view.addSubview(controller.view)
        controller.didMove(toParent: self)
        hosting = controller
    }

    /// Always completes rather than cancelling: cancelRequest(withError:) makes
    /// some host apps stack their own error alert on top of the message we
    /// already showed.
    private func complete() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
