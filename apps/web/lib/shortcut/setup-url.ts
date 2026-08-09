// Thin re-export so apps/web/* can use the local @/lib/shortcut import
// alias while the actual builder lives in the shared workspace package
// (mirrors @/lib/bookmarklet/template).
export {
  buildShortcutSetupUrl,
  SHORTCUT_CONFIG_PREFIX,
  SHORTCUT_NAME,
  type ShortcutSetupInput,
} from '@swish/shared/shortcut';
