'use client';

import { useEffect, useRef } from 'react';
import { buildBookmarklet } from '@swish/shared/bookmarklet';

type Props = { apiUrl: string; pat: string }

/**
 * Renders an <a draggable> whose href is a javascript: URL. React refuses to
 * render javascript: URLs declaratively (security feature) so we assign the
 * href via a ref after mount; browsers still treat it as a normal bookmarklet
 * link that users can drag onto the bookmarks bar.
 *
 * Consequence: the very first render — server-rendered HTML and the first
 * hydration tick — emits an <a> with no href. That window is harmless because
 * this component is rendered only inside the `justIssued` panel of TokenList,
 * which is itself the result of a client-side state transition.
 */
export function BookmarkletLink({ apiUrl, pat }: Props): React.JSX.Element {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.href = buildBookmarklet({ apiUrl, pat });
    }
  }, [apiUrl, pat]);
  return (
    <a
      ref={ref}
      className="inline-block rounded border border-amber-500 px-3 py-1 text-sm text-amber-800 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
      draggable
    >
      Save to Swish
    </a>
  );
}
