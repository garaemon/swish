import Foundation
import Security

/// Minimal generic-password keychain wrapper for the PAT.
///
/// Items are written into the App Group's access group: on iOS an app's
/// keychain access groups implicitly include its App Groups, so setting
/// `kSecAttrAccessGroup` to `group.…` is enough to share an item with the
/// share extension — no separate `keychain-access-groups` entitlement and no
/// `$(AppIdentifierPrefix)` at runtime.
///
/// If a device build ever fails with errSecMissingEntitlement (-34018), the
/// fallback is to add `keychain-access-groups` holding
/// `$(AppIdentifierPrefix)$(SWISH_BUNDLE_ID)` to both entitlements files and
/// prefix the access group here with the team identifier.
///
/// Accessibility is `AfterFirstUnlockThisDeviceOnly`: the extension must be
/// able to read the token while the phone is locked (a share can happen from
/// the lock screen's app switcher), but the token should never ride along in
/// an iCloud or encrypted-backup restore onto another device.
enum KeychainStore {
    enum KeychainError: Error {
        case appGroupUnavailable
        case unexpectedStatus(OSStatus)
    }

    static func save(_ value: String, account: String) throws {
        guard let accessGroup = AppGroup.identifier else {
            throw KeychainError.appGroupUnavailable
        }
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.unexpectedStatus(errSecParam)
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        // Delete-then-add rather than SecItemUpdate: it is one round trip
        // fewer and avoids branching on whether the item already exists.
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] =
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    static func read(account: String) -> String? {
        guard let accessGroup = AppGroup.identifier else { return nil }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard
            status == errSecSuccess,
            let data = result as? Data,
            let value = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return value
    }

    static func delete(account: String) {
        guard let accessGroup = AppGroup.identifier else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
