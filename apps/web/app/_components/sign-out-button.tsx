'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth/client';

export function SignOutButton(): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick(): Promise<void> {
    setPending(true);
    try {
      await authClient.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className="hover:underline">
      Sign out
    </button>
  );
}
