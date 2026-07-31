import { defineConfig } from 'wxt';

// See /root/.claude/plans notes: this is a save-only MV3 extension. It needs
// NO host_permissions because Swish's POST /api/bookmarks already implements
// permissive CORS (apps/web/lib/http/cors.ts reflects the request Origin and
// allows the Authorization header), so the service worker's fetch — which
// sends `Origin: chrome-extension://<id>` — is accepted as-is. Keeping host
// permissions off means zero "read your data on all websites" install
// warnings. If cors.ts is ever tightened to an origin allowlist, either add
// the extension origin there or switch this to optional_host_permissions.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Swish',
    description: 'Save the current page to your Swish inbox',
    // The options page validates URLs with URL.canParse, which is Chrome 120+.
    // Without this floor an older Chrome installs fine, then silently fails to
    // save any settings at all.
    minimum_chrome_version: '120',
    permissions: ['storage', 'activeTab', 'notifications', 'contextMenus'],
    // No popup entrypoint exists, so declare the action explicitly — otherwise
    // WXT omits `action` and action.onClicked never fires.
    action: { default_title: 'Save to Swish' },
    commands: {
      // With no popup, _execute_action fires action.onClicked, so the keyboard
      // shortcut and the toolbar click share one save code path.
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Save current page to Swish',
      },
    },
  },
});
