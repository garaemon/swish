import Foundation

/// Resolves the App Group identifier shared by the container app and the
/// share extension.
///
/// The value comes from the bundle rather than a Swift constant so it is
/// defined once, in Config/Local.xcconfig, and expanded into both targets'
/// Info.plist as `SwishAppGroupIdentifier`. Hardcoding it here would mean two
/// places to keep in sync with the entitlements files.
enum AppGroup {
    static let infoPlistKey = "SwishAppGroupIdentifier"

    /// The configured group identifier, or nil when the Info.plist key is
    /// missing or was left unexpanded (an empty `APP_GROUP_ID` in the
    /// xcconfig yields an empty string rather than a missing key).
    static var identifier: String? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: infoPlistKey) as? String,
            !value.isEmpty
        else {
            return nil
        }
        return value
    }

    /// UserDefaults shared with the extension. Holds non-secret settings only —
    /// the token lives in the keychain. Returns nil if the app group is not
    /// configured or the entitlement is missing.
    static var defaults: UserDefaults? {
        guard let identifier else { return nil }
        return UserDefaults(suiteName: identifier)
    }
}
