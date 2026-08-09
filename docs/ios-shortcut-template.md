# iOS Shortcut template (zero-paste install)

Apple does not allow importing unsigned `.shortcut` files (since iOS 15),
and signing requires `shortcuts sign` on macOS — so the web app cannot
generate a ready-to-install shortcut per user. The supported distribution
channel is an **iCloud share link**.

Swish uses that plus a configuration deep link: you build a generic
"Save to Swish" template **once**, share it via iCloud with **no import
questions**, and set the link as `NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL`.
The settings page then walks the user through two taps next to every
freshly issued PAT:

1. **Add "Save to Swish" shortcut** — opens the iCloud link; the user taps
   *Add Shortcut*. Nothing to fill in.
2. **Finish setup** — a `shortcuts://run-shortcut?...&input=text&text=...`
   deep link that runs the shortcut once, passing
   `swish-config:{"endpoint":"...","authorization":"Bearer ..."}` as
   input. The shortcut detects the `swish-config:` prefix and stores the
   JSON in a file. No copying or pasting anywhere.

Subsequent share-sheet runs read the stored file and POST the shared URL.

Two invariants the template must keep, because the app's builder
(`packages/shared/src/shortcut.ts`) depends on them:

- The shortcut is named exactly **`Save to Swish`** (`SHORTCUT_NAME`) —
  the deep link targets it by name.
- Configuration runs are detected by the input prefix **`swish-config:`**
  (`SHORTCUT_CONFIG_PREFIX`), followed by a JSON object with keys
  `endpoint` and `authorization`.

## Build the template (once, on iPhone/iPad/Mac)

Create a new shortcut named **Save to Swish** with these actions:

1. **If** — condition: *Shortcut Input* (as Text) **begins with**
   `swish-config:`.
2. Inside the **If** branch (configuration run):
   1. **Replace Text** — replace `swish-config:` with (empty) in
      *Shortcut Input*.
   2. **Save File** — save *Updated Text* to
      `Shortcuts/swish-config.json` (turn **off** "Ask Where to Save",
      turn **on** "Overwrite If File Exists").
   3. **Show Notification** — "Swish configured".
3. Inside the **Otherwise** branch (share-sheet run):
   1. **Get File** — get `swish-config.json` from the `Shortcuts` folder
      (turn off "Show Document Picker" / enable "Error If Not Found" so a
      missing config fails loudly instead of posting nowhere).
   2. **Get Dictionary from Input** — from *File*.
   3. **Get Dictionary Value** — key `endpoint` → rename result if you
      like.
   4. **Get Dictionary Value** — key `authorization`.
   5. **Get Contents of URL**:
      - URL: the `endpoint` dictionary value.
      - Method: **POST**.
      - Headers: `Authorization` → the `authorization` dictionary value,
        `Content-Type` → `application/json`.
      - Request Body: **JSON**, key `url`, value the **Shortcut Input**
        variable.
   6. Optional: **Show Notification** — "Saved to Swish".
4. **End If**.
5. In the shortcut's info panel, enable **Use with Share Sheet** and set
   the accepted input types to **URLs** (Text is delivered by the deep
   link regardless of this setting).

## Share it

1. Long-press the shortcut → **Share** → **Copy iCloud Link**.
2. Do **not** add import questions — configuration happens via the
   Finish-setup deep link instead.
3. Copy the resulting `https://www.icloud.com/shortcuts/...` link.

## Wire it into the app

Set the link in `apps/web/.env.local` (and as a Cloudflare Worker var for
production builds):

```bash
NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL=https://www.icloud.com/shortcuts/<id>
```

When the variable is unset, the settings page falls back to the full
manual step-by-step instructions (which embed the endpoint and PAT
directly in the shortcut instead of using the config file).

## Notes

- The iCloud link contains **no secrets** — the endpoint and PAT are
  injected on-device by the Finish-setup deep link, so one shared
  template serves every user and deployment. The `shortcuts:` scheme is
  resolved locally by iOS; the PAT in the deep link never leaves the
  device.
- The PAT ends up in `Shortcuts/swish-config.json` in plaintext (iCloud
  Drive if Shortcuts sync is on). That matches the manual approach, where
  the PAT is stored in plaintext inside the shortcut itself. Re-running
  **Finish setup** with a new token overwrites the file; revoke the old
  token from the settings page.
- If you edit the template later, re-share it: iCloud links are
  snapshots, not live references, so the env var must be updated with the
  new link.
