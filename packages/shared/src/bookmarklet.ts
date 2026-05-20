export type BookmarkletInput = {
  apiUrl: string
  pat: string
}

// IIFE keeps `box`/`fetch` callbacks out of the host page's scope.
// `z-index:2147483647` is the maximum 32-bit signed int, the largest value CSS
// will accept, so the confirmation toast wins against any host stacking ctx.
// `__API_URL__` / `__PAT__` are placeholders substituted by buildBookmarklet
// (with input validation) — do NOT embed user input here directly.
const BOOKMARKLET_TEMPLATE = `(function(){
  fetch('__API_URL__/api/bookmarks', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer __PAT__'
    },
    body: JSON.stringify({ url: location.href, title: document.title })
  }).then(function(r){
    if (r.ok) {
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111;color:#fff;padding:8px 12px;font:14px sans-serif;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
      box.textContent = 'Saved to Swish';
      document.body.appendChild(box);
      setTimeout(function(){ box.remove(); }, 1800);
    } else {
      alert('Swish save failed: ' + r.status);
    }
  }).catch(function(e){ alert('Swish: ' + e.message); });
})();`

function minifyForBookmarkletHref(source: string): string {
  return encodeURIComponent(source.replace(/\s+/g, ' '))
}

/**
 * Builds a `javascript:` URL that posts the current page to /api/bookmarks
 * with the given PAT. Safe to render directly into an anchor href.
 *
 * The placeholders are substituted via a function-form replace so values that
 * contain `$&` / `$1` etc. cannot be interpreted as backreferences.
 */
export function buildBookmarklet(input: BookmarkletInput): string {
  if (!input.apiUrl) throw new Error('apiUrl is required')
  if (!input.pat) throw new Error('pat is required')
  if (!/^https?:\/\//i.test(input.apiUrl)) {
    throw new Error('apiUrl must start with http:// or https://')
  }
  const trimmedUrl = input.apiUrl.replace(/\/$/, '')
  const body = BOOKMARKLET_TEMPLATE.replace(/__API_URL__/g, () => trimmedUrl).replace(
    /__PAT__/g,
    () => input.pat,
  )
  return `javascript:${minifyForBookmarkletHref(body)}`
}
