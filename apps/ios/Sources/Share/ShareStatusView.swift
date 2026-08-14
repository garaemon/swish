import SwiftUI

/// The whole share-sheet UI: a spinner that turns into a tick or a message.
struct ShareStatusView: View {
    enum State: Equatable {
        case saving
        case saved(String)
        case failed(String)
    }

    let state: State
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            switch state {
            case .saving:
                ProgressView()
                Text("Saving to Swish…")
                    .foregroundStyle(.secondary)
            case let .saved(message):
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.green)
                Text(message)
            case let .failed(message):
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.orange)
                Text(message)
                    .multilineTextAlignment(.center)
                Button("Close", action: onClose)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.regularMaterial)
    }
}
