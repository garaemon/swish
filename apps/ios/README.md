# Swish for iOS

Native app whose only job is to put a Swish link into your inbox from the iOS
share sheet. The container app is just sign-in and settings; the share
extension does the work.

The Xcode project is **not** committed — it is generated from
[`project.yml`](project.yml) by [XcodeGen](https://github.com/yonaskolb/XcodeGen),
so the pbxproj never shows up in review diffs.

## Requirements

- macOS with Xcode 16 or newer
- `brew install xcodegen`
- An Apple Developer Program membership. App Groups (which the app and the
  extension use to share the access token through the keychain) are generally
  not available to free personal teams.

## Setup

```bash
cd apps/ios
cp Config/Local.xcconfig.example Config/Local.xcconfig
```

Fill in `Config/Local.xcconfig` (gitignored):

| Setting | Where it comes from |
| --- | --- |
| `DEVELOPMENT_TEAM` | Xcode → Settings → Accounts → your team, "Team ID" |
| `SWISH_BUNDLE_ID` | a reverse-DNS id you own, e.g. `com.garaemon.swish` |
| `APP_GROUP_ID` | `group.` + the same id, e.g. `group.com.garaemon.swish` |

Then generate and open the project:

```bash
xcodegen generate
open Swish.xcodeproj
```

`xcodegen` fails if `Config/Local.xcconfig` is missing — that is deliberate,
since the build settings above have no sensible defaults.

In Xcode, check Signing & Capabilities on the **Swish** target: automatic
signing should resolve, and **App Groups** should list your group. Xcode
registers the group on first build; if it does not appear, add it once with
the `+ Capability` button and it will line up with the entitlements file.

The deployment target is iOS 17. Lower `options.deploymentTarget.iOS` in
`project.yml` to 16.0 if your device is older; nothing in the code needs 17.

## Running it

The phone has to be able to reach your Swish server.

- **Deployed:** use the public HTTPS URL. This is the straightforward path.
- **Local dev:** run `pnpm --filter web dev` on your Mac and enter
  `http://<your-mac>.local:3000`. App Transport Security permits plaintext
  HTTP to `.local` hostnames but still blocks bare `192.168.x.x` addresses, so
  use the `.local` name.

Sign in with the email and password of your Supabase user (the same ones the
web app uses — accounts are created from the Supabase dashboard). The app
trades them once for an access token, stores only that token, and never keeps
the password. Tap **Test connection** to confirm; the token then shows up under
Settings → Personal access tokens on the web, named after your device, and can
be revoked from either side.

## CI

`.github/workflows/ios.yml` runs `xcodegen` and builds for the simulator with
signing disabled, whenever anything under `apps/ios/` changes.
