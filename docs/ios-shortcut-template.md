# iOS Shortcut template (one-tap install)

Apple does not allow importing unsigned `.shortcut` files (since iOS 15),
and signing requires `shortcuts sign` on macOS — so the web app cannot
generate a ready-to-install shortcut per user. The supported distribution
channel is an **iCloud share link**, and shared shortcuts can declare
**Import Questions** that prompt the recipient for values at install time.

Swish uses that: you build a generic "Save to Swish" template **once**,
share it via iCloud, and set the link as
`NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL`. The settings page then shows an
"Add “Save to Swish” shortcut" button next to every freshly issued PAT.
Installing becomes: tap the button → paste two values (endpoint + PAT)
into the import questions → **Add Shortcut**. No manual action-building.

## Build the template (once, on iPhone/iPad/Mac)

1. Open **Shortcuts**, tap **+** to create a new shortcut.
2. Add action **Text**. Type a placeholder such as
   `https://example.com/api/bookmarks`. Rename the action's result if you
   like (e.g. "Endpoint").
3. Add a second **Text** action with placeholder `Bearer PASTE_TOKEN`
   (this will hold the full `Authorization` header value).
4. Add action **Get Contents of URL**:
   - URL: the first Text variable.
   - Method: **POST**.
   - Headers:
     - `Authorization` → the second Text variable.
     - `Content-Type` → `application/json`.
   - Request Body: **JSON**, key `url`, value the **Shortcut Input**
     variable.
5. Optional: add **Show Notification** with text `Saved to Swish`.
6. In the shortcut's info panel, enable **Use with Share Sheet** and set
   the accepted input type to **URLs**.
7. Name it **Save to Swish** and save.

## Share it with import questions

1. Long-press the shortcut → **Share** → **Copy iCloud Link**.
2. During sharing, Shortcuts offers **Import Questions**: mark both
   **Text** actions as import questions —
   - first: `Swish endpoint URL (Settings → iOS Shortcut setup)`
   - second: `Authorization header (Bearer + your token)`
3. Copy the resulting `https://www.icloud.com/shortcuts/...` link.

## Wire it into the app

Set the link in `apps/web/.env.local` (and as a Cloudflare Worker var for
production builds):

```bash
NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL=https://www.icloud.com/shortcuts/<id>
```

When the variable is unset, the settings page falls back to the full
manual step-by-step instructions.

## Notes

- The iCloud link contains **no secrets** — the endpoint and PAT are
  supplied by each user at import time, so one shared template serves
  every user and deployment.
- If you edit the template later, re-share it: iCloud links are snapshots,
  not live references, so the env var must be updated with the new link.
