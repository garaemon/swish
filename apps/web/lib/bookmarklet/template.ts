// Thin re-export so apps/web/* can use the local @/lib/bookmarklet import
// alias while the actual template lives in the shared workspace package
// (which also ships in the CLI bundle if it ever needs to generate one).
export { buildBookmarklet, type BookmarkletInput } from '@swish/shared/bookmarklet';
